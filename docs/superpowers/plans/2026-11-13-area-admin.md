# Área de administração — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans, as the implementer subagent the main session dispatches, to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a tela "Administração" (Clientes, Administradores, Registro) em que o admin do GI adiciona, remove, reativa,
libera e bloqueia clientes, reenvia o e-mail de senha, abre e edita o plano de qualquer cliente e gerencia os admins,
com toda ação gravada num Registro imutável.

**Architecture:** as políticas RLS de `planos` não mudam. Todo poder novo do admin passa por funções `security definer`
no Postgres que conferem `sou_admin()` e gravam em `registro_admin`; só criar conta e mandar o e-mail de senha, que
precisam da chave secreta, ficam numa Edge Function (`admin-usuarios`). No app, o `PlanProvider` ganha um "modo
cliente" que lê e grava pelo repositório do cliente (as funções do banco), sem cache local, e a área do plano é
extraída num componente que serve aos dois modos.

**Tech Stack:** React 19, Vite 7, TypeScript 5.9, Tailwind 4, Supabase (Postgres + Auth + Edge Functions em Deno),
vitest (jsdom para o app; `vitest.db.config.ts` contra o Supabase local).

**Spec:** `docs/superpowers/specs/2026-11-13-area-admin-design.md` (leia antes; este plano argumenta a partir dela).

## Global Constraints

- Nível Estrutural + Sensível: `/ship` roda a revisão do branch contra este plano e a revisão de segurança com
  `docs/SECURITY.md`. O implementador não revisa nem roda `/ship`.
- Branch `feat/area-admin`, no checkout principal, sem worktree.
- Nunca rodar nada contra produção (PLAN26 `aixjmxfkaziqlxnpudkk`): nada de `supabase db push`, `supabase link`,
  `supabase functions deploy`, `supabase config push`, `mcp__supabase__*` de escrita, deploy na Vercel.
- `supabase/config.toml` é só do ambiente local; nunca é enviado ao PLAN26 (`config push` manda o arquivo inteiro).
- A chave secreta do Supabase nunca aparece em `src/` (`src/seguranca.test.ts` continua passando).
- Política de `planos` intocada. Se algo exigir mudá-la, pare e reporte.
- Textos da tela em português do Brasil com acentos. Nada de `window.confirm`/`alert`: confirmação dentro da tela.
- Limites do plano do cliente iguais aos do cliente: ano de 2026 até o ano UTC atual + 1; `dados` até 1 MiB (check da
  tabela, erro 23514).
- Registro: "alterou plano" agrupado por admin, cliente e ano, uma linha a cada 30 minutos contados da última linha
  desse grupo; o `detalhe` nunca carrega o conteúdo do plano (só `{"ano": N}`).
- Endereço de retorno do e-mail fixo: `https://planejamento.gestaoimpacto.com`.
- CORS da Edge Function: `https://planejamento.gestaoimpacto.com`, `https://plan-*-gestao-de-impactos-projects.vercel.app`
  e `http://localhost:5173`. Outras origens: sem `Access-Control-Allow-Origin`.
- E-mail sempre aparado e em minúsculas antes de comparar ou gravar (`admins.email` tem check de minúsculas).
- 16 GB de RAM: um comando pesado por vez (`tsc`, suíte inteira, `supabase start`). Rodar só os testes afetados;
  `npm run test:db` reseta o banco local.
- Commits em inglês no padrão do repo (`feat:`, `test:`, `fix:`), terminando com
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Não commitar `MAPA_PLAN_2026.md` nem `entrega-leonardo/`.
- `src/hooks/usePlanData.tsx` (1813 linhas) é lido por faixa, nunca inteiro.

## Review Focus

1. **Gravação pendente ao trocar de plano.** O admin edita o plano do cliente e clica "Voltar" antes dos 3 s do
   salvamento automático: a edição vai para o cliente (descarregada ao desmontar) e nunca para o plano do próprio
   admin. Teste na Tarefa 6.
2. **Cliente removido com a sessão aberta.** Ele continua na tela e tenta gravar: o banco recusa (42501) e o app mostra
   a mensagem de acesso, não um erro genérico; ao recarregar, vê "Sua conta foi desativada". Teste na Tarefa 6.
3. **E-mail com maiúsculas ou espaços em promover e em criar.** `" Ana@X.com "` acha a conta `ana@x.com` (migrada) e
   responde "já existe" em vez de criar uma segunda conta ou falhar. Testes nas Tarefas 2 e 4.
4. **Rebaixar concorrente.** Dois admins se rebaixando ao mesmo tempo: `sou_admin()` é conferido depois da trava, então
   o segundo é recusado mesmo que tenha passado na conferência antes. Teste na Tarefa 2.
5. **Registro sem dados do plano e sem escrita direta.** Nenhum caminho do cliente grava, altera ou apaga
   `registro_admin`, e "alterou plano" guarda só o ano. Testes nas Tarefas 1 e 3.

---

### Tarefa 1: Status `removido`, Registro e `definir_status_de_acesso`

**Files:**
- Create: `supabase/migrations/20261113000000_area_admin.sql`
- Test: `tests/db/admin-status.test.ts`

**Interfaces:**
- Consumes: `sou_admin()`, `definir_status_de_acesso(alvo uuid, novo_status text)` e o check de `acessos.status`
  (`supabase/migrations/20261112000000_plan.sql:24`, `:92-112`); helpers de `tests/db/ambiente.ts`
  (`criarPessoa`, `clienteServico`, `emailUnico`).
- Produces:
  - tabela `public.registro_admin(id bigint identity, quando timestamptz not null default now(), admin_email text not null,
    acao text not null, alvo uuid null, alvo_email text null, detalhe jsonb not null default '{}')`, índice em
    `(quando desc)` e em `(alvo, quando desc)`;
  - `registrar_acao_admin(admin_email text, acao text, alvo uuid, alvo_email text, detalhe jsonb) returns void`,
    `security definer`, execute só para `service_role` (a Edge Function usa);
  - função interna `_registrar(acao text, alvo uuid, detalhe jsonb)` que pega `admin_email` de `auth.jwt()->>'email'` e
    `alvo_email` de `acessos`; sem grant para `anon`/`authenticated`;
  - ações gravadas por esta tarefa: `liberou`, `bloqueou`, `removeu`, `reativou` (removido → liberado).

- [ ] **Step 1: Escrever os testes que falham** em `tests/db/admin-status.test.ts`:
  - `admin remove cliente: status removido, plano intacto, Registro com "removeu"` (cria plano antes com o cliente;
    depois lê pelo serviço e compara `dados`);
  - `reativar devolve liberado e grava "reativou"`;
  - `cliente removido não lê nem grava o próprio plano` (select retorna 0 linhas; upsert dá erro 42501);
  - `remover ou bloquear a si mesmo é recusado` (42501, mensagem contém "si mesmo");
  - `remover ou bloquear um admin é recusado com "rebaixe antes"`;
  - `status fora da lista é recusado` (`'apagado'` → erro);
  - `não admin chamando definir_status_de_acesso: 42501`;
  - `registro_admin: admin lê; cliente lê zero linhas; ninguém (nem admin) insere, altera ou apaga` (cada tentativa
    pelo cliente autenticado dá erro ou afeta 0 linhas; a contagem pelo serviço não muda);
  - `registrar_acao_admin não pode ser chamada por authenticated` (erro de permissão).
- [ ] **Step 2: Rodar e ver falhar.** `npm run db:local` (se não estiver no ar), depois
  `npx supabase db reset --local` e `npx vitest run --config vitest.db.config.ts tests/db/admin-status.test.ts`.
  Esperado: FAIL (status `removido` não existe, tabela não existe).
- [ ] **Step 3: Implementar a migração.** Trocar o check de `acessos.status` para incluir `'removido'`; criar a tabela com
  RLS ligada, política de select `using ((select public.sou_admin()))` para `authenticated`, `revoke all` de `anon` e
  `authenticated` e `grant select` só para `authenticated`. Recriar `definir_status_de_acesso` (`create or replace`,
  mesma assinatura) mantendo o que já faz (`liberado_em`, `liberado_por`, `alterado_no_app_em`) e acrescentando as
  recusas da spec e a gravação no Registro. Erros de permissão com `errcode = '42501'`; status inválido com `'22023'`.
  Uma linha `-- why:` sobre "só as funções gravam o Registro".
- [ ] **Step 4: Rodar e ver passar** (mesmo comando) e também `tests/db/acesso.test.ts` e `tests/db/permissoes.test.ts`
  (nada do que já existia quebrou). Esperado: PASS.
- [ ] **Step 5: Commit** `feat(db): removed status and admin audit log`.

### Tarefa 2: Administradores

**Files:**
- Modify: `supabase/migrations/20261113000000_area_admin.sql` (acrescentar ao fim)
- Test: `tests/db/admin-admins.test.ts`

**Interfaces:**
- Consumes: `_registrar` (Tarefa 1).
- Produces (todas `security definer`, `set search_path = public`, execute para `authenticated`):
  - `listar_admins() returns table(email text, user_id uuid, nome text)` — `user_id`/`nome` nulos para admin sem conta;
  - `promover_admin(email text) returns void` — grava `promoveu admin`;
  - `rebaixar_admin(email text) returns void` — grava `rebaixou admin`.

- [ ] **Step 1: Testes que falham:**
  - `promover cliente liberado: aparece em listar_admins e sou_admin() vira true para ele`;
  - `promover com " Ana@X.com " acha a conta ana@x.com`;
  - `promover e-mail sem conta: recusado com "adicione como cliente antes"`;
  - `promover cliente removido: recusado`;
  - `promover quem já é admin: nada muda e não grava no Registro`;
  - `rebaixar a si mesmo: recusado`;
  - `dois admins se rebaixando ao mesmo tempo: um consegue, o outro é recusado` (`Promise.allSettled` com os dois
    clientes; exatamente um sem erro; sobra 1 admin). Com um admin só, o único caminho até ele é rebaixar a si mesmo,
    já recusado; a contagem "último admin" fica como defesa e é exercida por este teste;
  - `não admin chamando cada uma: 42501`.
- [ ] **Step 2: Rodar e ver falhar** (`npx vitest run --config vitest.db.config.ts tests/db/admin-admins.test.ts`
  depois do `db reset`).
- [ ] **Step 3: Implementar.** Em `rebaixar_admin`: `lock table public.admins in exclusive mode` **antes** de conferir
  `sou_admin()` e de contar; a conferência depois da trava é o que recusa o segundo pedido concorrente (comentário
  `-- why:` na linha). Normalizar o e-mail com `lower(trim(...))`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `feat(db): admin promotion and demotion`.

### Tarefa 3: Plano do cliente pelo admin

**Files:**
- Modify: `supabase/migrations/20261113000000_area_admin.sql`
- Test: `tests/db/admin-plano.test.ts`

**Interfaces:**
- Consumes: `_registrar` (Tarefa 1).
- Produces (`security definer`, execute para `authenticated`, todas recusam alvo = `auth.uid()` e não admin com 42501):
  - `anos_do_cliente(alvo uuid) returns setof int` (ordem crescente);
  - `plano_do_cliente(alvo uuid, ano int) returns table(dados jsonb, atualizado_em timestamptz)` — zero linhas se não
    houver; grava `abriu plano` com `{"ano": N}` a cada chamada;
  - `salvar_plano_do_cliente(alvo uuid, ano int, dados jsonb) returns timestamptz` (o novo `atualizado_em`) — upsert em
    `planos (user_id, ano)`; ano fora de `2026..ano UTC + 1` → `errcode '22023'`, mensagem
    `Ano do plano fora do permitido`; tamanho cai no check da tabela (23514).
  - Agrupamento de "alterou plano": insere uma linha só se não houver linha `alterou plano` do mesmo `admin_email`,
    `alvo` e `detalhe->>'ano'` com `quando > now() - interval '30 minutes'`.

- [ ] **Step 1: Testes que falham:**
  - `admin abre e edita plano de cliente pendente, bloqueado e removido; o cliente liberado vê a edição`;
  - `ano 2025 e 9999 recusados; ano atual UTC + 1 aceito`;
  - `dados com mais de 1 MiB recusados (23514)`;
  - `três gravações seguidas: uma linha "alterou plano"`;
  - `gravação depois de 31 min da última linha: segunda linha` (o teste recua `quando` da linha em 31 min pelo
    `clienteServico()`);
  - `"alterou plano" guarda só {"ano": N}`;
  - `abrir grava "abriu plano" uma vez por chamada`;
  - `alvo igual a si mesmo: recusado nas três`;
  - `não admin nas três: 42501`;
  - `cliente comum continua sem ler o plano de outro` (select direto em `planos` com outro `user_id` → 0 linhas).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** as três funções.
- [ ] **Step 4: Rodar e ver passar**, junto com `tests/db/planos.test.ts`.
- [ ] **Step 5: Commit** `feat(db): admin reads and edits client plans`.

### Tarefa 4: Edge Function `admin-usuarios`

**Files:**
- Create: `supabase/functions/admin-usuarios/regras.ts` (puro, sem Deno)
- Create: `supabase/functions/admin-usuarios/index.ts` (handler Deno)
- Test: `supabase/functions/admin-usuarios/regras.test.ts`, `tests/db/admin-usuarios.test.ts`
- Modify: `vitest.config.ts` (`include` ganha `'supabase/functions/**/*.test.ts'`)
- Modify, se preciso: `supabase/config.toml` (`[edge_runtime] enabled`, `additional_redirect_urls`)

**Interfaces:**
- Consumes: `definir_status_de_acesso` (Tarefa 1), `registrar_acao_admin` (Tarefa 1).
- Produces:
  - `regras.ts`: `URL_DO_APP = 'https://planejamento.gestaoimpacto.com'`;
    `normalizarEmail(bruto: unknown): string | null` (aparado, minúsculo, formato `x@y.z`, senão `null`);
    `validarCriar(corpo: unknown): { email: string; nome: string } | { erro: string }` (nome aparado, 1 a 120);
    `origemPermitida(origem: string | null): boolean`;
    `cabecalhosCors(origem: string | null): Record<string, string>`.
  - Contrato HTTP (`POST /functions/v1/admin-usuarios`, `Authorization: Bearer <token do admin>`):
    - corpo `{ acao: 'criar', email, nome }` ou `{ acao: 'reenviar', alvo }`; qualquer outro campo (ex.: `redirectTo`)
      é ignorado;
    - 200 `{ resultado: 'criado' }`, `{ resultado: 'criado_sem_email' }`, `{ resultado: 'ja_existe', status:
      'pendente' | 'liberado' | 'bloqueado' | 'removido' | 'administrador', alvo?: string }`, `{ resultado: 'enviado' }`;
    - 400 `{ erro }` (corpo inválido, ação desconhecida, alvo removido no reenviar: "Reative o cliente antes");
      401 `{ erro }` sem login; 403 `{ erro }` não admin; `OPTIONS` → 204 com os cabeçalhos de CORS.
  - Registro: `adicionou cliente`, `e-mail de senha não saiu`, `reenviou e-mail de senha`.

- [ ] **Step 1: Testes puros que falham** (`regras.test.ts`): `" Ana@X.com "` → `ana@x.com`; `ana@`, `''`, `null` →
  `null`; nome `''`, `'   '` e 121 caracteres → erro, 120 → ok; origens permitidas: produção,
  `https://plan-abc123-gestao-de-impactos-projects.vercel.app`, `http://localhost:5173`; recusadas:
  `https://plan-x.vercel.app.evil.com`, `https://evil-gestao-de-impactos-projects.vercel.app`, `null`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run supabase/functions/admin-usuarios/regras.test.ts`.
- [ ] **Step 3: Implementar `regras.ts`** e rodar até passar.
- [ ] **Step 4: Testes de fluxo que falham** (`tests/db/admin-usuarios.test.ts`, chamando
  `${SUPABASE_URL}/functions/v1/admin-usuarios` com `fetch` e lendo o Mailpit em
  `http://127.0.0.1:54324/api/v1/search?query=to:<email>`):
  - `sem login: 401`; `cliente liberado: 403`; `admin com e-mail não confirmado: 403`; `acao "apagar": 400`;
  - `criar " Novo@X.com ": conta confirmada, acesso liberado com o nome, Registro "adicionou cliente", e-mail no
    Mailpit com link cujo redirect_to é https://planejamento.gestaoimpacto.com` (mesmo mandando `redirectTo` malicioso);
  - `criar e-mail existente liberado, removido e de admin: ja_existe com o status certo, nada muda`;
  - `reenviar: novo e-mail no Mailpit e Registro "reenviou e-mail de senha"`; `reenviar removido: 400`;
  - `criar com e-mail inválido ou nome vazio: 400 e nenhuma conta nova`;
  - `o cliente criado entra com senha depois de defini-la e vê o plano liberado` (define a senha pelo serviço,
    entra com `signInWithPassword`, lê `acessos` = liberado).
- [ ] **Step 5: Subir a função local:** `npx supabase functions serve admin-usuarios --no-verify-jwt` em segundo plano
  (o handler confere o token por conta própria). Se o CLI exigir `[edge_runtime] enabled = true`, ligue com um
  comentário `# why:` dizendo que é para os testes da Edge Function e que custa RAM. Se o link do e-mail sair com
  `site_url` local no lugar do endereço fixo, acrescente `"https://planejamento.gestaoimpacto.com/**"` em
  `additional_redirect_urls` locais. **Se a função não rodar localmente, pare e reporte** (spec, seção 5).
- [ ] **Step 6: Rodar os testes de fluxo e ver falhar** (função ainda vazia).
- [ ] **Step 7: Implementar `index.ts`.** Cliente com o token de quem chamou (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  cabeçalho `Authorization` repassado) para `sou_admin()` e `definir_status_de_acesso(novo, 'liberado')`; cliente de
  serviço (`SUPABASE_SERVICE_ROLE_KEY`, fornecida pelo Supabase) para `auth.admin.createUser({ email, email_confirm:
  true, user_metadata: { name: nome } })`, para ler `acessos`/`admins` na checagem de "já existe" e para
  `registrar_acao_admin`. Envio com `resetPasswordForEmail(email, { redirectTo: URL_DO_APP })`. Se `createUser`
  responder que o e-mail já está registrado, devolva `ja_existe`. Falha no envio depois de criar: `criado_sem_email`
  e Registro "e-mail de senha não saiu".
- [ ] **Step 8: Rodar e ver passar** (`regras.test.ts` e `tests/db/admin-usuarios.test.ts`); `src/seguranca.test.ts`
  continua passando.
- [ ] **Step 9: Commit** `feat: admin-usuarios edge function (create client, resend password e-mail)`.

**Fica para produção (não é teste local):** o cliente adicionado entrar pelo Google com o mesmo e-mail e cair na mesma
conta. O Google não roda no Supabase local; os clientes migrados que entram pelo Google já dependem da mesma ligação
automática por e-mail confirmado. A verificação vai para os passos humanos depois do deploy.

### Tarefa 5: Serviços do app

**Files:**
- Modify: `src/services/acesso.ts`, `src/services/acesso.test.ts`
- Create: `src/services/planoDoCliente.ts`, `src/services/planoDoCliente.test.ts`
- Create: `src/services/adminUsuarios.ts`, `src/services/adminUsuarios.test.ts`

**Interfaces:**
- Consumes: as funções das Tarefas 1–3 e o contrato HTTP da Tarefa 4.
- Produces:
  - `acesso.ts`: `StatusAcesso` ganha `'removido'`; `type Admin = { email: string; uid: string | null; nome: string |
    null }`; `listarAdmins(cliente): Promise<Admin[]>`; `promoverAdmin(cliente, email): Promise<void>`;
    `rebaixarAdmin(cliente, email): Promise<void>`; `type AcaoDoRegistro = { id: number; quando: Date; adminEmail:
    string; acao: string; alvo: string | null; alvoEmail: string | null; detalhe: Record<string, unknown> }`;
    `listarRegistro(cliente, alvo?: string): Promise<AcaoDoRegistro[]>` (mais novas primeiro, limite 200).
  - `planoDoCliente.ts`: `anosDoCliente(cliente, alvo): Promise<number[]>`;
    `planoDoCliente(cliente, alvo, ano): Promise<{ dados: DadosDoPlano; atualizadoEm: Date } | null>`;
    `salvarPlanoDoCliente(cliente, alvo, ano, dados): Promise<Date>`.
  - `adminUsuarios.ts`: `type ResultadoCriar = { resultado: 'criado' | 'criado_sem_email' } | { resultado:
    'ja_existe'; status: StatusAcesso | 'administrador'; alvo?: string }`;
    `criarCliente(cliente, email, nome): Promise<ResultadoCriar>`; `reenviarEmailDeSenha(cliente, alvo): Promise<void>`;
    ambos por `cliente.functions.invoke('admin-usuarios', { body })`; erro 4xx vira `Error` com a mensagem `erro` do
    corpo.

- [ ] **Step 1: Testes que falham**, no estilo de `src/services/acesso.test.ts` (cliente falso): cada função chama a
  RPC certa com os parâmetros certos e converte datas; `listarRegistro` sem alvo e com alvo; `criarCliente` devolve o
  `resultado` e transforma um 400 `{ erro: 'Nome obrigatório' }` em `Error('Nome obrigatório')`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest related --run src/services/acesso.ts src/services/planoDoCliente.ts
  src/services/adminUsuarios.ts`.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `feat: admin services`.

### Tarefa 6: `PlanProvider` em modo cliente e conta desativada

**Files:**
- Create: `src/services/repositorioDoPlano.ts`, `src/services/repositorioDoPlano.test.ts`
- Modify: `src/hooks/usePlanData.tsx` (faixas: imports 30–32; `PlanProvider` 344; `saveToFirebase` 394; `carregarPlano`
  432; criação de ano ~493–510; autosave 599; `checkSubscription` 645; `listarAcessosDoBanco`/`mudarStatusDeAcesso`
  690–698; `value` ~1711; `resetAllData` 1768; chave do Gemini 439, 478, 517, 1779)
- Modify: `src/components/AguardandoLiberacao.tsx`, `src/App.tsx` (caso `'aguardando'`)
- Test: `src/hooks/usePlanData.cliente.test.tsx`, `src/components/AguardandoLiberacao.test.tsx`

**Interfaces:**
- Consumes: `planoDoCliente.ts` (Tarefa 5); `listarPlanos`, `carregarPlano`, `salvarPlano` de `src/services/planos.ts`.
- Produces:
  - `interface RepositorioDoPlano { anos(): Promise<number[]>; carregar(ano: number): Promise<{ dados: DadosDoPlano;
    atualizadoEm: Date } | null>; salvar(ano: number, dados: DadosDoPlano): Promise<Date> }`;
    `repositorioProprio(cliente, uid)` e `repositorioDoCliente(cliente, alvo)`;
  - `type PlanoDeCliente = { uid: string; email: string; nome: string | null }`;
  - `PlanProvider` aceita `planoDeCliente?: PlanoDeCliente`; o contexto expõe `planoDeCliente` e
    `atualizadoEmNoBanco: Date | null` (para a faixa da Tarefa 7);
  - `AguardandoLiberacao` aceita `removido?: boolean`.

Comportamento do modo cliente (cada item é um teste em `usePlanData.cliente.test.tsx`, com `planoDoCliente.ts` e
`planos.ts` mockados):
- não chama `checkSubscription` (nem `ehAdministrador`/`obterAcesso`); `subscriptionStatus` = `'active'`,
  `souAdmin` = `false`;
- abre `aberturaDoPlano.abrir` se o cliente tem esse ano; senão o maior ano salvo; sem nenhum, o
  `anoDoPlanoAtual()` vazio, e nada é gravado até a primeira edição;
- nunca chama `criarPlanoSeNaoExistir` nem `salvarPlano` (do próprio admin); a criação de ano fica escondida;
- uma edição chama `salvarPlanoDoCliente(alvo, ano, dados)` depois do debounce;
- desmontar com gravação pendente descarrega para o cliente (e não para o admin);
- nada é lido, gravado ou removido no `localStorage`: com `google_gemini_api_key` e o cache do admin
  (`chaveLocalDoPlano`) preenchidos antes, os dois ficam iguais depois de montar, editar e desmontar, e nenhuma chave
  nova aparece;
- `resetAllData` grava pelo repositório do cliente.

Modo normal (testes no mesmo arquivo): `checkSubscription` com status `removido` dá `'inactive'` e `statusAcesso`
`'removido'`; gravação recusada com 42501 mostra a mensagem de acesso de `traduzirErroDeGravacao`.

- [ ] **Step 1: Testes que falham** em `repositorioDoPlano.test.ts` (cada repositório chama o serviço certo),
  `usePlanData.cliente.test.tsx` (lista acima) e `AguardandoLiberacao.test.tsx` (`removido` mostra
  "Sua conta foi desativada", "Fale com a Gestão de Impacto para reativar." e o botão Sair; sem `removido` o texto
  de hoje continua).
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest related --run src/hooks/usePlanData.tsx
  src/components/AguardandoLiberacao.tsx src/services/repositorioDoPlano.ts`.
- [ ] **Step 3: Implementar.** Todas as leituras e gravações do plano no provider passam pelo repositório escolhido
  uma vez (`useMemo` por `user.id`/`planoDeCliente.uid`); o cache local e a chave do Gemini ficam atrás de
  `if (!planoDeCliente)`. Se o mapeamento de status em `checkSubscription` for inline, extraia-o para uma função pura
  em `src/utils/telaDoApp.ts` com os mesmos ramos e teste lá. `App.tsx` passa
  `removido={statusAcesso === 'removido'}`. Remova do `value` o que ficar sem uso.
- [ ] **Step 4: Rodar e ver passar**, junto com os testes de componentes que usam `usePlan`
  (`npx vitest related --run src/hooks/usePlanData.tsx`).
- [ ] **Step 5: Commit** `feat: client plan mode in PlanProvider and deactivated account screen`.

### Tarefa 7: Tela Administração e plano do cliente aberto

**Files:**
- Create: `src/components/admin/Administracao.tsx` (abas), `src/components/admin/AbaClientes.tsx`,
  `src/components/admin/AbaAdministradores.tsx`, `src/components/admin/AbaRegistro.tsx`,
  `src/components/admin/FaixaDoPlanoDoCliente.tsx`, `src/components/AreaDoPlano.tsx`
- Delete: `src/components/GestaoDeAcessos.tsx` (substituída)
- Modify: `src/types.ts:9` (`'gestao-acessos'` → `'administracao'`), `src/components/Sidebar.tsx:234-235`
  (rótulo "Administração"), `src/App.tsx`, `src/components/Sidebar.test.tsx` (se citar o rótulo antigo)
- Test: `src/components/admin/AbaClientes.test.tsx`, `src/components/admin/AbaAdministradores.test.tsx`,
  `src/components/admin/AbaRegistro.test.tsx`, `src/components/admin/FaixaDoPlanoDoCliente.test.tsx`

**Interfaces:**
- Consumes: serviços da Tarefa 5; `PlanProvider`/`PlanoDeCliente`/`atualizadoEmNoBanco` da Tarefa 6.
- Produces: `Administracao({ onAbrirPlano: (c: PlanoDeCliente) => void })`; `AreaDoPlano` (Sidebar + `main` +
  `renderView`, extraído do caso `'app'` de `MainLayout`); `FaixaDoPlanoDoCliente({ onVoltar })`.

Ações por cliente (o que não está na linha não aparece):
- pendente: Liberar, Bloquear, Remover, Reenviar e-mail de senha, Abrir plano, Tornar admin
- liberado: Bloquear, Remover, Reenviar e-mail de senha, Abrir plano, Tornar admin
- bloqueado: Liberar, Remover, Abrir plano
- removido: Reativar, Abrir plano
- admin (outro): Abrir plano; a própria linha: nenhuma ação

Textos fixos: faixa "Você está no plano de {nome} ({e-mail})" com o botão "Voltar à Administração"; aviso
"Este plano foi alterado há {X} min" quando `atualizadoEmNoBanco` tem menos de 30 minutos (a coluna muda também com
gravações de admin, por isso "alterado" e não "Fulano editou").

- [ ] **Step 1: Testes que falham** (serviços mockados):
  - `AbaClientes`: busca por nome e por e-mail; filtros Pendentes/Liberados/Bloqueados/Removidos; as ações de cada
    status acima, inclusive admin e a própria linha; Remover pede confirmação na tela e só chama
    `definirStatus(..., 'removido')` depois de confirmar; Adicionar cliente mostra a mensagem de cada `resultado`
    (`criado`, `criado_sem_email` com "use Reenviar", `ja_existe` com o status e, para `removido`, o botão Reativar);
  - `AbaAdministradores`: lista; Adicionar admin por e-mail chama `promoverAdmin`; Rebaixar pede confirmação e não
    aparece na própria linha; o erro do banco aparece na tela;
  - `AbaRegistro`: mostra quando, admin, ação, cliente e detalhe; o filtro por cliente chama `listarRegistro(alvo)`;
  - `FaixaDoPlanoDoCliente`: textos da faixa, aviso com 10 min e sem aviso com 31 min, Voltar chama `onVoltar`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest related --run` com os arquivos novos.
- [ ] **Step 3: Implementar.** Em `MainLayout`, estado `planoAberto: PlanoDeCliente | null`; com ele preenchido,
  renderizar `<PlanProvider key={planoAberto.uid} user={user} planoDeCliente={planoAberto}>` com a faixa e
  `AreaDoPlano`, sem `OnboardingWizard`; Voltar limpa o estado e volta à view `'administracao'`. Layout que funcione a
  390 px (abas roláveis, ações num menu ou em linha que quebra).
- [ ] **Step 4: Rodar e ver passar**, mais `npx vitest related --run src/App.tsx src/components/Sidebar.tsx` e
  `npm run typecheck`.
- [ ] **Step 5: Semear para a verificação como usuário:** em `scripts/semear-local.mjs`, acrescentar um cliente
  pendente e um removido com plano (só local; o script já recusa URL que não seja local).
- [ ] **Step 6: Commit** `feat: administration screen replaces access management`.

## Passos humanos (cada um com o "sim" do usuário na hora, depois do `/ship`)

1. Merge em `main`.
2. `supabase db push` no PLAN26 (migração `20261113000000_area_admin.sql`).
3. `supabase functions deploy admin-usuarios` no PLAN26.
4. Deploy do app na Vercel (projeto `plan`) a partir de `main`.
5. Em produção: adicionar pela tela uma conta Google que o usuário controla, entrar com o Google e conferir que caiu na
   conta criada (liberada); depois remover essa conta pela tela.

A migração e a função vão antes do app, porque a tela nova chama as duas. Avisar o Leonardo que o admin passa a ver e
editar o plano dos clientes (substitui a regra do commit `4399e2c`).

## Condições de parada

Pare e reporte, sem contornar, se: algum fluxo atual precisar mudar as políticas de `planos`; a Edge Function não rodar
no Supabase local; algo exigir a chave secreta em `src/` ou no navegador; algum passo pedir comando contra produção;
`usePlanData.tsx` não permitir isolar o modo cliente sem mudar o comportamento do plano do próprio usuário.
