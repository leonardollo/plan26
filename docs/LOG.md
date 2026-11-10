# Log de entregas

Uma entrada por entrega, escrita pelo `/ship`, a mais recente no topo. Não é carregado
automaticamente: sessões novas leem as últimas entradas e o plano em andamento.

## 2026-11-10 — Entrega 1: proteger os dados

- **O quê:** plano `docs/superpowers/plans/2026-11-10-proteger-dados.md` (spec `…/specs/2026-11-10-proteger-dados-design.md`).
  Carga do plano que falhou nunca grava por cima (`estadoDaCarga`, tela "Não consegui abrir seu plano" com
  Tentar de novo, recarga ao ser liberado, `beforeunload` por ref); PR #4 (`4399e2c`) mesclado, admin volta a
  usar o próprio espaço; `souAdmin()` exige `email_verified`, `admins` só aceita `get` do próprio e-mail,
  `acessos` grava `emailVerificado`, tela de verificação para admin com senha e coluna na Gestão de Acessos;
  `markdownSeguro` escapa texto do DPE e da IA antes de virar HTML; a chave Gemini sai no logout, na troca de
  usuário e do prompt. Base de testes nova: Vitest (jsdom) e regras no emulador (`demo-plan`), ambos no CI.
- **Por quê:** achados da revisão para o ciclo 2027 (perda de plano, admin sem plano, admin por e-mail não
  verificado, XSS via DPE, chave Gemini vazando entre usuários). Decisões do usuário: verificação só para
  admin; Vitest + emulador. Fora do plano, decididas pelo implementador: `checkSubscription` só recarrega o
  plano se o status anterior não era `loading`; a passagem `verificar_email`→`active` também recarrega; o
  recálculo de cenários pula o commit da carga; getter `authService.emailAtual()`.
- **Verificação:** em `c87433f`: `npm run typecheck` sem erros; `npm test` 37/37; `npm run test:rules` 32/32;
  `npm run build` ok (built in 1.77s); `npm audit --audit-level=high` ok (13 moderadas). Após `82c3f79`:
  `npm test` 39/39 e `npm run test:rules` 33/33. Preview do build: tela de login no celular (390×844) e no
  desktop (1440×900), sem erros no console.
- **Revisão:** Codex, Estrutural + Sensível. Plano: 2 should-fix (create de `acessos` com e-mail verificado
  sem teste; refresh do token antes de liberar o admin sem teste), corrigidos em `82c3f79`. Segurança: sem
  achados. Sem re-revisão: nenhum blocker e a correção só tocou testes e `AGENTS.md`. O Codex não executou
  os testes (sandbox) nem o audit (DNS); não validou Firebase Auth, regras em produção nem CSP.
- **Em aberto:** telas internas (erro de carga, verificação de e-mail, "Abrindo seu plano") não vistas no
  navegador, sem conta de teste. Push/PR depende de write no `origin`. 13 moderadas vêm do `firebase-tools`
  (devDependency). Passos humanos depois do merge, nesta ordem: deploy na Vercel; `firebase deploy --only
  firestore:rules --project plan-ea4cc`; conferir e remover `VITE_API_KEY` na Vercel; ligar a proteção
  contra enumeração de e-mail; tirar de `admins` os e-mails sem conta; cada admin com senha verifica o e-mail.
- **Commit/PR:** branch `fix/proteger-dados`: `a02b48a`, `03ac5a5`, `1473fdf`, `59ddb6c`, `0f0e975`,
  `cc44fc7`, `a7e460f`, `c87433f`, `82c3f79` (spec `4729f2b`, plano `cbb1e0e`). Sem PR.

## 2026-11-10 — Correção das vulnerabilidades do npm audit

- **O quê:** `npm audit fix` (só patch/minor: `vite` 7.3.2→7.3.8, `uuid` 13.0.0→13.0.2, `esbuild`,
  `postcss`, `ws`, `nanoid`, `@babel/core` e outras transitivas) e `overrides` de `@grpc/grpc-js`
  para `^1.13.6`. Audit foi de 13 vulnerabilidades (1 crítica, 8 altas) para 0.
- **Por quê:** o passo de audit do CI ficava vermelho. Os 4 alertas restantes vinham do
  `@grpc/grpc-js` 1.9.16 dentro do `@firebase/firestore`, que fixa `~1.9.0` até no Firebase 13.2.0;
  o "fix" do npm era voltar ao Firebase 9. O grpc só é usado no build Node do Firestore e não entra
  no bundle do navegador (conferido em `dist/`), então o override não muda o app. Revisar o
  override quando o Firebase subir o grpc-js.
- **Verificação:** `npm ci` ok; `npm run typecheck` sem erros; `npm run build` ok (built in 1.71s);
  `npm audit --audit-level=high` → found 0 vulnerabilities. Preview do build de produção: tela de
  login renderiza no celular (390×844) e no desktop, sem erros no console.
- **Revisão:** Codex (`codex review --base vibecoderpack`), nível Normal: sem achados.
- **Em aberto:** telas internas não testadas após o login (sem credencial de teste).
- **Commit/PR:** `56a273c` na branch `npm-audit-fix`, criada a partir de `vibecoderpack`.

<!--
## AAAA-MM-DD — título curto

- **O quê:** o que foi entregue, em uma ou duas linhas.
- **Por quê:** decisões tomadas e o motivo (o que restringe código também vira comentário no código).
- **Verificação:** comandos rodados no estado final e o resultado (ex.: `test 412/412`, build ok).
- **Revisão:** quem revisou e o nível; achados corrigidos e rejeitados, com motivo.
- **Em aberto:** defeitos conhecidos, riscos aceitos, passos humanos pendentes.
- **Commit/PR:** hash ou link.
-->
