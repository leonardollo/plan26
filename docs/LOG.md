# Log de entregas

Uma entrada por entrega, escrita pelo `/ship`, a mais recente no topo. Não é carregado
automaticamente: sessões novas leem as últimas entradas e o plano em andamento.

## 2026-11-11 — Regras: planos/{ano} só com anos válidos

- **O quê:** `firestore.rules`, em `users/{uid}`.
  - **Planos por ano:** `match /planos/{ano}` grava (create e update) só com `anoDePlanoValido(ano)`. O id precisa ter 4 dígitos,
    ser maior que 2026 (o 2026 fica no próprio `users/{uid}`) e ser no máximo o ano atual + 1 (UTC do servidor). Ler e apagar não
    olham o ano, para a listagem dos planos ver tudo.
  - **Outras subcoleções:** viraram só leitura do dono. Antes o curinga `/{documento=**}` deixava gravar qualquer caminho, e
    também liberava `planos/{ano}` sem a checagem do ano.
- **Por quê:** um cliente liberado conseguia gravar `planos/9999` no próprio espaço. O achado de segurança da 3A foi rejeitado na
  época porque corrigir exigia publicar regras.
- **Exemplos testados** (`tests/rules/users.test.ts`, para cliente liberado e admin):
  - gravam: 2027 e o ano atual + 1; um merge no plano de 2027 já salvo também passa;
  - não gravam: ano atual + 2, `9999`, `2026`, `2025`, `0000`, `abc`, `02027`, `2027a` e `202`, nem em outra subcoleção ou
    abaixo de um plano;
  - a listagem continua funcionando mesmo com um `9999` antigo gravado.
  - Os anos dos testes são relativos ao relógio. Os 22 testes novos falharam com a regra antiga antes da mudança.
- **Verificação:** em `c3766de`:
  - `npm test`: 31 arquivos, 269/269;
  - `npm run test:rules`: 91/91;
  - `npm run build`: ok, em 1.84s;
  - `npm audit --audit-level=high`: passa, com 13 moderadas.
- **Revisão:** Codex, Normal + Sensível (`firestore.rules`).
  - **Segurança:** sem achados.
  - **Base, um P2, rejeitado:** "em 2028 o plano de 2027 deixa de gravar". Não procede: o piso é fixo (> 2026) e o teto sobe com
    o ano (≤ ano atual + 1). Em 2028, 2027 ≤ 2029 continua valendo. O teste "grava o plano de 2027" cobre isso em qualquer ano.
- **Passo humano:** publicar as regras com `firebase deploy --only firestore:rules`, conta com acesso ao `plan-ea4cc`. Quem
  publica é o Leonardo. A regra nova também funciona com o app que está no ar, que não grava em subcoleções além de `planos`, então
  a ordem em relação ao deploy do app não importa.
- **Em aberto:** dados antigos em outras subcoleções de `users/{uid}`, se existirem em produção, ficam só leitura. O app não
  usa nenhuma.
- **Commits:** `c3766de`. A branch também leva `523a081` (Deploy preenchido no `AGENTS.md`, Trivial).

## 2026-11-11 — Textos datados da reforma na aba Impostos

- **O quê:** só textos, em `src/components/Taxes.tsx`.
  - **Regime híbrido do Simples:** saiu o prazo "até setembro de 2026", que já passou. O card, a tabela de regimes e a lista de
    ações agora dizem que a opção é semestral. O card ainda diz que a janela de setembro de 2026 valeu para o 1º semestre de 2027 e
    manda conferir a próxima data no Portal do Simples Nacional.
  - **"Alíquota cheia":** virou "CBS cheia (2027) e do IBS, que cresce de 2029 a 2033".
  - **Simulador:** o card "Novo Sistema (2027+)" virou "Sistema completo (2033)", com uma nota de que até lá a troca é gradual e que
    o imposto de cada ano do plano está na aba Configuração. Os 27,5% continuam iguais: são uma estimativa do IVA completo, dentro
    da faixa oficial.
- **Por quê:** decisão do usuário, "Corrigir pela lei". O texto antigo dava um prazo vencido e comparava o imposto atual com o IVA
  completo como se ele valesse em 2027.
- **Fontes:**
  - LC 214/2025, art. 41, e LC 123/2006: a opção do Simples pelo regime regular de IBS/CBS é semestral, feita antes de cada
    semestre. Fontes:
    - [CRC-CE](https://www.crc-ce.org.br/crcnovo/files/RTASN15042025.pdf) e
      [Sefin-RO](https://reformatributaria.sefin.ro.gov.br/2025/08/26/simples-nacional-alteracoes-introduzidas-pela-reforma-tributaria/)
      falam em setembro e abril;
    - a [Contábeis](https://www.contabeis.com.br/artigos/77179/reforma-tributaria-simples-nacional-pode-optar-por-novos-tributos/)
      fala em março de 2027. Por isso o texto não fixa o mês.
    - A janela de 1º a 30/09/2026 valeu para o 1º semestre de 2027
      ([TAGD](https://tagdlaw.com.br/comite-gestor-define-prazos-para-opcao-ao-simples-nacional-em-2027-e-regulamenta-escolha-pelo-regime-regular-de-ibs-e-cbs/)).
  - **IVA completo:** de 26,5% (referência da LC 214/2025) a 27,91% (estimativa do Comitê Gestor em 2026)
    ([Contmatic](https://simplifique.contmatic.com.br/blogs/aliquota-referencia-ibs-cbs-cgibs-estima-27-91)).
  - **Cronograma:** ICMS e ISS caem de 2029 a 2032 e acabam em 2033; o IBS sobe no mesmo ritmo (EC 132/2023, LC 214/2025).
  - **Validação:** um contador pode validar depois; as fontes são secundárias, exceto o texto da lei.
- **Verificação:**
  - `npx vitest related --run src/components/Taxes.tsx src/utils/semAnoFixo.test.ts`: 22/22;
  - `npm run typecheck`: ok.
- **Revisão:** nenhuma. É Trivial (só texto), e `Taxes.tsx` não é caminho sensível.
- **Em aberto:**
  - **Navegador:** os textos novos não foram vistos no navegador. É só texto estático, sem mudança de layout.
  - **Cancelamento:** uma fonte cita que dá para cancelar a opção de setembro até 30/11/2026. Não entrou no texto por falta de
    confirmação.

## 2026-11-11 — Ambiente local com emuladores do Firebase

- **O quê:** um modo de desenvolvimento que liga o app aos emuladores de Auth e Firestore (projeto `demo-plan`, `127.0.0.1`).
  - `src/services/emuladores.ts`: `usarEmuladores(dev, modo)` e `conectarAosEmuladores`. Em `usePlanData.tsx` o modo só liga com
    `import.meta.env.DEV` e `--mode emuladores`, e aí troca a config pelo projeto `demo-plan`.
  - O `firebase.json` ganhou o bloco `emulators` (auth 9099, firestore 8080, sem UI). O emulador aplica o `firestore.rules` real.
  - Scripts novos: `npm run emuladores`, `npm run emuladores:semear` e `npm run dev:local`. O AGENTS.md lista os três.
  - `scripts/semear-emuladores.mjs` cria `cliente@exemplo.com` (liberado) e `admin@exemplo.com` (admin, e-mail verificado). A senha
    fictícia está no script.
- **Por quê:** as telas internas das entregas 1, CAPEX, 3A e 3B nunca tinham sido vistas no navegador, porque não havia conta de
  teste. Decisão do usuário: "Sim, montar".
- **Verificação:** em `88504af`:
  - `npm run build` ok, em 1.85s;
  - `npm test`: 31 arquivos, 269/269;
  - `npm run test:rules`: 63/63;
  - `npm audit --audit-level=high`: passa, com 13 moderadas;
  - `grep` no `dist/assets/*.js` por `9099`, `demo-chave-local` e `connectAuthEmulator`: nenhuma ocorrência, então o modo não
    chega ao build de produção.
- **Visto como usuário** (`agent-browser`, 1440 e 390 px):
  - O cliente entra, passa pelo cadastro inicial e o plano abre em 2027 com o seletor de ano. Com Lucro Presumido, a aba Impostos
    mostra "CBS efetiva (%)" com sugestão de 5,54%, as dicas de PIS e COFINS e "Imposto sobre a receita em 2027".
  - A aba "Investimentos e Financiamentos" abre e aceita uma linha nova.
  - O admin vê "Gestão de Acessos", e a fila lista as duas contas como liberadas.
  - O seed não gravava `criadoEm`, e a fila, que ordena por esse campo, aparecia vazia. Corrigido antes do commit. Em produção todo
    pedido nasce com `criadoEm`.
  - "Começar plano" não aparece com só um plano de 2027, porque o limite é o ano atual + 1, como previsto na 3A.
- **Revisão:** Codex, Normal + Sensível (toca `usePlanData.tsx`, `firebase.json` e `src/services/**`). As revisões base e de
  segurança vieram sem achados. A de segurança diz que não rodou build nem testes (sandbox somente leitura); isso foi feito aqui.
- **Em aberto:**
  - **Celular:** no celular o menu lateral fixo (`w-72`) ocupa cerca de ¾ da tela e espreme o conteúdo, inclusive na aba Impostos.
    Isso já está em `origin/main`, não vem desta entrega, e precisa de uma entrega própria de layout móvel.
  - **Rede local:** o `vite` local escuta também na rede local (configuração já existente). No modo emuladores os dados são
    fictícios.
- **Commits:** `88504af`.

## 2026-11-11 — Entrega 3B: reforma tributária

- **O quê:** plano `docs/superpowers/plans/2026-11-11-reforma-tributaria.md` (spec
  `…/specs/2026-11-11-reforma-tributaria-design.md`).
  - **Cálculo:** nos planos de 2027 em diante (Lucro Presumido e Real), a CBS substitui PIS + COFINS no imposto sobre a receita do ano do
  plano. `aliquotaDoAnoDoPlano(taxes, anoPlano, base)` e `cbsSugerida(base)` ficam em `src/utils/calculos/impostos.ts`. A sugestão é
  11,3% × (1 − custos variáveis ÷ receita da base), e o campo novo `cbsEfetiva` deixa o cliente digitar a sua; vazio ou 0 usa a
  sugestão. O campo não é copiado para o ano seguinte. `projetarCenario`, a carga do plano, a projeção e a sensibilidade usam o ano do
  plano. O ano base continua com `aliquotaDeducao`.
  - **Aba Impostos:** campo "CBS efetiva (%)" com a sugestão no placeholder, linha "Imposto sobre a receita em {ano}", dicas de PIS e
  COFINS e um aviso quando a alíquota efetiva está preenchida.
  - **Textos:** a CBS passa a 11,2% + 0,1% de IBS (referência do TCU, a confirmar pelo Senado), a transição de 2031-32 foi corrigida
  e o prompt do Gemini foi atualizado.
- **Por quê:** um plano 2027 saía com PIS e COFINS, que deixam de existir em 2027. Decisões do usuário: "Estimar e deixar editar";
  desenho e especificação aprovados.
- **Decisões do implementador:**
  - A linha "Imposto sobre a receita em {ano}" aparece também no Simples, mostrando a alíquota do Simples.
  - O valor esperado de sensibilidade de 2026 passou de 21592,78 para 21592,775, que é a conta exata.
  - `geminiService.test.ts` foi atualizado para o texto novo do prompt.
  - Os testes que passaram antes do código (CBS não copiada, mudar só a CBS sem preencher o imposto do ano base, campo apagado) foram
  vistos falhando com o código estragado de propósito.
- **Verificação:** em `0098b60`:
  - `npm run build` ok: o typecheck passou sem erros e o build terminou em 1.75s;
  - `npm test`: 30 arquivos, 265/265;
  - `npm run test:rules`: 63/63, rodado em `a5f3871`; a correção mexe só num dado de teste;
  - `npm audit --audit-level=high` ok, com as mesmas 13 moderadas.
- **Revisão:** Codex, Estrutural + Sensível (toca `usePlanData.tsx` e `geminiService.ts`).
  - **Plano e segurança:** as duas revisões acharam o mesmo bloqueador, [P1]. O dado de teste `origemCheia()` em `planos.test.ts:97`
  não tinha `cbsEfetiva`, e o typecheck falhava. Corrigido em `0098b60`.
  - **Vulnerabilidades:** a revisão de segurança não achou nenhuma nova.
  - **Re-revisão do commit de correção:** sem achados, com a lente do plano e com a de segurança.
  - **Lição:** o implementador rodava só os testes afetados e não o `tsc`, então um campo obrigatório novo quebrou um dado de teste
  que ninguém executou. Os próximos planos pedem um `tsc --noEmit` ao fim de cada tarefa que muda tipos.
- **Em aberto:**
  - A aba Impostos de um plano 2027 não foi vista no navegador: não há conta de teste.
  - Quando o Senado fixar a alíquota (prazo em dezembro de 2026), atualizar `CBS_DE_REFERENCIA` e os textos.
  - Ainda falta decidir:
    - se a linha do ano do plano deve sumir no Simples;
    - se "Simular impacto da alíquota cheia" (Simulador, 27,5%, fora do escopo) precisa de texto novo.
  - A publicação depende dos acessos da entrega 1.
- **Commit/PR:** branch `feat/reforma-tributaria`: spec `ace88d3`, plano `6e526e3`, `c45d510`, `5e028f6`, `6798e10`, `a5f3871`,
  `0098b60`. Sem PR.

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
