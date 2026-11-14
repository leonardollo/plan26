# Assinatura anual pela Hotmart — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans, as the implementer subagent the main session dispatches, to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O pagamento confirmado na Hotmart libera o PLAN por um ano, sozinho; a tela de acesso mostra o plano anual e leva ao checkout.

**Architecture:** Migração nova com `acessos.acesso_ate`, a tabela `pagamentos_hotmart` e a função `aplicar_pagamento_hotmart`, que concentra a regra numa transação. Edge Function `hotmart-webhook` (sem JWT, protegida pelo hottok) lê o aviso, cria a conta quando falta, chama a função e manda o "Defina sua senha". O app lê o prazo para decidir a tela e mostra o cartão do plano com o link vindo de variáveis da Vercel.

**Tech Stack:** Postgres/Supabase (RLS, `security definer`), Edge Functions em Deno, React 19 + Vite 7 + TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-13-assinatura-hotmart-design.md` — leia inteira antes da Task 1; os exemplos numerados (1–14) são citados abaixo por número.

## Global Constraints

- Branch: `feat/assinatura-hotmart` (já existe, com a spec). Commits em inglês no padrão do repo (`feat:`, `test:`, `fix:`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Textos de tela em português com acentos. Copy fixa: "Plano anual — R$ X/ano", "Assinar", "Assinaturas abrem em breve", "Pague com este mesmo e-mail; o acesso libera em poucos minutos", "Já paguei, verificar", "Sem prazo", "Vencido em dd/mm/aaaa", "Liberar sem prazo", "Fale com a Gestão de Impacto".
- `null` em `acesso_ate` = sem prazo. Prazo vale enquanto `acesso_ate > now()`.
- Um ano = `interval '1 year'` no Postgres (nunca 365 dias).
- Registro: `registro_admin.admin_email = 'hotmart'` para tudo que vem do webhook.
- `pagamentos_hotmart` sem CPF, telefone, endereço ou valor: só os campos da spec.
- Segredos da função: `HOTMART_HOTTOK`, `HOTMART_PRODUTO_ID`. Variáveis do app: `VITE_HOTMART_CHECKOUT_URL`, `VITE_PRECO_ANUAL`.
- Checkout aceito só se `https:` e host `pay.hotmart.com`.
- RAM de 16 GB: um comando pesado por vez; rode só os testes afetados (`npx vitest related --run <arquivos>`) e `npm run test:db` no fim das tasks de banco. Antes de algo pesado: `pgrep -fl "tsc|vitest|next build|playwright"`.
- Caminhos sensíveis em todo o plano; nunca leia `.env*` reais; nunca rode nada contra o PLAN26 (`aixjmxfkaziqlxnpudkk`): só Supabase local.
- **Passos humanos, fora deste plano:** `supabase db push`, `supabase functions deploy`, segredos, Hotmart, variáveis e deploy da Vercel, merge.
- **Condição de parada:** se um fluxo legítimo existente (login, cadastro, área admin, abrir plano de cliente) quebrar por causa do prazo, pare e relate em vez de contornar.

## Review Focus

1. Hotmart reenvia o aviso depois de um 500 no meio do caminho (conta criada, RPC falhou) → o retry tem de liberar **e** mandar o "Defina sua senha" (a conta nunca entrou). Teste na Task 3 (`envia senha no retry quando a conta nunca entrou`).
2. Corpo enorme ou método diferente de POST → 413/405 sem ler/gravar nada. Teste na Task 3.
3. E-mail da compra com maiúsculas/espaços, ou um e-mail que já existe no Auth com outra caixa → acha a mesma conta. Testes nas Tasks 1 e 3.
4. Admin com prazo vencido (ex.: comprou antes de virar admin) → admin nunca é barrado. Teste na Task 1 (`posso_usar_o_espaco` para admin vencido) e Task 4.
5. Variável de checkout com valor estranho (`http://`, outro domínio, texto solto) → tratado como ausente, nunca vira link. Teste na Task 4.

---

### Task 1: Migração — prazo, pagamentos e a regra no banco

**Files:**
- Create: `supabase/migrations/20261113020000_assinatura_hotmart.sql`
- Create: `tests/db/assinatura.test.ts`

**Interfaces:**
- Produces:
  - coluna `public.acessos.acesso_ate timestamptz null`;
  - tabela `public.pagamentos_hotmart(transacao text pk, email text not null, situacao text check in ('aprovada','estornada')` — a `ignorada` da spec sai: avisos ignorados não são gravados, só logados —`, evento text not null, user_id uuid null references auth.users on delete set null, mexeu_no_prazo boolean not null default false, recebido_em timestamptz not null default now(), alterado_em timestamptz not null default now())`, RLS ligada, sem políticas, `revoke all` de `anon, authenticated`;
  - `public.aplicar_pagamento_hotmart(p_transacao text, p_email text, p_tipo text, p_evento text) returns jsonb` — `security definer`, `set search_path = ''`, `execute` só para `service_role`. Retorno: `{"resultado": R, "user_id": uuid|null, "antes": timestamptz|null, "depois": timestamptz|null}` com `R` ∈ `liberou` (pendente → liberado) · `estendeu` · `sem_prazo` · `conta_barrada` (bloqueado/removido) · `sem_conta` · `repetido` · `estornou` · `estorno_sem_efeito`;
  - `public.admin_tirar_prazo(alvo uuid) returns void` — só admin (`sou_admin()`, senão `42501`), põe `acesso_ate = null`, Registro `'tirou prazo'` com `{"antes": ...}` via `_registrar`. Grant para `authenticated`. (É o `admin_definir_prazo` da spec, só com o caso que existe.)
  - `posso_usar_o_espaco()` recriada (`create or replace`) com `status = 'liberado' and (acesso_ate is null or acesso_ate > now())`, mantendo o `or public.sou_admin()`.

Regras de `aplicar_pagamento_hotmart` (as da spec, seção "Regras do aviso"):
- `p_email` normalizado com `lower(trim())`; a conta é achada em `auth.users` por `lower(email)` (é único lá; `acessos.email` não é), e a linha de `acessos` é travada com `for update`.
- A transação é travada/criada primeiro (`insert ... on conflict do nothing` + `select ... for update`), para que dois avisos da mesma transação se enfileirem.
- `aprova`: transação já existente (qualquer situação) → `repetido`. Senão aplica a regra por status, grava a transação `aprovada` com `mexeu_no_prazo` (true em `liberou`/`estendeu`) e o `user_id`. `liberou` também põe `liberado_em = now()`, `liberado_por = 'hotmart'`, `alterado_no_app_em = now()`. Sem conta → `sem_conta`, **sem gravar a transação** (a Edge Function cria a conta e chama de novo).
- `estorna`: transação inexistente → grava `estornada` sem `user_id`, `estorno_sem_efeito`. `aprovada` com `mexeu_no_prazo` e prazo não nulo → `acesso_ate - interval '1 year'`, `estornou`. `aprovada` sem efeito, conta sem prazo, ou já `estornada` → marca `estornada` (se não estava), `estorno_sem_efeito`.
- `p_tipo` fora de `aprova`/`estorna` → `raise exception` (`22023`).
- Toda mudança de `acesso_ate` ou `status`, e todo `conta_barrada`, insere em `registro_admin` com `admin_email = 'hotmart'`, `acao` (`'pagamento liberou'`, `'pagamento estendeu'`, `'pagamento de conta barrada'`, `'estorno'`), `alvo`, `alvo_email` e `detalhe = {"transacao", "evento", "antes", "depois"}`.
- Comentário de uma linha no topo do arquivo: por que a regra mora no banco (trava + chave única na mesma transação).

- [ ] **Step 1: Escreva `tests/db/assinatura.test.ts`** com os helpers de `tests/db/ambiente.ts` (`clienteServico`, `criarPessoa`, `emailUnico`). O banco não deixa fixar "hoje": monte cada caso gravando `acesso_ate` relativo ao relógio (ex.: `Date.now() + 30 dias`) pela service role e compare `depois - antes` ou `depois` contra `Date.now() + 1 ano`, com tolerância de 1 min. Testes:
  - `ex1/ex4: aprova estende a partir do maior entre agora e o prazo` — conta liberada com prazo em +30 dias → `estendeu`, `depois - antes = 1 ano`; conta com prazo vencido há 60 dias → `depois` ≈ `now() + 1 ano` (tolerância 1 min).
  - `ex2/ex3: mesma transação conta uma vez` — `PURCHASE_APPROVED` e depois `PURCHASE_COMPLETE` com a mesma transação → segundo `repetido`, prazo inalterado.
  - `pendente vira liberado por um ano` — `liberou`, `status = 'liberado'`, `liberado_por = 'hotmart'`.
  - `e-mail com caixa e espaços acha a conta` — `'  ' + email.toUpperCase() + ' '` → mesma `user_id`.
  - `ex6: estorno da renovação devolve o prazo`; `ex7: estorno que cai no passado vence na hora` (prazo resultante `< now()`, e `posso_usar_o_espaco()` com o token da pessoa → `false`).
  - `ex8: sem prazo continua sem prazo` (`sem_prazo`, `acesso_ate` null) e o estorno dela → `estorno_sem_efeito`, ainda null.
  - `ex9: conta bloqueada ou removida não reabre` → `conta_barrada`, status inalterado, uma linha em `registro_admin` com `acao = 'pagamento de conta barrada'`.
  - `ex12: estorno antes da aprovação anula a aprovação` → `estorno_sem_efeito`, depois `aprova` da mesma transação → `repetido`.
  - `ex13: duas transações ao mesmo tempo` — `Promise.all` de duas `aprova` com transações diferentes na mesma conta pendente → prazo final `now() + 2 anos` (tolerância 1 min).
  - `sem conta devolve sem_conta e não grava a transação`.
  - `posso_usar_o_espaco: vencido barra, futuro passa, admin vencido passa` e `planos: cliente vencido não lê nem grava o próprio plano`.
  - `permissões: authenticated e anon não leem pagamentos_hotmart nem executam aplicar_pagamento_hotmart`; `admin_tirar_prazo: cliente recebe 42501; admin tira o prazo e o Registro mostra 'tirou prazo'`.
  - `tipo inválido dá erro`.
- [ ] **Step 2:** `npm run db:local` (se não estiver no ar) e `npx vitest run --config vitest.db.config.ts tests/db/assinatura.test.ts` → falha (coluna/função inexistente).
- [ ] **Step 3:** Escreva a migração com as interfaces acima.
- [ ] **Step 4:** `npm run test:db` → todos passam, inclusive os arquivos antigos (`permissoes`, `planos`, `admin-*`).
- [ ] **Step 5:** Commit `feat: hotmart payments extend access in the database`.

### Task 2: Leitura do aviso da Hotmart (funções puras)

**Files:**
- Create: `supabase/functions/hotmart-webhook/aviso.ts`
- Create: `supabase/functions/hotmart-webhook/aviso.test.ts`

**Interfaces:**
- Consumes: `normalizarEmail(bruto: unknown): string | null` de `../admin-usuarios/regras.ts`.
- Produces:
  - `export type TipoDoAviso = 'aprova' | 'estorna' | 'ignora'`
  - `export type Aviso = { evento: string; tipo: TipoDoAviso; transacao: string | null; email: string | null; produtoId: string | null }`
  - `export function lerAviso(payload: unknown): Aviso`
  - `export function tokenConfere(recebido: string, esperado: string): boolean` (tempo constante: percorre o maior comprimento, acumula XOR; comentário de uma linha dizendo por quê)
  - `export const TAMANHO_MAXIMO_DO_CORPO = 100_000`

Caminhos de leitura e eventos: os da spec. `tipo = 'aprova'` só com evento em {`PURCHASE_APPROVED`, `PURCHASE_COMPLETE`} **e** status em {`APPROVED`, `COMPLETE`, `COMPLETED`}; `'estorna'` com {`PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK`}; o resto `'ignora'`. Ids numéricos viram texto; valores com caractere de controle são limpos e cortados em 64 (transação e produto).

- [ ] **Step 1: Testes em `aviso.test.ts`:**
  - `aprova só com evento e status pagos` — `PURCHASE_APPROVED`+`APPROVED` → `aprova`; `PURCHASE_APPROVED`+`WAITING_PAYMENT` → `ignora`; `PURCHASE_COMPLETE`+`COMPLETED` → `aprova`.
  - `estorno e chargeback estornam`; `ex14: cancelamento, atraso, troca de data e boleto impresso são ignorados` (`PURCHASE_CANCELED`, `PURCHASE_DELAYED`, `SUBSCRIPTION_CANCELLATION`, `UPDATE_SUBSCRIPTION_CHARGE_DATE`, `PURCHASE_BILLET_PRINTED`).
  - `e-mail de data.buyer.email, senão data.subscriber.email, normalizado` — `' Ana@X.com '` → `'ana@x.com'`.
  - `produto numérico vira texto e vem de data.product.id ou alternativas` — `{data:{product:{id: 123}}}` → `'123'`; `{data:{purchase:{product:{id:'9'}}}}` → `'9'`.
  - `payload estranho não estoura` — `null`, `[]`, `'x'`, `{data: 5}` → `{tipo:'ignora', transacao:null, email:null, produtoId:null}`.
  - `transação com quebra de linha é limpa e cortada em 64`.
  - `tokenConfere` — igual → true; diferente, prefixo, vazio → false.
- [ ] **Step 2:** `npx vitest related --run supabase/functions/hotmart-webhook/aviso.ts` → falha.
- [ ] **Step 3:** Implemente `aviso.ts` (sem imports do Deno, como `admin-usuarios/regras.ts`).
- [ ] **Step 4:** Mesmo comando → passa.
- [ ] **Step 5:** Commit `feat: parse hotmart webhook payloads`.

### Task 3: Edge Function `hotmart-webhook`

**Files:**
- Create: `supabase/functions/hotmart-webhook/fluxo.ts`, `fluxo.test.ts`, `index.ts`
- Create: `supabase/functions/local.env` (valores falsos: `HOTMART_HOTTOK=hottok-local-de-teste`, `HOTMART_PRODUTO_ID=900001`, com a linha `# Valores falsos, só para o Supabase local e a CI.`)
- Modify: `supabase/config.toml` (bloco `[functions.hotmart-webhook]` com `verify_jwt = false` e comentário de uma linha: a Hotmart não manda JWT; quem protege é o hottok)
- Modify: `.github/workflows/ci.yml` (o passo de serve passa a servir todas as funções com o env falso)
- Modify: comentário de cabeçalho de `tests/db/admin-usuarios.test.ts` (novo comando de serve)
- Create: `tests/db/hotmart-webhook.test.ts`

**Interfaces:**
- Consumes: `lerAviso`, `tokenConfere`, `TAMANHO_MAXIMO_DO_CORPO` (Task 2); RPC `aplicar_pagamento_hotmart` (Task 1); `URL_DO_APP` de `../admin-usuarios/regras.ts`.
- Produces:
  ```ts
  export interface DependenciasDoWebhook {
    hottok: string | null;          // Deno.env HOTMART_HOTTOK
    produtoId: string | null;       // Deno.env HOTMART_PRODUTO_ID
    aplicar(transacao: string, email: string, tipo: 'aprova' | 'estorna', evento: string): Promise<ResultadoDoBanco>;
    criarConta(email: string): Promise<{ id: string } | { jaExiste: true }>;
    nuncaEntrou(userId: string): Promise<boolean>;    // auth.admin.getUserById → last_sign_in_at == null
    enviarEmailDeSenha(email: string): Promise<boolean>;
    registrarFalhaDeEmail(userId: string, email: string, transacao: string): Promise<void>; // registro_admin, acao 'e-mail de senha não saiu'
  }
  export type ResultadoDoBanco = { resultado: string; user_id: string | null; antes: string | null; depois: string | null };
  export type PedidoDoWebhook = { metodo: string; hottok: string | null; tamanho: number | null; corpo: string };
  export async function atenderWebhook(p: PedidoDoWebhook, d: DependenciasDoWebhook): Promise<{ status: number; corpo: unknown }>;
  ```

Ordem em `atenderWebhook`: método ≠ POST → 405 · `tamanho` ou `corpo.length` > máximo → 413 · `hottok` não configurado → 500 · `tokenConfere` falso → 401 · JSON inválido → 400 · `produtoId` ausente ou diferente → 200 `{ignorado:'produto'}` · `ignora` ou sem transação/e-mail → 200 `{ignorado:...}` · `aplicar`; se `sem_conta` (só em `aprova`): `criarConta`, depois `aplicar` de novo · se `resultado === 'liberou'` e `nuncaEntrou` → `enviarEmailDeSenha`; `false` → `registrarFalhaDeEmail` e ainda 200 · erro do banco ou do Auth → 500 (a Hotmart reenvia). Respostas sem detalhe interno; logs sem o hottok e sem o payload inteiro (só evento, transação e resultado). `index.ts` só liga o Deno (`Deno.serve`, `createClient` com a service role, `resetPasswordForEmail(email, { redirectTo: URL_DO_APP })`) a `atenderWebhook`.

- [ ] **Step 1: Testes de unidade em `fluxo.test.ts`** (dependências falsas):
  - `ex11: segredo ausente → 500 e nada chamado`; `hottok errado ou vazio → 401 e nada chamado`.
  - `método GET → 405`; `corpo acima do limite → 413 e nada chamado`; `JSON inválido → 400`.
  - `ex10: outro produto ou HOTMART_PRODUTO_ID ausente → 200 e aplicar não é chamado`.
  - `ex1: sem conta → cria, aplica de novo, manda a senha uma vez`.
  - `ex2: aviso repetido (resultado repetido) → não manda e-mail`.
  - `envia senha no retry quando a conta nunca entrou` — 1ª chamada: `aplicar` lança depois de `criarConta` → 500; 2ª chamada: `aplicar` devolve `liberou`, `nuncaEntrou` true → e-mail enviado.
  - `pendente que já entrou e paga → libera sem mandar e-mail`.
  - `e-mail que não saiu → 200 e registrarFalhaDeEmail chamado`.
  - `estorno nunca cria conta` (`sem_conta` em `estorna` não ocorre; `criarConta` não é chamada).
- [ ] **Step 2:** `npx vitest related --run supabase/functions/hotmart-webhook/fluxo.ts` → falha; implemente `fluxo.ts`; mesmo comando → passa.
- [ ] **Step 3:** Escreva `index.ts`, o `local.env`, o bloco no `config.toml`, e troque o passo da CI para:
  `nohup npx supabase functions serve --no-verify-jwt --env-file supabase/functions/local.env > functions-serve.log 2>&1 &`, com a espera conferindo `admin-usuarios` **e** `hotmart-webhook` (mesmo laço, as duas URLs). Renomeie o passo para "Serve the Edge Functions".
- [ ] **Step 4: Teste de integração `tests/db/hotmart-webhook.test.ts`** (POST real em `${API_URL}/functions/v1/hotmart-webhook` com `x-hotmart-hottok: hottok-local-de-teste`, produto `900001`, e-mails via Mailpit como em `admin-usuarios.test.ts`):
  - `sem hottok → 401; hottok errado → 401` e nada em `pagamentos_hotmart`.
  - `ex1: e-mail novo com caixa e espaço cria a conta liberada por um ano e manda um e-mail de senha` (Mailpit: exatamente 1 mensagem para o e-mail).
  - `ex2: o mesmo aviso de novo não manda outro e-mail`.
  - `ex13: dois avisos simultâneos de transações diferentes para o mesmo e-mail novo → uma conta, dois anos`.
  - `ex10: outro produto → 200 e nada gravado`.
- [ ] **Step 5:** Em outro terminal (background), `npx supabase functions serve --no-verify-jwt --env-file supabase/functions/local.env`; depois `npm run test:db` → tudo passa. Pare o serve no fim.
- [ ] **Step 6:** Commit `feat: hotmart webhook edge function`.

### Task 4: App — prazo vencido e configuração do checkout

**Files:**
- Modify: `src/services/acesso.ts` (`acesso_ate` em `COLUNAS`, `LinhaDeAcesso`; `Acesso.acessoAte?: string | null`)
- Modify: `src/utils/telaDoApp.ts`, `src/utils/telaDoApp.test.ts`
- Modify: `src/hooks/usePlanData.tsx` (só a linha ~713-715: passar o prazo; leia por faixa)
- Create: `src/utils/checkout.ts`, `src/utils/checkout.test.ts`
- Modify: `src/vite-env.d.ts` (as duas variáveis em `ImportMetaEnv`, opcionais); `.env.example` (as duas variáveis vazias, com comentário de uma linha)

**Interfaces:**
- Produces:
  - `situacaoDoAcesso(status: StatusAcesso, acessoAte?: string | null, agora?: Date): SubscriptionStatus` — `liberado` com `acessoAte` e `new Date(acessoAte) <= agora` → `'expired'`; o resto como hoje.
  - `export type ConfigDoCheckout = { url: string; preco: string | null }`
  - `export function configDoCheckout(env: { VITE_HOTMART_CHECKOUT_URL?: string; VITE_PRECO_ANUAL?: string }): ConfigDoCheckout | null`
  - `export function linkDoCheckout(config: ConfigDoCheckout, email?: string | null): string` — acrescenta `email` como parâmetro de busca (via `URL`), preservando os parâmetros existentes.
  - `export const CHECKOUT = configDoCheckout(import.meta.env)` no mesmo arquivo, para as telas.

- [ ] **Step 1: Testes:**
  - `telaDoApp.test.ts`: `liberado com prazo futuro → active`; `liberado com prazo vencido → expired` (agora = `2027-03-10T12:00:00Z`, prazo `2027-03-10T11:59:59Z`); `liberado sem prazo → active`; `bloqueado com prazo futuro → inactive`; `prazo exatamente agora → expired`.
  - `checkout.test.ts`: `link válido com preço` → `{url, preco:'R$ 497'}`; `sem link → null`; `http://pay.hotmart.com/X → null`; `https://evil.com/pay.hotmart.com → null`; `texto solto → null`; `preço vazio → preco null`; `linkDoCheckout acrescenta o e-mail codificado e mantém ?off=abc` (`https://pay.hotmart.com/X?off=abc` + `a+b@x.com` → contém `off=abc` e `email=a%2Bb%40x.com`); `sem e-mail → url inalterada`.
- [ ] **Step 2:** `npx vitest related --run src/utils/telaDoApp.ts src/utils/checkout.ts` → falha; implemente; → passa.
- [ ] **Step 3:** Em `usePlanData.tsx`, troque a leitura para guardar o `Acesso` e chamar `situacaoDoAcesso(acesso?.status ?? 'pendente', acesso?.acessoAte)`. O ramo do admin (antes) não muda: admin nunca vê `expired`.
- [ ] **Step 4:** `npx vitest related --run src/hooks/usePlanData.tsx src/services/acesso.ts` → passa; `npm run typecheck` → sem erros.
- [ ] **Step 5:** Commit `feat: expire access by date and read checkout config`.

### Task 5: Telas — cartão do plano, pendente, vencido e Administração

**Files:**
- Create: `src/components/CartaoAssinatura.tsx`, `src/components/CartaoAssinatura.test.tsx`
- Modify: `src/components/Login.tsx`, `src/components/Login.test.tsx`
- Modify: `src/components/AguardandoLiberacao.tsx`, `src/components/AguardandoLiberacao.test.tsx`
- Modify: `src/components/SubscriptionExpiredPage.tsx` (tirar o placeholder da linha ~56)
- Modify: `src/components/admin/AbaClientes.tsx`, `AbaClientes.test.tsx`; `src/services/adminUsuarios.ts` ou o serviço que a aba usa (chamada `admin_tirar_prazo`)
- Create: `src/utils/prazo.ts`, `src/utils/prazo.test.ts`

**Interfaces:**
- Consumes: `CHECKOUT`, `linkDoCheckout`, `ConfigDoCheckout` (Task 4); `Acesso.acessoAte` (Task 4); RPC `admin_tirar_prazo(alvo uuid)` (Task 1); `authService.emailAtual()` e `usePlan().checkSubscription()` (existentes).
- Produces:
  - `CartaoAssinatura: React.FC<{ config: ConfigDoCheckout | null; email?: string | null; mostrarAvisoDoEmail?: boolean }>` — com `config`: título "Plano anual — {preco}/ano" (sem preço: "Plano anual"), a linha "Planejamento estratégico, comercial e financeiro completo, por um ano.", botão-link "Assinar" (`target="_blank" rel="noopener noreferrer"`, `href = linkDoCheckout(config, email)`), e, com `mostrarAvisoDoEmail`, "Pague com este mesmo e-mail; o acesso libera em poucos minutos". Sem `config`: "Assinaturas abrem em breve" e nenhum link.
  - `rotuloDoPrazo(acessoAte: string | null | undefined, agora?: Date): string` → "Sem prazo" | "dd/mm/aaaa" | "Vencido em dd/mm/aaaa", data em `pt-BR` com `timeZone: 'America/Sao_Paulo'`.
  - `tirarPrazo(cliente: SupabaseClient, alvo: string): Promise<void>` no serviço da área admin.

- [ ] **Step 1: Testes:**
  - `CartaoAssinatura.test.tsx`: `com link mostra preço e Assinar com o e-mail no href`; `sem preço mostra só Plano anual`; `sem config mostra Assinaturas abrem em breve e nenhum link`; `aviso do e-mail só com mostrarAvisoDoEmail`.
  - `Login.test.tsx`: `mostra o cartão do plano` (com `CHECKOUT` simulado via `vi.mock('../utils/checkout')`).
  - `AguardandoLiberacao.test.tsx`: `pendente vê o cartão com o próprio e-mail e o aviso`; `o botão Já paguei, verificar chama checkSubscription`; `bloqueado e removido não veem o cartão`.
  - `prazo.test.ts`: `null → Sem prazo`; `2028-03-10T03:00:00Z futuro → 10/03/2028`; `vencido → Vencido em 01/01/2027`; `2028-03-10T02:00:00Z mostra 09/03/2028` (fuso de São Paulo).
  - `AbaClientes.test.tsx`: `mostra a coluna Acesso até`; `Liberar sem prazo só aparece para conta com prazo e chama tirarPrazo`.
- [ ] **Step 2:** `npx vitest related --run <os arquivos acima>` → falham.
- [ ] **Step 3:** Implemente. No `AguardandoLiberacao`, renomeie o botão de conferir existente para "Já paguei, verificar" só quando houver `config`; o texto de espera atual continua. Na `SubscriptionExpiredPage`, o botão usa `linkDoCheckout(CHECKOUT, emailAtual)`; sem `CHECKOUT`, "Fale com a Gestão de Impacto" sem link. Na `AbaClientes`, a coluna segue o padrão das colunas existentes (incluindo o layout de celular, se a aba tiver um).
- [ ] **Step 4:** Mesmo comando → passa; `npm run typecheck` → sem erros.
- [ ] **Step 5: No navegador** (skill `agent-browser`, sessão própria; `npm run db:local`, `npm run db:local:semear`, `npm run dev:local` com `VITE_HOTMART_CHECKOUT_URL=https://pay.hotmart.com/TESTE VITE_PRECO_ANUAL="R$ 497"` no comando, **não** num `.env`): Login, conta pendente, conta vencida (ajuste `acesso_ate` no banco local pela service role) e a aba Clientes, a 390 px e no desktop; e o Login sem as variáveis ("Assinaturas abrem em breve"). Guarde as capturas no scratchpad e cite os caminhos no relatório.
- [ ] **Step 6:** Commit `feat: subscription card, expired access and admin deadline column`.

### Task 6: Fechamento do implementador

**Files:** nenhum. `docs/LOG.md` fica para o `/ship`. Relate ao orquestrador: commits, resultados dos testes, decisões tomadas onde o plano deixou escolha, e qualquer desvio.

- [ ] **Step 1:** Rode `npx vitest related --run` com todos os arquivos alterados e `npm run test:db` (com o serve no ar) uma última vez; anote as linhas de resultado.
- [ ] **Step 2:** Relate em ≤ 10 linhas.
