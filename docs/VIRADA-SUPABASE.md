# Roteiro da virada: Firebase → Supabase (PLAN26) e Vercel do GI

Especificação: `docs/superpowers/specs/2026-11-12-migracao-supabase-design.md` (seção 4).
Destino: Supabase **PLAN26** (`aixjmxfkaziqlxnpudkk`) e projeto Vercel **`plan`** no time `gestao-de-impactos-projects`,
em `https://planejamento.gestaoimpacto.com`. O Firebase (`plan-ea4cc`) **não é apagado** em nenhum passo.

**[humano]** = passo só humano: o agente para, mostra o comando e espera o "sim" do usuário na hora.
Os comandos rodam na raiz do repositório, no `main` já com esta entrega (deploy só do que está no `main`).

## 0. Credenciais no `.env.local` [humano]

O usuário coloca, e o agente nunca lê:

| Variável | De onde vem |
|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS` | caminho do JSON de uma conta de serviço do Firebase `plan-ea4cc` (Console do Firebase → Configurações do projeto → Contas de serviço → Gerar nova chave privada). Revogada no fim (seção 5). |
| `SUPABASE_URL` | `https://aixjmxfkaziqlxnpudkk.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | painel do PLAN26 → Project Settings → API Keys → `service_role` (ou a secret key). Nunca com `VITE_`. |

## 1. Antes, sem afetar ninguém

### 1.1 Estrutura no PLAN26 [humano]

```
npx supabase link --project-ref aixjmxfkaziqlxnpudkk
npx supabase db push --remote
```

Sem `--remote` o CLI 3 aplica no banco local. Ele pede confirmação; rodado por agente, exige `--yes`.

Conferir: no painel, Table Editor mostra `admins`, `acessos` e `planos` com RLS ligado (cadeado), e
Database → Functions mostra `sou_admin`, `posso_usar_o_espaco` e `definir_status_de_acesso`.

### 1.2 Painel do Supabase (PLAN26) [humano]

**Authentication → URL Configuration**
- Site URL: `https://planejamento.gestaoimpacto.com`
- Redirect URLs:
  - `https://planejamento.gestaoimpacto.com/**`
  - `https://plan-*-gestao-de-impactos-projects.vercel.app/**` (prévias da Vercel)
  - `http://localhost:5173/**`

**Authentication → Sign In / Providers**
- Email: ligado; **Confirm email ligado**; tamanho mínimo da senha 6 (o mesmo de `SENHA_MINIMA` no app).
- Google: ligado, com o Client ID e o Client Secret de um cliente OAuth do tipo "Aplicativo da Web" no Google Cloud
  (o projeto `plan-ea4cc` já tem a tela de consentimento; ele não é apagado). No cliente OAuth:
  - Origens JavaScript autorizadas: `https://planejamento.gestaoimpacto.com`
  - URI de redirecionamento autorizado: `https://aixjmxfkaziqlxnpudkk.supabase.co/auth/v1/callback`

**Authentication → Emails → SMTP Settings**: SMTP próprio do GI (host, porta, usuário, senha), remetente
`PLAN · Gestão de Impacto` com um endereço do domínio `gestaoimpacto.com`. Sem SMTP próprio o Supabase manda poucos
e-mails por hora, e os ~40 "crie sua senha" não saem.
**Authentication → Rate Limits**: e-mails por hora ≥ 60.

**Authentication → Emails → Templates**

*Confirm signup*, assunto `Confirme seu e-mail no PLAN`:

```html
<h2>Confirme seu e-mail</h2>
<p>Olá! Para terminar seu cadastro no PLAN, da Gestão de Impacto, confirme seu e-mail:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar meu e-mail</a></p>
<p>Depois disso, um administrador libera o seu acesso. Se não foi você, ignore esta mensagem.</p>
```

*Reset password*, assunto `Defina sua senha do PLAN`:

```html
<h2>Defina sua senha</h2>
<p>O PLAN, da Gestão de Impacto, mudou de endereço: agora é <strong>planejamento.gestaoimpacto.com</strong>.
Seus planos já estão lá. Para entrar, defina uma senha:</p>
<p><a href="{{ .ConfirmationURL }}">Definir minha senha</a></p>
<p>Se você entra com o Google, não precisa de senha: use "Entrar com Google". Se não pediu, ignore esta mensagem.</p>
```

Conferir: Authentication → Providers mostra Email (confirmação ligada) e Google ligados.

### 1.3 Projeto na Vercel

Agente (sem efeito para clientes):

```
vercel link --scope gestao-de-impactos-projects
```

Criar o projeto `plan` (framework Vite, instalação `npm ci`, build `npm run build`, saída `dist`, Node 24.x). A
instalação é `npm ci` porque o `pnpm-lock.yaml` velho faria a Vercel usar o pnpm. Antes do primeiro deploy, a proteção do
projeto vai para **todos os endereços** (`ssoProtection.deploymentType = "all"`): o primeiro deploy de um projeto novo vira
produção mesmo sem `--prod`, e a proteção padrão deixa aberto o endereço `plan-*.vercel.app` de produção, ligado ao PLAN26.
Variáveis, em Production e Preview:

```
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_URL preview
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add VITE_SUPABASE_ANON_KEY preview
```

Valores: `https://aixjmxfkaziqlxnpudkk.supabase.co` e a chave pública `sb_publishable_dBg8bB4xBbSK6TzcFKCSIA_a9KjnmEZ`
(as duas públicas). **[humano]** `VITE_API_KEY` (Gemini), nos dois ambientes.

Prévia: `vercel deploy --target preview`, de uma cópia limpa do `main` (`git worktree add --detach <pasta> origin/main`,
para não subir `.env.local` nem arquivos fora do git) → anotar a URL `https://plan-…-gestao-de-impactos-projects.vercel.app`.
Abrir exige login na Vercel com uma conta do time.

Feito em 2026-11-13: projeto criado, variáveis públicas definidas, proteção em todos os endereços. O primeiro deploy
(`caec7f1`) saiu como produção e ficou uns 3 minutos aberto em `plan-*.vercel.app` antes da proteção; o PLAN26 seguiu sem
nenhum usuário. Falta `VITE_API_KEY`.

### 1.4 Admins no PLAN26 [humano]

A importação copia a coleção `admins` do Firebase. Se alguém novo precisar ser admin, inserir o e-mail em minúsculas
na tabela `admins` pelo Table Editor.

### 1.5 Ensaio com os dados reais no Supabase local [humano: lê a produção do Firebase]

```
npm run db:local
npx supabase status -o env
```

Com a `SERVICE_ROLE_KEY` local (a variável do ambiente vence a do `.env.local`):

```
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local> node --env-file=.env.local scripts/migrar-firebase-para-supabase.mjs
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local> node --env-file=.env.local scripts/migrar-firebase-para-supabase.mjs --aplicar
```

Conferir: zero impedimentos; cada aviso entendido; "Diferenças (0)". **Parar e relatar** se a simulação mostrar um
campo novo num documento de usuário ou uma subcoleção com dados reais (condição de parada da especificação).
O relatório tem e-mails de clientes: fica no terminal, não vai para o log nem para o vault.

### 1.6 Teste na prévia [humano]

Na URL da prévia, no celular e no computador:
1. Cadastro com uma conta nova → chega "Confirme seu e-mail" → o link abre o app em "Seu cadastro foi recebido".
2. O admin entra → Gestão de Acessos → **Liberar** → a conta nova clica em "Já fui liberado, conferir" e entra.
3. Salvar algo no plano, recarregar a página: o dado continua.
4. "Esqueceu a senha?" → chega "Defina sua senha" → o link abre "Crie sua senha" → a senha nova entra.
5. **Google numa conta que já existe**, como ficará cada cliente Google migrado: criar à mão no PLAN26
   (Authentication → Add user, "Auto Confirm User", sem senha) o usuário de uma conta Google de teste do GI, que é
   o que a importação faz; entrar com Google na prévia e conferir em Authentication → Users que **ficou um usuário
   só, com as identidades `email` e `google`**. Se aparecer um segundo usuário, **pare e relate antes da virada**
   (condição de parada da especificação). Apagar o usuário de teste depois.

## 2. Um dia antes: aviso aos clientes [humano: envio pelo GI]

Texto sugerido:

> **Assunto:** O PLAN muda de endereço amanhã
>
> Olá! Amanhã, a partir de [horário], o PLAN passa a funcionar em **https://planejamento.gestaoimpacto.com**. Seus planos vão
> junto, ano a ano, e o endereço antigo leva ao novo.
>
> - Se você entra com **Google**, é só clicar em "Entrar com Google", como sempre.
> - Se você entra com **e-mail e senha**, vai receber um e-mail "Defina sua senha do PLAN". Clique no link e crie uma
>   senha; pode ser a mesma de antes.
>
> Durante a mudança (cerca de [duração]), o PLAN fica só para leitura: dá para ver, mas não salvar.
> Dúvidas: [contato].

## 3. A virada, num horário calmo

| # | Passo | Quem | Comando | Conferir |
|---|---|---|---|---|
| 1 | Guardar as regras do Firestore que estão no ar (não são as do repositório) | [humano] | `node --env-file=.env.local scripts/regras-do-firebase.mjs salvar` | `firestore.no-ar.rules` existe e tem o texto das regras (fica fora do git) |
| 2 | Congelar o Firebase (leitura igual, escrita negada) | [humano] | `node --env-file=.env.local scripts/regras-do-firebase.mjs congelar` | Console do Firebase → Firestore → Regras mostra `firestore.congelado.rules`; no app antigo, salvar dá erro visível |
| 3 | Importação simulada contra o Firebase congelado | [humano] | `node --env-file=.env.local scripts/migrar-firebase-para-supabase.mjs` | zero impedimentos; contagens iguais às do ensaio (1.5) |
| 4 | Importação final no PLAN26 | [humano] | `node --env-file=.env.local scripts/migrar-firebase-para-supabase.mjs --aplicar --confirmo=aixjmxfkaziqlxnpudkk` | "Gravando em aixjmxfkaziqlxnpudkk.supabase.co"; conferência com esperado = achado em todas as linhas e "Diferenças (0)"; sai com código 0 |
| 5 | Deploy de produção do projeto `plan` | [humano] | `vercel deploy --prod` | a URL de produção abre a tela de login |
| 6 | Domínios no projeto novo | [humano] | Vercel → `plan` → Settings → Deployment Protection: voltar a proteção para **Standard** (todos exceto domínios próprios), senão os clientes caem no login da Vercel. Até aqui, `planejamento.gestaoimpacto.com` serve o app antigo pelo projeto `plan-firebase` (mesma equipe; commit `f0c2a74` do Leo, o que estava no ar, publicado em 2026-11-13). Remover o domínio de lá (`plan-firebase` → Settings → Domains → Remove) e logo em seguida, em `plan` → Settings → Domains, adicionar `planejamento.gestaoimpacto.com`. O CNAME `planejamento` já existe no DNS (`hanoon6070`, cPanel; era o `plan2026`, renomeado em 2026-11-12) e a Vercel o aceita; se pedir outro destino, ajustar no cPanel. Depois de conferir o `plan` no domínio, apagar o projeto `plan-firebase` (fica um projeto só, pedido do usuário em 2026-11-13; o código dele segue no git, em `f0c2a74`). Adicionar `plan2026.gestaoimpacto.com` (recriar o CNAME `plan2026` no cPanel, se tiver saído) com o redirecionamento **308** para `planejamento.gestaoimpacto.com` | os dois domínios "Valid Configuration"; `planejamento.gestaoimpacto.com`, numa janela anônima, abre a tela de login do PLAN (não a da Vercel); `plan2026.gestaoimpacto.com` redireciona |
| 7 | E-mails "crie sua senha": contar (só lê, mas lê a produção) | [humano] | `node --env-file=.env.local scripts/enviar-criar-senha.mjs` | "sem conta no Supabase" = 0 |
| 8 | E-mails "crie sua senha": enviar | [humano] | `node --env-file=.env.local scripts/enviar-criar-senha.mjs --enviar --confirmo=aixjmxfkaziqlxnpudkk` | "Falharam: 0"; leva uns 2 min (lotes de 10, 30 s entre eles) |
| 9 | Teste final | [humano] | entrar com o admin, com um cliente de senha (pelo e-mail recebido) e com um cliente Google | cada um vê os próprios planos de cada ano e o status de acesso que tinha |

Se o passo 4 listar "Planos não sobrescritos", alguém editou esse plano no app novo antes da importação; o plano do
app novo vale. Antes do passo 5, rodar o passo 4 de novo é seguro: reaproveita os usuários e não duplica nada.

Depois do passo 5, a URL de produção da Vercel já aceita login (o Google volta para `window.location.origin`), então
clientes editam planos e o admin muda acessos mesmo antes de o domínio mudar. Rodar o passo 4 de novo continua seguro:
o script não sobrescreve plano editado no app novo nem acesso cujo status um admin mudou no app novo
(`acessos.alterado_no_app_em` preenchida), e lista os dois em "Planos não sobrescritos" e "Acessos não sobrescritos".
Quem ninguém decidiu no app novo, inclusive quem se cadastrou nele antes da importação, recebe o status do Firebase.

## 4. Volta atrás

- **Até antes do passo 5** (app novo ainda sem deploy de produção), nada se perde: ninguém grava no banco novo, e o
  Firebase só está congelado. [humano] `node --env-file=.env.local scripts/regras-do-firebase.mjs restaurar` e
  conferir no console que as regras no ar são as de `firestore.no-ar.rules`.
- **Depois do passo 5**, quem chega à URL da Vercel e, depois do passo 6, os clientes já gravam no Supabase. Voltar (devolver os domínios ao projeto antigo, pelo Leo
  na conta antiga da Vercel, e restaurar as regras) **perde tudo o que foi feito no app novo**: edições de plano,
  planos criados, cadastros novos e liberações ou bloqueios feitos pelo admin. O Supabase guarda esses dados, mas o
  app antigo não os vê, e não há caminho de volta para o Firebase. **A decisão de voltar é do usuário**, pesando o
  problema contra essa perda; quanto mais tempo passa, maior ela fica.

## 5. Depois

- Uma semana de observação (erros de login, "não consegui salvar", pedidos de link novo).
- [humano] Revogar a chave da conta de serviço do Firebase usada em `GOOGLE_APPLICATION_CREDENTIALS` e tirar
  `SUPABASE_SERVICE_ROLE_KEY` do `.env.local`.
- Entrega de limpeza: remove `firestore.rules`, `firestore.congelado.rules`, `firebase.json`, `.firebaserc`,
  `firebase-tools`, `firebase-admin` e os scripts de migração (`scripts/migrar-*`, `scripts/migracao/`,
  `scripts/enviar-criar-senha.mjs`, `scripts/regras-do-firebase.mjs`).
- [humano] O Leo pausa (não apaga) o projeto antigo na Vercel. O Firebase não é apagado.
