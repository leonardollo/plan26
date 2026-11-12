# Migração para o Supabase: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans, as the implementer subagent the main session dispatches, to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar o Firebase (login e banco) pelo projeto Supabase PLAN26, com as mesmas permissões, e deixar prontos os
scripts e o roteiro da virada.

**Architecture:** a estrutura do banco e o RLS ficam em `supabase/migrations/` e são testados contra o Supabase local.
O app mantém as interfaces de `authService`, `planos.ts` e `acesso.ts`; muda só o que está por dentro. A migração é um
script local: uma função pura transforma o que foi lido do Firebase, e camadas finas leem do Firebase e gravam no
Supabase.

**Tech Stack:** React 19, Vite 7, TypeScript 5.9, `@supabase/supabase-js` 2, Supabase CLI (local, Docker), Vitest 5,
`firebase-admin` (só nos scripts).

**Spec:** `docs/superpowers/specs/2026-11-12-migracao-supabase-design.md`

## Global Constraints

- **Nada toca a produção.** Todas as tarefas rodam contra o Supabase local (`supabase start`). Nunca rode `supabase
  db push`, `supabase link`, os scripts com `--aplicar` ou `--confirmo=`, nem `firebase deploy`; isso é da virada, com o
  "sim" do usuário.
- Nunca leia, imprima nem crie `.env.local`; as credenciais da produção são do usuário.
- PLAN26: URL `https://aixjmxfkaziqlxnpudkk.supabase.co`, chave pública `sb_publishable_dBg8bB4xBbSK6TzcFKCSIA_a9KjnmEZ`
  (pública, pode ficar no código como valor padrão).
- A chave `service_role` nunca tem prefixo `VITE_` e nada em `src/` a menciona.
- O Firebase não é apagado: `firestore.rules`, `firebase.json` e `.firebaserc` ficam; `firebase-tools` fica.
- Admin tem acesso só ao próprio espaço, nunca aos planos dos outros.
- Anos de plano graváveis: de 2026 até o ano atual em UTC + 1.
- RAM de 16 GB: um comando pesado por vez (`supabase start`, `tsc`, a suíte inteira). Desligue no
  `supabase/config.toml` o que o app não usa: `studio`, `storage`, `realtime`, `edge_runtime` e `analytics`. O
  `inbucket` fica ligado, porque é onde chegam os e-mails locais.
- Entre a Tarefa 2 e a Tarefa 3 o app fica com o login no Supabase e os dados ainda no Firestore; os testes passam,
  mas o app só volta a funcionar de ponta a ponta no fim da Tarefa 3. A verificação como usuário é na Tarefa 4.
- Textos da interface em português, com acentos. Comentários de "por quê" onde uma decisão restringe o código.
- Commits: mensagem convencional, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Cliente migrado entra com Google e ganha uma conta nova, vazia, em vez de cair na migrada.** Esperado: mesma conta
   pelo e-mail. Não dá para testar o Google localmente; o roteiro da Tarefa 8 exige esse teste na prévia, antes da
   virada (condição de parada da especificação).
2. **Gravação recusada (sessão expirada, RLS, rede) passa calada.** Esperado: o erro de salvar visível que já existe
   aparece. Teste na Tarefa 3: `salvarPlano` rejeita quando o banco recusa.
3. **Link de "defina sua senha" aberto num navegador com outra pessoa logada.** Esperado: a tela "Defina sua senha"
   aparece antes de qualquer outra e só some depois de gravar a senha. Teste na Tarefa 2: `telaDeEntrada`.
4. **Relógio do computador do cliente adiantado** (ano local 2028 em 2026): o app tenta criar um plano que o RLS recusa.
   Esperado: erro visível, sem laço. Teste na Tarefa 3: `criarPlanoSeNaoExistir` para um ano fora da faixa rejeita.
5. **Duas abas abrindo o ano novo ao mesmo tempo.** Esperado: o segundo insert não sobrescreve o que a primeira já
   editou. Teste na Tarefa 3.

---

### Task 1: Estrutura do banco, RLS e testes de permissão

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/20261112000000_plan.sql`
- Create: `tests/db/ambiente.ts`, `tests/db/permissoes.test.ts`, `vitest.db.config.ts`
- Modify: `package.json` (scripts), `.github/workflows/ci.yml`
- Delete: `tests/rules/**`, `vitest.rules.config.ts`, `@firebase/rules-unit-testing` (devDependency)

**Interfaces:**
- Produces (SQL, schema `public`):
  - tabelas `admins(email)`, `acessos(user_id, email, nome, status, email_verificado, criado_em, liberado_em,
    liberado_por)`, `planos(user_id, ano, dados, atualizado_em, importado_em)`, como na seção 1 da especificação, mais
    `acessos.email_verificado boolean not null default false`;
  - funções `sou_admin() returns boolean`, `posso_usar_o_espaco() returns boolean`,
    `definir_status_de_acesso(alvo uuid, novo_status text) returns void`;
  - gatilhos em `auth.users`: no insert cria o acesso `pendente`; no insert e no update de `email_confirmed_at` grava
    `acessos.email_verificado = (email_confirmed_at is not null)`;
  - gatilho em `planos` (insert e update): `atualizado_em = now()`; quando `importado_em` vem não nulo e diferente do
    anterior, `importado_em = now()` também (os dois ficam iguais na importação).
- Produces (testes): `tests/db/ambiente.ts` exporta
  `criarPessoa(opcoes: { email: string; status?: StatusAcesso; admin?: boolean; confirmado?: boolean }): Promise<{ id: string; cliente: SupabaseClient }>`
  e `clienteServico(): SupabaseClient`; lê `API_URL`, `ANON_KEY` e `SERVICE_ROLE_KEY` de `supabase status -o env`.
  Cada teste usa e-mails únicos (sufixo aleatório).
- Scripts: `"db:local": "supabase start"`, `"test:db": "supabase db reset --local && vitest run --config vitest.db.config.ts"`.

`email_verificado` não estava na especificação: entra para a coluna "E-mail verificado" da Gestão de Acessos continuar
funcionando, já que o cliente não lê `auth.users`.

- [ ] **Step 1: `supabase init`; desligar no `config.toml` os serviços listados nas restrições; `supabase start`**
  Expected: `supabase status` mostra a API em `http://127.0.0.1:54321`.
- [ ] **Step 2: Escrever `tests/db/permissoes.test.ts`** com um `it` por exemplo da seção 1 da especificação:
  - `liberado lê e grava o próprio plano de 2027`
  - `insert de 2025 e de (ano UTC atual + 2) é recusado`
  - `pendente e bloqueado não leem nem gravam o próprio plano`
  - `A não lê nem grava o plano de B`
  - `admin grava o próprio plano sem acesso liberado e não lê o de um cliente`
  - `sou_admin é falso para admin com e-mail não confirmado` (crie com `confirmado: false`)
  - `cliente lê só o próprio acesso; admin lista todos`
  - `cliente não muda o próprio status, nem por update nem por definir_status_de_acesso; admin muda e grava liberado_por`
  - `ninguém lê admins nem apaga plano ou acesso`
  - `cadastro com E-mail@X.com gera acesso pendente com email minúsculo, mesmo com status liberado nos metadados`
  - `email_verificado acompanha a confirmação`
  - `importação: importado_em e atualizado_em ficam iguais; update do app deixa atualizado_em maior`

  Para "recusado", espere `error` não nulo no insert/update, ou zero linhas afetadas no update/delete (o RLS filtra em
  silêncio).
- [ ] **Step 3: `npm run test:db`** → Expected: FAIL (tabelas não existem).
- [ ] **Step 4: Escrever `supabase/migrations/20261112000000_plan.sql`.** Funções `security definer` com
  `set search_path = ''` e nomes qualificados; `grant execute` só para `authenticated`; `revoke all` de `anon` nas
  tabelas. `sou_admin()` lê `lower(auth.jwt() ->> 'email')` e confere `email_confirmed_at` em `auth.users` por
  `auth.uid()`.
- [ ] **Step 5: `npm run test:db`** → Expected: PASS, todos.
- [ ] **Step 6: Apagar `tests/rules/`, `vitest.rules.config.ts`, o script `test:rules` e `@firebase/rules-unit-testing`.
  No CI, trocar Java e `test:rules` por `supabase/setup-cli@v1`, `supabase start` e `npm run test:db`.**
- [ ] **Step 7: Commit** `feat(db): estrutura do PLAN no Supabase com RLS e testes de permissão`

### Task 2: Login com o Supabase

**Files:**
- Create: `src/services/supabase.ts`, `src/services/supabase.test.ts`, `src/components/DefinirSenha.tsx`
- Modify: `src/hooks/usePlanData.tsx:1-140` (configuração e `authService`), `src/App.tsx:145-190`,
  `src/components/Login.tsx`, `src/components/VerificarEmailAdmin.tsx` (só se a interface mudar; não deve)
- Delete: `src/services/emuladores.ts`, `src/services/emuladores.test.ts`

**Interfaces:**
- Produces (`src/services/supabase.ts`):
  - `export const supabase: SupabaseClient`: URL e chave de `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, com os
    valores do PLAN26 como padrão; em `import.meta.env.DEV` com `MODE === 'local'`, aponta para
    `http://127.0.0.1:54321` com a chave anon local (a que `supabase status` mostra; é pública e fixa).
  - `export type UsuarioDoApp = { uid: string; email: string | null; displayName: string | null; emailVerified: boolean }`
  - `export function usuarioDoSupabase(u: { id: string; email?: string; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> } | null): UsuarioDoApp | null`
    (`displayName` vem de `user_metadata.name`, senão `full_name`, senão `null`).
  - `export function telaDeEntrada(e: { recuperandoSenha: boolean; temUsuario: boolean }): 'definir_senha' | 'app' | 'login'`
- `authService` mantém os nomes: `login`, `signup`, `logout`, `loginWithGoogle`, `resetPassword`, `emailAtual`,
  `enviarVerificacaoDeEmail`, `recarregarUsuario`, `subscribe`, e ganha `definirSenha(senha: string): Promise<void>`.
  Mapeamento: `signInWithPassword`; `signUp` com `options: { data: { name }, emailRedirectTo: window.location.origin }`;
  `signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`;
  `resetPasswordForEmail(email, { redirectTo: window.location.origin })`;
  `enviarVerificacaoDeEmail` = `auth.resend({ type: 'signup', email })`; `recarregarUsuario` = `auth.refreshSession()`;
  `subscribe` = `onAuthStateChange`, entregando `usuarioDoSupabase(session?.user)` e avisando `PASSWORD_RECOVERY`;
  `definirSenha` = `auth.updateUser({ password })`. Toda chamada que devolve `{ error }` lança o erro.
  O modo local (sem servidor) continua como está.

- [ ] **Step 1: Testes em `src/services/supabase.test.ts`**
  - `usuarioDoSupabase(null)` → `null`;
  - usuário com `email_confirmed_at` e `user_metadata.full_name: 'Ana'` → `{ uid, email, displayName: 'Ana', emailVerified: true }`;
  - sem `email_confirmed_at` → `emailVerified: false`;
  - `telaDeEntrada({ recuperandoSenha: true, temUsuario: true })` → `'definir_senha'`;
  - `telaDeEntrada({ recuperandoSenha: false, temUsuario: true })` → `'app'`;
  - `telaDeEntrada({ recuperandoSenha: false, temUsuario: false })` → `'login'`.
- [ ] **Step 2: `npx vitest related --run src/services/supabase.ts`** → Expected: FAIL (módulo não existe).
- [ ] **Step 3: Instalar `@supabase/supabase-js`; implementar `supabase.ts`; reescrever a configuração e o
  `authService` em `usePlanData.tsx`; no `App.tsx`, usar `telaDeEntrada` e mostrar `DefinirSenha` quando der
  `'definir_senha'`.**
  - `DefinirSenha`: dois campos de senha, o mesmo mínimo de caracteres do cadastro; ao gravar, volta para o app.
  - `Login.tsx`:
    - depois do cadastro, a mensagem é "Enviamos um link de confirmação para {email}. Abra o e-mail para entrar.", com
      o botão "Reenviar e-mail";
    - os erros do Supabase são traduzidos: credenciais inválidas → a mensagem de hoje; e-mail não confirmado →
      "Confirme seu e-mail antes de entrar.".
  - Corrija os acentos que faltam nas mensagens que você tocar.
- [ ] **Step 4: `npx vitest related --run src/services/supabase.ts src/components/Login.tsx src/App.tsx`** → Expected: PASS.
- [ ] **Step 5: Commit** `feat(auth): login pelo Supabase, com Google por redirecionamento e tela de definir senha`

### Task 3: Planos e acessos no Supabase

**Files:**
- Modify: `src/services/planos.ts:1-60,126-140`, `src/services/acesso.ts`, `src/hooks/usePlanData.tsx:395-520,636-695,1770-1790`
- Modify: `src/App.tsx:86-90` (o comentário que cita o Firestore passa a citar o RLS)
- Create: `tests/db/planos.test.ts`, `tests/db/acesso.test.ts`
- Modify: os testes de `src/` que importam `caminhoDoPlano` ou o Firestore

**Interfaces:**
- Consumes: `supabase`, `UsuarioDoApp` (Tarefa 2); a estrutura da Tarefa 1.
- Produces (`src/services/planos.ts`), todas lançam o erro do banco:
  - `listarPlanos(cliente: SupabaseClient, uid: string): Promise<number[]>` (anos em ordem crescente);
  - `carregarPlano(cliente: SupabaseClient, uid: string, ano: number): Promise<Partial<DadosDoPlano> | null>`;
  - `salvarPlano(cliente: SupabaseClient, uid: string, ano: number, dados: DadosDoPlano): Promise<void>` (upsert em `(user_id, ano)`);
  - `criarPlanoSeNaoExistir(cliente: SupabaseClient, uid: string, ano: number, anoOrigem: number, iniciais: DadosDoPlano): Promise<void>`
    (lê a origem do banco, monta com `montarPlanoDoAnoSeguinte`, upsert com `ignoreDuplicates: true`).
  - `caminhoDoPlano` sai. `ANO_DO_PLANO_LEGADO` **fica**, só para `chaveLocalDoPlano` e `listarPlanosLocais` (as chaves
    do modo local não mudam).
- Produces (`src/services/acesso.ts`):
  - `ehAdministrador(cliente: SupabaseClient): Promise<boolean>` (rpc `sou_admin`; erro → `false`);
  - `obterAcesso(cliente: SupabaseClient, uid: string): Promise<Acesso | null>` (substitui `obterOuCriarAcesso`; a linha
    nasce no banco);
  - `listarAcessos(cliente: SupabaseClient): Promise<Acesso[]>` (ordem `criado_em` decrescente; `emailVerificado` vem de
    `email_verificado`);
  - `definirStatus(cliente: SupabaseClient, uid: string, status: StatusAcesso): Promise<void>` (rpc
    `definir_status_de_acesso`);
  - `quando(valor: unknown): string` passa a aceitar texto ISO; `COLECAO_*` saem.
- `checkSubscription` em `usePlanData.tsx`: `obterAcesso` devolvendo `null` (o gatilho ainda não rodou ou falhou) →
  trate como `pendente`, como hoje no erro.

- [ ] **Step 1: Testes em `tests/db/planos.test.ts`** (cliente liberado da Tarefa 1):
  - `salvarPlano` e `carregarPlano` devolvem os mesmos `dados`; `listarPlanos` → `[2026, 2027]` depois de salvar os dois;
  - `criarPlanoSeNaoExistir(…, 2027, 2026, iniciais)` copia o cadastro da origem;
  - chamar de novo depois de editar 2027 não sobrescreve a edição (duas abas);
  - `criarPlanoSeNaoExistir` para o ano UTC atual + 2 rejeita (relógio adiantado);
  - `salvarPlano` com um cliente pendente rejeita (gravação recusada não passa calada).
- [ ] **Step 2: Testes em `tests/db/acesso.test.ts`:**
  - `ehAdministrador` é `true` para o admin confirmado e `false` para o cliente;
  - `obterAcesso` de um cadastro novo → `status: 'pendente'`;
  - `listarAcessos` pelo admin traz o cadastro novo primeiro;
  - `definirStatus` pelo admin muda o status, e pelo cliente rejeita.
- [ ] **Step 3: `npm run test:db`** → Expected: FAIL (funções com a assinatura antiga).
- [ ] **Step 4: Implementar as interfaces acima e trocar as chamadas em `usePlanData.tsx`.** As proteções de hoje
  ficam: nada de autosave depois de uma carga que falhou, e o erro de salvar continua visível.
- [ ] **Step 5: `npm run test:db`, depois `npx vitest related --run src/services/planos.ts src/services/acesso.ts src/hooks/usePlanData.tsx`** → Expected: PASS.
- [ ] **Step 6: Remover o pacote `firebase` e qualquer `import` de `firebase/*` em `src/`.** Teste novo
  `src/seguranca.test.ts`: nenhum arquivo em `src/` contém `firebase/`, `service_role` ou `SERVICE_ROLE`.
  `npm run typecheck` → Expected: sem erros.
- [ ] **Step 7: Commit** `feat(dados): planos e acessos no Supabase; sai o SDK do Firebase`

### Task 4: Ambiente local, variáveis e documentação do projeto

**Files:**
- Create: `scripts/semear-local.mjs`, `supabase/seed.sql` só se o semeador precisar
- Delete: `scripts/semear-emuladores.mjs`
- Modify: `package.json` (`dev:local` → `vite --mode local`; `db:local:semear`; saem `emuladores` e
  `emuladores:semear`), `.env.example`, `.github/workflows/ci.yml` (placeholders do build), `AGENTS.md`, `vitest.config.ts`

**Interfaces:**
- Consumes: `supabase status -o env` (a mesma leitura de `tests/db/ambiente.ts`).

- [ ] **Step 1: `scripts/semear-local.mjs`** cria pela API de admin do Supabase local as contas `cliente@exemplo.com`
  (liberado) e `admin@exemplo.com` (em `admins`), as duas confirmadas, com a senha `senha-local-123`. Recusa rodar se a
  URL não for `127.0.0.1` ou `localhost`. Rodar duas vezes não duplica nada.
- [ ] **Step 2: `.env.example`:** saem as `VITE_FIREBASE_*`; entram `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=` e,
  numa seção "só para os scripts de migração, nunca com VITE_", `GOOGLE_APPLICATION_CREDENTIALS=`, `SUPABASE_URL=` e
  `SUPABASE_SERVICE_ROLE_KEY=`. O CI troca os placeholders do Firebase por `VITE_SUPABASE_URL: http://127.0.0.1:54321`
  e `VITE_SUPABASE_ANON_KEY: ci-placeholder`.
- [ ] **Step 3: `AGENTS.md`:**
  - **Stack:** Supabase.
  - **Comandos:** `test:db` no lugar de `test:rules`; o banco local passa a ser `npm run db:local` + `npm run test:db`;
    o app local passa a ser `db:local` → `db:local:semear` → `dev:local`.
  - **Caminhos sensíveis:** entram `supabase/**` e `scripts/migrar-*`/`scripts/migracao/**`.
  - **Passos só humanos:** entram `supabase db push` no PLAN26, rodar os scripts de migração contra a produção, enviar os
    e-mails, DNS e congelar ou restaurar as regras do Firebase.
  - **Deploy:** projeto `plan` no time `gestao-de-impactos-projects`, `https://plan.gestaoimpacto.com`.
  - `vitest.config.ts` também inclui `scripts/**/*.test.mjs`.
- [ ] **Step 4: Verificar como usuário:** `npm run db:local`, `npm run db:local:semear`, `npm run dev:local`; com o
  `agent-browser`, entrar como cliente e como admin, salvar, recarregar, liberar um cadastro novo e pedir "esqueci minha
  senha" (o e-mail aparece no Inbucket local, `http://127.0.0.1:54324`). Conferir no celular (390 px) e no desktop as
  telas de login, confirmação e "Defina sua senha".
- [ ] **Step 5: Commit** `chore: ambiente local com Supabase e documentação atualizada`

### Task 5: Transformação da migração (função pura)

**Files:**
- Create: `scripts/migracao/transformar.mjs`, `scripts/migracao/transformar.test.mjs`

**Interfaces:**
- Produces:
  ```ts
  type Entrada = {
    usuariosAuth: { uid: string; email: string | null; nome: string | null; provedores: string[] }[];
    admins: string[];                                   // ids dos documentos de `admins`
    acessos: { uid: string; status: string; liberadoEm: unknown; liberadoPor: string | null }[];
    documentosDeUsuario: { uid: string; campos: Record<string, unknown>; subcolecoes: string[] }[];  // users/{uid}
    planosPorAno: { uid: string; ano: string; campos: Record<string, unknown> }[];                  // users/{uid}/planos/{ano}
  };
  type Migracao = {
    usuarios: { email: string; nome: string | null; temSenha: boolean }[];
    acessos: { email: string; status: 'pendente' | 'liberado' | 'bloqueado'; liberadoEm: string | null; liberadoPor: string | null }[];
    planos: { email: string; ano: number; dados: object }[];
    admins: { email: string; temConta: boolean }[];
    avisos: string[];         // listado e não importado (ou importado com marca)
    impedimentos: string[];   // não grava nada enquanto houver um
  };
  export function transformar(entrada: Entrada): Migracao;
  export function paraJson(valor: unknown, caminho: string, impedimentos: string[]): unknown;
  ```
  `dados` leva só `planData`, `goals2026`, `scenarios2026`, `tracking2026`, `taxes` e `pricingItems` presentes; outro
  campo no documento vira aviso com o nome do campo. `paraJson` converte objeto com `toDate()` em texto ISO e registra
  um impedimento para qualquer outro valor que não seja JSON (com o caminho).

- [ ] **Step 1: Testes** (um `it` cada):
  - documento `users/u1` vira `{ ano: 2026 }`; `planos/2027` vira `{ ano: 2027 }`, os dois com o e-mail de u1;
  - e-mail `Ana@X.com` → `ana@x.com` em usuários, acessos e planos;
  - plano de uid sem usuário no Auth → aviso, fora de `planos`;
  - usuário sem e-mail → aviso, fora de `usuarios`;
  - `ana@x.com` e `ANA@x.com` em uids diferentes → impedimento;
  - admin sem conta → em `admins` com `temConta: false` e aviso;
  - acesso sem usuário → aviso;
  - `{ toDate: () => new Date('2026-03-01T12:00:00Z') }` dentro de `planData` → `'2026-03-01T12:00:00.000Z'`;
  - um valor `new Uint8Array()` → impedimento com o caminho;
  - subcoleção `rascunhos` em `users/u1` → aviso;
  - ano `'27'` → aviso, fora de `planos`;
  - provedores `['google.com']` → `temSenha: false`; `['password']` → `true`;
  - status desconhecido no acesso → `pendente` e aviso.
- [ ] **Step 2: `npx vitest run scripts/migracao/transformar.test.mjs`** → Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar de novo** → Expected: PASS.
- [ ] **Step 5: Commit** `feat(migração): transformação dos dados do Firebase para o Supabase`

### Task 6: Leitura do Firebase, gravação no Supabase e conferência

**Files:**
- Create: `scripts/migracao/ler-firebase.mjs`, `scripts/migracao/gravar-supabase.mjs`, `scripts/migracao/conferir.mjs`,
  `scripts/migrar-firebase-para-supabase.mjs`, `tests/db/migracao.test.ts`
- Modify: `package.json` (`firebase-admin` em devDependencies)

**Interfaces:**
- Consumes: `transformar`, `Entrada` e `Migracao` (Tarefa 5).
- Produces:
  - `lerFirebase(): Promise<Entrada>`: usa `firebase-admin` com `GOOGLE_APPLICATION_CREDENTIALS` (`listUsers` paginado;
    `admins`, `acessos`, `users` e as subcoleções de cada `users/{uid}` via `listCollections`). Só leitura.
  - `gravarSupabase(cliente: SupabaseClient /* service_role */, m: Migracao): Promise<{ criados: number; reaproveitados: number; planosGravados: number; planosRecusados: string[] }>`:
    - usuário existente pelo e-mail é reaproveitado; senão `auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } })`;
    - o acesso é atualizado com o status, `liberado_em` e `liberado_por`;
    - antes de gravar um plano, se a linha existe com `atualizado_em > importado_em`, ele não é gravado e entra em
      `planosRecusados`;
    - o plano é gravado com `importado_em` não nulo;
    - os admins entram por upsert.
  - `conferir(cliente: SupabaseClient, m: Migracao): Promise<{ contagens: Record<string, { esperado: number; achado: number }>; diferencas: string[] }>`
    (compara `dados` com igualdade profunda).
  - CLI `node --env-file=.env.local scripts/migrar-firebase-para-supabase.mjs [--aplicar] [--confirmo=<ref>]`:
    - sem `--aplicar`, simula e imprime só contagens, avisos e impedimentos;
    - com impedimentos, sai com código 1 sem gravar;
    - com `--aplicar` e `SUPABASE_URL` que não seja local, exige `--confirmo=` igual ao ref do projeto da URL;
    - imprime o host de destino antes de qualquer gravação.

- [ ] **Step 1: Testes em `tests/db/migracao.test.ts`** (contra o Supabase local, com uma `Migracao` montada à mão):
  - aplicar cria os usuários confirmados, os acessos com o status certo, os planos e os admins; `conferir` → sem
    diferenças;
  - aplicar duas vezes → `reaproveitados` igual ao total na segunda, sem duplicar nada;
  - editar um plano como o cliente (update normal) e aplicar de novo → esse plano em `planosRecusados`, e a edição fica;
  - um usuário migrado consegue `resetPasswordForEmail` e, com a nova senha, lê o próprio plano.
- [ ] **Step 2: `npm run test:db`** → Expected: FAIL.
- [ ] **Step 3: Implementar.** `lerFirebase` não tem teste automático (precisaria da produção); fica coberto pela
  simulação na virada.
- [ ] **Step 4: `npm run test:db`** → Expected: PASS.
- [ ] **Step 5: Commit** `feat(migração): script de importação com simulação e conferência`

### Task 7: E-mails "crie sua senha" e regras do Firebase

**Files:**
- Create: `scripts/enviar-criar-senha.mjs`, `scripts/regras-do-firebase.mjs`, `firestore.congelado.rules`
- Modify: `.gitignore` (`firestore.no-ar.rules`)

**Interfaces:**
- `node --env-file=.env.local scripts/enviar-criar-senha.mjs [--enviar] [--confirmo=<ref>]`:
  - lista no Firebase Auth quem tem o provedor `password` e existe no Supabase;
  - sem `--enviar`, mostra só a contagem;
  - com `--enviar`, chama `resetPasswordForEmail(email, { redirectTo: 'https://plan.gestaoimpacto.com' })` em lotes de
    10, com 30 s entre os lotes, e imprime quantos foram enviados e quantos falharam, sem os e-mails.
- `node --env-file=.env.local scripts/regras-do-firebase.mjs <salvar|congelar|restaurar>`, com `firebase-admin/security-rules`:
  - `salvar` grava as regras no ar em `firestore.no-ar.rules`;
  - `congelar` publica `firestore.congelado.rules` (`allow read: if <as condições de leitura de hoje>; allow write: if false`),
    e recusa se `firestore.no-ar.rules` não existir;
  - `restaurar` publica `firestore.no-ar.rules`.
- `firestore.congelado.rules`: igual ao `firestore.rules` do repositório nas leituras, com toda escrita negada.

- [ ] **Step 1: Teste** `scripts/regras.test.mjs`: o texto de `firestore.congelado.rules` não contém nenhum `allow`
  com `write`, `create`, `update` ou `delete` cuja condição não seja `false`.
- [ ] **Step 2: Rodar** → FAIL; **implementar**; **rodar** → PASS.
- [ ] **Step 3: Commit** `feat(migração): envio dos e-mails de senha e congelamento das regras do Firebase`

### Task 8: Roteiro da virada

**Files:**
- Create: `docs/VIRADA-SUPABASE.md`

Roteiro em português, na ordem da seção 4 da especificação. Cada passo traz o comando ou a tela exata, quem faz e
como conferir. Marque com **[humano]** os passos só humanos. O roteiro inclui:
- valores do painel do Supabase: Site URL, endereços permitidos, provedor Google (com o endereço de retorno), SMTP,
  confirmação de e-mail ligada e textos dos e-mails "Confirme seu e-mail" e "Defina sua senha";
- criação do projeto `plan` na Vercel (`vercel link --scope gestao-de-impactos-projects`) e das variáveis;
- DNS: CNAME de `plan` e TXT de verificação do `plan2026`, com o redirecionamento 308;
- teste na prévia: cadastro, confirmação, liberação, Google **com uma conta que já existe no Firebase, conferindo que
  cai na conta migrada**, salvar, recarregar e "esqueci minha senha";
- o texto sugerido do aviso aos clientes;
- a sequência `regras salvar` → `regras congelar` → importação simulada → `--aplicar --confirmo=aixjmxfkaziqlxnpudkk`
  → conferência → domínios → e-mails → teste final;
- a volta atrás (`regras restaurar` e o domínio devolvido) e até quando ela não perde dados;
- o "depois": revogar a chave, a entrega de limpeza e a pausa do projeto antigo.

- [ ] **Step 1: Escrever o roteiro.**
- [ ] **Step 2: Commit** `docs: roteiro da virada para o Supabase`

## Passos só humanos (antes da virada, aprovados no roteiro)

Nenhum durante a execução deste plano. Os da especificação (aplicar no PLAN26, painel, segredos, scripts na produção,
deploy, DNS, regras e e-mails) acontecem depois do `/ship`, pelo roteiro da Tarefa 8, cada um com o "sim" do usuário.

## Condições de parada

- Um fluxo legítimo depende de algo que o RLS nega (por exemplo, um pendente que precisa gravar): pare e relate.
- O Supabase local não sobe ou falta memória: pare e relate; não rode dois pesados juntos.
- Um teste existente de `src/` depende do Firestore de um jeito que não cabe nas interfaces acima: pare e relate.
