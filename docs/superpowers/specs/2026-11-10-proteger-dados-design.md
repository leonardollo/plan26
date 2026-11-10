# Entrega 1 — Proteger os dados (design)

- **Data:** 2026-11-10
- **Nível:** Estrutural + Sensível (5 partes independentes, caminhos sensíveis)
- **Branch:** `fix/proteger-dados`, criada a partir da `main` local `c6f8cfe`
- **Origem:** revisão completa para o ciclo 2027 (achados em `Problemas.md` do vault)

## Objetivo

Antes de usar o app com clientes no planejamento de 2027, nenhuma falha deve conseguir:

- apagar o plano de um cliente;
- impedir o administrador de usar o próprio espaço;
- dar poder de administrador a quem não é dono do e-mail;
- rodar script de terceiros na sessão do consultor;
- deixar a chave do Gemini de um cliente para o próximo usuário do mesmo navegador.

Decisões do usuário:

- verificação de e-mail obrigatória **só para administrador**;
- testes com **Vitest + emulador do Firestore**.

## Parte 0 — Base de testes

- Dependências de desenvolvimento:
  - `vitest`, `jsdom`, `@testing-library/react` (testes do app);
  - `@firebase/rules-unit-testing`, `firebase-tools` (testes das regras no emulador).
- Java na máquina: `brew install openjdk`. É um passo de sistema, aprovado pelo usuário em 2026-11-10.
- Scripts no `package.json`:
  - `test`: `vitest run`, sem os testes de regras;
  - `test:rules`: `firebase emulators:exec --only firestore --project demo-plan "vitest run --config vitest.rules.config.ts"`.

  O projeto `demo-*` garante que o emulador nunca fale com o `plan-ea4cc`.
- Testes das regras em `tests/rules/`, testes do app junto ao código (`*.test.ts(x)`).
- CI:
  - `actions/setup-java` (Temurin 21);
  - passos `npm test` e `npm run test:rules`, antes do build.
- `AGENTS.md` → Commands:
  - test, affected: `npx vitest related --run <files>`;
  - test, full: `npm test && npm run test:rules`.

  Mais as entradas de permissão correspondentes em `.claude/settings.json` e `.codex/rules/project.rules`.

## Parte 1 — O plano nunca é sobrescrito por uma carga que falhou

**Hoje** (`usePlanData.tsx:269-340`):

- se `getDoc` falha, o erro só vai para o console;
- `isInitialLoad` vira falso 1 s depois mesmo assim;
- na primeira edição, `setDoc(..., {merge:true})` grava o estado inicial vazio por cima do plano.

**Novo comportamento:**

- **Estado da carga.** Troco `isInitialLoad` por `estadoDaCarga: 'carregando' | 'carregado' | 'falhou'`, exposto no contexto.
  - `carregado` só quando `getDoc` respondeu: com o documento, ou sem documento numa conta nova.
  - Qualquer exceção leva a `falhou`.
- **Salvamento.** O salvamento automático e o manual (`saveToFirebase`) não gravam nada fora de `carregado`.
  - O salvamento manual em outro estado devolve erro com o motivo "O plano ainda não foi carregado".
- **Sem regravar o que foi lido.** Ao entrar em `carregado`, o estado recém-carregado não dispara gravação. Só uma mudança feita depois da carga marca `unsaved`. Isso substitui o atraso de 1 s.
- **Tela de erro.**
  - Com `subscriptionStatus === 'active'` e `estadoDaCarga === 'falhou'`, o `App` mostra, no lugar do app: "Não consegui abrir seu plano. Nada foi alterado." e o botão **Tentar de novo**, que roda a carga outra vez.
  - Com `carregando`, mostra a tela de carregamento existente.
- **Recarga após liberação.** Quando `checkSubscription` resulta em `active` e a carga está em `falhou`, a carga roda de novo. É o caso "Já fui liberado, conferir".
- **Aviso ao fechar a aba.**
  - O handler de `beforeunload` lê o status por `ref`, para ver o valor atual e não o da closure antiga.
  - Avisa com status `unsaved`, `saving` e `error`.

**Exemplos (viram testes do hook, com Firestore simulado):**

| Situação | Esperado |
|---|---|
| `getDoc` rejeita (permissão negada) e o usuário edita um campo | `estadoDaCarga = 'falhou'`; `setDoc` nunca é chamado |
| `getDoc` rejeita, depois **Tentar de novo** e a carga dá certo | estado carregado do banco; a edição seguinte grava |
| Documento não existe (conta nova) | `carregado` com o estado inicial; a primeira edição grava |
| Documento existe, carga ok, nenhuma edição | nenhum `setDoc` após a carga |
| Carga ok, edição, fecha a aba em menos de 3 s | `beforeunload` pede confirmação |
| Status `error` e fecha a aba | `beforeunload` pede confirmação |
| Pendente → liberado → "Já fui liberado" | a carga roda de novo e o plano real aparece |
| Modo local (sem Firebase) | comportamento atual: lê e grava `localStorage` |

## Parte 2 — Administrador usa o próprio espaço (PR #4)

- Mesclar `origin/erro-de-salvar-visivel` (`4399e2c`) na branch, sem alterar o commit.
- Ele traz:
  - `podeUsarOEspaco() = meuAcessoEsta('liberado') || souAdmin()`;
  - o texto "Não salvou" com o motivo na barra lateral.
- Os testes das regras confirmam:

| Quem | `users/{próprio uid}` | `users/{outro uid}` |
|---|---|---|
| Admin com e-mail verificado | lê e grava | negado |
| Cliente liberado | lê e grava | negado |
| Cliente pendente | negado | negado |
| Cliente bloqueado | negado | negado |
| Sem login | negado | negado |

## Parte 3 — Administrador só com e-mail verificado

**Regras (`firestore.rules`):**

- **`souAdmin()`.** Passa a exigir `request.auth.token.email_verified == true`. Comentário de porquê junto: sem isso, quem cria a conta com o e-mail de um admin sem conta ganha o poder.
- **`admins/{email}`.** `allow read` vira `allow get: if request.auth != null && request.auth.token.email != null && request.auth.token.email.lower() == email`. Cada um só confere o próprio documento, e ninguém lista.
- **`acessos/{uid}` create.** Aceita o campo `emailVerificado`, que precisa ser igual a `request.auth.token.email_verified`. O campo ausente continua aceito, para não recusar pedidos de quem ainda está com o bundle antigo aberto.

**App:**

- `User` ganha `emailVerified: boolean`, preenchido em `App.tsx` a partir do usuário do Firebase.
- **Admin com e-mail não verificado.** Se `ehAdministrador` dá verdadeiro e `emailVerified` é falso, `checkSubscription` define um novo status de tela, `verificar_email`. O `App` mostra uma tela com:
  - "Seu e-mail é de administrador, mas ainda não foi verificado.";
  - **Enviar e-mail de verificação** (`sendEmailVerification`);
  - **Já verifiquei**: `currentUser.reload()`, depois `getIdToken(true)`, depois roda `checkSubscription` de novo;
  - **Sair**.
- O pedido de acesso (`obterOuCriarAcesso`) grava `emailVerificado`.
- A Gestão de Acessos mostra uma coluna "E-mail verificado": Sim / Não / — para pedidos antigos sem o campo.

**Exemplos (testes das regras):**

| Situação | Esperado |
|---|---|
| E-mail em `admins`, token `email_verified: true` | `update` em `acessos/{x}` permitido |
| E-mail em `admins`, token `email_verified: false` | `update` em `acessos/{x}` negado; `users/{próprio}` negado sem acesso liberado |
| Qualquer logado faz `list` em `admins` | negado |
| Logado lê `admins/{o próprio e-mail}` | permitido (existindo ou não) |
| Logado lê `admins/{outro e-mail}` | negado |
| Create de `acessos` com `emailVerificado: true` e token `false` | negado |
| Create de `acessos` sem `emailVerificado` | permitido (compatibilidade) |
| Create de `acessos` com `status: 'liberado'` | negado (regra atual, mantida) |

**Exemplos (app):**

- Login com Google: o token já vem verificado e o admin entra direto.
- Admin com senha e sem verificação vê a tela de verificação, e não o app vazio.

## Parte 4 — Texto de cliente e de IA nunca vira HTML

- Nova função `markdownSeguro(texto)` em `src/utils/markdownSeguro.ts`:
  1. escapa `&`, `<`, `>`, `"` e `'`;
  2. só depois aplica as mesmas trocas de formatação usadas hoje (títulos, negrito, itálico, listas, quebras de linha).
- O visual não muda.
- `ReportPreview.tsx:239` e `Settings.tsx:321` passam a usá-la. A `formatMarkdown` local de `Settings` é removida.
- Os usos de `dangerouslySetInnerHTML` em `Taxes.tsx` (ícones fixos no código) ficam como estão.

**Exemplos (testes):**

| Entrada | Saída contém |
|---|---|
| `<img src=x onerror=alert(1)>` | `&lt;img src=x onerror=alert(1)&gt;` e nenhuma tag `<img` |
| `**Gargalo:** "<script>"` | `<strong …>Gargalo:</strong> &quot;&lt;script&gt;&quot;` |
| `### Título\ntexto` | `<h3 …>Título</h3>` e `texto` |
| `a & b` | `a &amp; b` |
| texto vazio | `''` |

## Parte 5 — A chave do Gemini não passa de um usuário para outro

- **Logout.** `authService.logout` apaga `google_gemini_api_key` do `localStorage`, no modo Firebase e no modo local.
- **Carga do plano.** O `localStorage` passa a refletir só o usuário que entrou: grava a chave dele, ou **remove** a que estiver lá quando o plano não tem chave. Assim nada sobra de outra pessoa, mesmo se a sessão expirou sem logout.
- **Configurações.** Removo a "migração" (`Settings.tsx:20-27`) que copiava a chave do navegador para o plano.
- **Prompt.** `generateComprehensiveStrategicAnalysis` serializa o perfil sem `geminiApiKey`. Os demais prompts não serializam o perfil inteiro.
- A prioridade de `VITE_API_KEY` em `getAI` não muda nesta entrega. Conferir se ela está na Vercel é um passo humano.

**Exemplos (testes):**

| Situação | Esperado |
|---|---|
| A entra (chave `kA`) e sai | `localStorage` sem `google_gemini_api_key` |
| `localStorage` com `kA`; B entra sem chave no plano | chave removida; Configurações de B não grava `kA` |
| B entra com chave `kB` | `localStorage` = `kB` |
| Prompt da análise estratégica | não contém o valor da chave |

## Fora desta entrega

- Duas abas ou aparelhos gravando por cima um do outro.
- Backup ou histórico de versões.
- Cabeçalhos de segurança (CSP) na Vercel.
- Limite de cadastros e App Check.
- Supabase do DPE.
- Junção profunda na carga.
- Números errados (entrega 2) e plano por ano (entrega 3).

## Condições de parada

- Se `firebase-tools` ou outra dependência nova fizer `npm audit --audit-level=high` falhar, parar e trazer as opções. Não trocar a política do audit sozinho.
- Se algum fluxo legítimo depender de **listar** `admins`, ou de admin sem e-mail verificado, parar e reportar.
- Se o emulador não subir na máquina ou no CI, parar e reportar. Não pular os testes de regra.
- Se a mesclagem do PR #4 conflitar com algo além de `usePlanData.tsx` e `types.ts`, parar e reportar.

## Passos humanos (depois do merge na `main`, nesta ordem)

1. Deploy do app na Vercel. O app precisa estar no ar **antes** das regras, para o admin já ver a tela de verificação.
2. Publicar as regras: `firebase deploy --only firestore:rules --project plan-ea4cc`.
3. Conferir se `VITE_API_KEY` está definida na Vercel. Se estiver, remover.
4. Ligar a proteção contra enumeração de e-mail no Firebase Auth.
5. Tirar de `admins` os e-mails sem conta.
6. Cada admin que entra com senha clica em "Enviar e-mail de verificação" uma vez.

O passo 6 é feito pelo próprio admin, quando aparecer a tela.

## Verificação (feita pelo `/ship`)

- `npm run typecheck`, `npm test`, `npm run test:rules`, `npm run build`, `npm audit --audit-level=high`.
- Preview do build de produção no celular e no desktop:
  - login;
  - tela "Conferindo seu acesso";
  - tela de erro de carga (simulando falha).

  As telas internas reais dependem de uma conta de teste, que ainda não existe; fica em aberto se não houver.
