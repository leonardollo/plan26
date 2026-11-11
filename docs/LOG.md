# Log de entregas

Uma entrada por entrega, escrita pelo `/ship`, a mais recente no topo. Não é carregado
automaticamente: sessões novas leem as últimas entradas e o plano em andamento.

## 2026-11-10 — Entrega 3A: um plano por ano

- **O quê:** plano `docs/superpowers/plans/2026-11-10-plano-por-ano.md` (spec
  `…/specs/2026-11-10-plano-por-ano-design.md`). Cada cliente passa a ter um plano por ano: o documento
  `users/{uid}` continua sendo o plano 2026 (sem migração nem gravação em produção) e os anos novos ficam
  em `users/{uid}/planos/{ano}` (`src/services/planos.ts`). O hook carrega e grava o ano aberto, troca de
  ano (`trocarAno`) e começa o ano seguinte (`comecarProximoAno`, numa transação que não sobrescreve um
  plano já criado), copiando o cadastro com a base em branco. Sidebar com seletor de ano e nome "PLAN"
  + ano do plano aberto. Coleta, diagnóstico, planejamento, relatórios, ajuda, importação do DPE e
  prompts do Gemini seguem os anos do plano aberto. Teste de guarda `src/utils/semAnoFixo.test.ts`
  barra ano fixo no código (141 ocorrências → 0); os anos da lei da reforma ficam entre marcadores
  `ano-real`.
- **Por quê:** o plano de 2027 sobrescreveria o de 2026, onde estão os dados atuais dos clientes.
  Decisões do usuário: separar a entrega 3 (CBS 2027 e tabela da reforma na 3B); ano novo copia o
  cadastro com a base em branco; plano antigo continua editável; nome "PLAN" + ano.
- **Decisões do implementador:** `totalImpostos2025` do ano novo começa nulo e vira `totalImpostos2024`
  só se existir; um ano sem documento também é recalculado na carga; falha ao começar o ano preenche o
  motivo do erro, mostrado na Sidebar; a prévia do DPE é descartada quando o ano base muda; ids do
  relatório renomeados para `financial-base`, `goals-plano`, `dre-plano`, `cashflow-plano`; se a
  criação do ano perde para uma troca manual, o ano entra na lista, mas a troca manual prevalece.
- **Verificação:** em `60cc159`: `npm run typecheck` sem erros; `npm test` 30 arquivos, 237/237;
  `npm run test:rules` 63/63 (os 30 casos novos de `planos` vistos falhando com as asserções invertidas
  — 20 falhas — e passando de novo depois de desfazer); `npm run build` ok (built in 1.80s);
  `npm audit --audit-level=high` ok (13 moderadas). Preview do build: login no celular (390×844) e no
  desktop (1440×900), título "PLAN - Planejamento Estratégico", sem erros no console.
- **Revisão:** Codex, Estrutural + Sensível (toca `usePlanData.tsx`, `dpeImport.ts`, `geminiService.ts`,
  `Login.tsx` e outros). Plano: 4 achados. Corrigidos em `60cc159`: [P1] busca ou arquivo do DPE
  iniciados antes de trocar de ano aplicavam a base antiga ao ano novo (contador de geração descarta o
  resultado); [P2] troca de ano feita durante a criação do ano seguinte era desfeita ao fim da
  transação (a criação só abre o ano novo se nenhuma carga foi pedida depois; seletor desabilitado
  durante a criação); [P2] o teste de ano sem documento passou a cobrir cenários, acompanhamento,
  precificação, metas, impostos e a gravação seguinte. Rejeitado: [P2] "Saldo Dez/{…}" literal no BP é
  falso positivo (texto JSX, as chaves são expressão); ficou um teste que confirma "Saldo Dez/27".
  Segurança: 1 achado rejeitado: um cliente liberado pode gravar pelo SDK `users/{seu-uid}/planos/9999`
  e o app abriria esse ano; afeta só o espaço do próprio cliente, que já pode gravar qualquer dado no
  documento legado, sem impacto entre clientes; barrar exige mudar e publicar `firestore.rules`, fora
  do escopo aprovado. Re-revisão de segurança do commit de correção (toca caminho sensível): sem
  achados. O Codex não rodou o emulador.
- **Em aberto:** seletor de ano, "Começar plano" e as telas internas não foram vistas no navegador (sem
  conta de teste). Endurecer as regras para aceitar só anos válidos em `planos/{ano}` (mudança e
  publicação de regras, passo humano). Publicação depende dos acessos da entrega 1.
- **Commit/PR:** branch `feat/plano-por-ano`: spec `df0ecda`, plano `5db451a`, `753f6b0`, `91167d9`,
  `14e78ce`, `21e9eeb`, `6e53f95`, `88855c4`, `4f96f46`, `763c159`, `8fcc47a`, `23e931a`, `60cc159`.
  Sem PR.

## 2026-11-10 — Investimentos, financiamentos e contratações em 2026

- **O quê:** plano `docs/superpowers/plans/2026-11-10-capex-financiamentos-contratacoes.md` (spec
  `…/specs/2026-11-10-capex-financiamentos-contratacoes-design.md`). Bloco novo `investment2026` no plano
  (investimentos, empréstimos novos, aportes de sócios e juros médios da dívida atual), com aba
  "Investimentos e Financiamentos" no Planejamento Financeiro. Funções puras em
  `src/utils/calculos/investimentos.ts` (depreciação linear a partir do mês seguinte, 5 anos se vazio;
  empréstimos pela tabela Price com 1ª parcela no mês seguinte; dívida atual com o curto prazo em 12
  amortizações e o longo prazo parado) e `contratacoes.ts` (custo mensal das contratações pela coluna
  nova "Mês de entrada" no Comercial). DRE, DFC e Balanço de 2026 e a folha dos cenários usam esses valores;
  o recálculo acontece na carga do plano, sem gravar ao abrir.
- **Por quê:** decisões do usuário: bloco novo (a Coleta 2025 continua como ponto de partida), dívida
  atual como saldo + pagamento simples, coluna "mês de entrada". Entrega adiada da entrega 2.
- **Efeito visível:** planos existentes mudam ao abrir, sem o cliente digitar nada: o FCI deixa de repetir
  o CAPEX de 2025 (mais caixa); a dívida de curto prazo passa a ser amortizada (menos caixa); as
  contratações entram na folha dos cenários.
- **Verificação:** em `006ec00`: `npm run typecheck` sem erros; `npm test` 22 arquivos, 154/154;
  `npm run test:rules` 33/33; `npm run build` ok (built in 1.77s). `npm audit --audit-level=high` ok
  (13 moderadas) em `1ee391d`; as dependências não mudaram depois. Preview do build: login no celular
  (390×844) e no desktop (1440×900), sem erros.
- **Revisão:** Codex, Estrutural + Sensível (toca `usePlanData.tsx`). Plano: 5 should-fix, corrigidos em
  `006ec00` (parcelas enormes travavam a tela: cronograma limitado a dez/2027; testes do ajuste automático
  do Comercial, de todos os campos apagados, da liquidez corrente após o empréstimo e de editar/remover em
  cada lista). Segurança: 1 achado rejeitado: duas abas do mesmo usuário podem sobrescrever
  `investment2026`; é o comportamento do salvamento automático do documento inteiro, que já vale para todo
  o plano, e não foi introduzido aqui. Sem re-revisão: nenhum blocker e a correção não tocou caminho
  sensível. O Codex não rodou Vitest (sandbox somente leitura).
- **Em aberto:** a aba nova e a coluna "Mês de entrada" não foram vistas no navegador (sem conta de teste).
  Sobrescrita entre duas abas (salvamento do documento inteiro, anterior a esta entrega). O teste de tempo
  (100 ms para 100 milhões de parcelas) pode oscilar num CI lento. Publicação depende dos acessos da
  entrega 1.
- **Commit/PR:** branch `feat/capex-financiamentos-contratacoes`: spec `9014ab3`, plano `8f00253`,
  `feb237c`, `e23238c`, `4f1202e`, `f270b9b`, `c2be191`, `1ee391d`, `006ec00`. Sem PR.

## 2026-11-10 — Ajustes pequenos (imposto 2025, abertura sem gravar, custos variáveis)

- **O quê:** três pendências da entrega 2. (A) Mudar um campo na aba Impostos só preenche o imposto de 2025
  se a linha estiver vazia; o botão "Calcular" da Coleta continua sobrescrevendo, com confirmação.
  (B) Score estratégico e bônus de produtividade passam a ser calculados por funções puras
  (`src/utils/calculos/analise.ts`) e recalculados dentro de `carregarPlano`, no mesmo commit da carga:
  abrir o plano mostra os valores e não grava; a gravação vem na próxima edição. (C) A linha
  "(-) Custos Variáveis" da DRE 2026 no relatório soma os custos variáveis personalizados
  (`custosVariaveisDaDre`).
- **Por quê:** decisões do usuário ("Só preencher se vazio", "Corrigir") sobre os itens em aberto da
  entrega 2; (C) fazia Receita Líquida − Custos ≠ Lucro Bruto no relatório.
- **Efeito visível:** plano sem análise de mercado preenchida passa a abrir com score −1,5 (crescimento de
  mercado 0 vale −1 × 1,5), igual ao que já valia após a primeira edição. Ex.: Conservador 10% → 8,5%.
  Dois testes da entrega 2 foram atualizados por isso (6.600 → 6.510; 120.000 → 118.500).
- **Verificação:** em `bd9cad1`: `npm run typecheck` sem erros; `npm test` 91/91; `npm run test:rules`
  33/33; `npm run build` ok (built in 1.76s); `npm audit --audit-level=high` ok (13 moderadas). Testes de
  regressão vistos falhando antes da correção: Taxes (2), ReportPreview (1), usePlanData abertura (2).
  Preview do build: login no celular (390×844) e no desktop (1440×900), sem erros.
- **Revisão:** Codex, Normal + Sensível (toca `usePlanData.tsx`). Base: sem achados. Segurança: sem
  achados (o Codex não rodou Vitest nem o emulador: sandbox).
- **Em aberto:** telas com números (Impostos, Cenários, Relatório) não vistas no navegador, sem conta de
  teste. Se o estado antes da carga diferir do inicial (troca de usuário na mesma aba), os efeitos ainda
  podem gravar uma vez. Publicação depende dos acessos da entrega 1.
- **Commit/PR:** branch `fix/ajustes-numeros`: `470091f`, `1a0dd16`, `bd9cad1`. Sem PR.

## 2026-11-10 — Entrega 2: números certos

- **O quê:** plano `docs/superpowers/plans/2026-11-10-numeros-certos.md` (spec `…/specs/2026-11-10-numeros-certos-design.md`).
  Funções puras em `src/utils/calculos/` (`impostos`, `cenario`, `planoFinanceiro`, `indicadores`, `resumo`).
  IRPJ/CSLL pelo regime (Simples 0; Presumido % da receita; Real 15% + 10% acima de R$ 20 mil/mês, acumulado
  no ano) numa só regra para DRE, Coleta, Comparativo, sensibilidade, ROIC e lucro 2025 do relatório.
  Cenários: variáveis pelo crescimento, fixos pela inflação prevista, impostos pela alíquota de dedução;
  cenário manual não é recalculado. DRE recalculada quando muda a projeção do cenário base ou os impostos.
  Resumo, Acompanhamento, análise mensal e prompts do Gemini leem a projeção (`resumoDoCenario`) no lugar
  dos campos `*Projetad*`, que nunca eram preenchidos. Payback do CAC sem a divisão extra por 12; série
  "Projeção" do Planejamento Comercial; "Despesas Fixas" do relatório deixa de sair 0.
- **Por quê:** a revisão para o ciclo 2027 achou IR cobrado duas vezes, cenários que só multiplicavam o
  ano-base, Resumo/Acompanhamento zerados e payback 12× maior. Decisões do usuário: IRPJ/CSLL pelo regime;
  fixos pela inflação; CAPEX/financiamentos/contratações numa entrega própria. Decisão do plano: plano já
  salvo é recalculado dentro de `carregarPlano`, no mesmo commit da carga, para não gravar só por abrir
  (entrega 1). Fora do plano, decididas pelo implementador: "Recalcular Todos" continua sobrescrevendo
  valores manuais (como antes); linhas ausentes da projeção valem 0; o recálculo na carga só roda com
  documento existente e receita 2025 > 0; no Presumido realizado, a base do IR é `receitaBruta ?? receitaLíquida`;
  o card do Resumo compara receita bruta 2026 com bruta 2025, e a margem EBITDA é sobre a receita líquida.
- **Verificação:** em `7dc777c`: `npm run typecheck` sem erros; `npm test` 79/79 (16 arquivos);
  `npm run test:rules` 33/33; `npm run build` ok (built in 2.13s); `npm audit --audit-level=high` ok
  (13 moderadas). Preview do build: tela de login no celular (390×844) e no desktop (1440×900), sem erros.
- **Revisão:** Codex, Estrutural + Sensível (toca `usePlanData.tsx` e `geminiService.ts`). Plano: 2
  should-fix corrigidos em `7dc777c`: card "Receita Líquida" mostrava receita bruta (renomeado para
  "Receita Bruta"); faltavam testes do cenário manual ao mudar a base de 2025 e as alíquotas (adicionados;
  conferido que falham sem a proteção). Segurança: sem achados. Sem re-revisão: nenhum blocker e a correção
  não tocou caminho sensível. O Codex não rodou `npm test` nem `test:rules` (sandbox).
- **Em aberto:** telas com números (Resumo, Acompanhamento, Cenários, DRE, Relatório) não vistas no
  navegador, sem conta de teste. `applyTaxesTo2025` sobrescreve o imposto de 2025 digitado à mão na Coleta
  (mantido, conforme a condição de parada; decisão do usuário). Os efeitos de score estratégico e
  produtividade gravam ao abrir se o valor salvo estiver desatualizado (anterior a esta entrega). A linha
  "Custos Variáveis" do relatório não soma `outrosCustosVariaveis`. Limitação conhecida da spec: imposto
  2025 salvo com a regra antiga no Presumido/Real até mudar um campo de imposto. Publicação depende dos
  acessos da entrega 1.
- **Commit/PR:** branch `fix/numeros-certos`: `f1cec34`, `2674710`, `d98d902`, `48d0ba1`, `da13784`,
  `65fa780`, `7dc777c` (spec `d29c0ed`, plano `59f6cf0`). Sem PR.

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
