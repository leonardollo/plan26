# Entrega 2 — Números certos (design)

- **Data:** 2026-11-10
- **Nível:** Estrutural + Sensível (5 partes; regras de dinheiro e impostos; toca `src/hooks/usePlanData.tsx` e `src/services/geminiService.ts`)
- **Branch:** `fix/numeros-certos`, criada a partir da `main` local `b743541` (já com a entrega 1)
- **Origem:** revisão para o ciclo 2027 (`Problemas.md` do vault) e o mapa dos cálculos de 2026-11-10

## Objetivo

O cliente usa os números do PLAN para decidir o ano. Nenhuma tela, relatório ou prompt de IA deve mostrar receita
zerada, imposto cobrado duas vezes, cenário que só multiplica o ano-base ou um lucro líquido diferente em cada tela.

Decisões do usuário (2026-11-10):

- IRPJ/CSLL **pelo regime tributário**;
- nos cenários, custos fixos e despesas sobem **pela inflação prevista**;
- CAPEX, financiamentos e contratações ficam para **uma entrega própria, depois desta**.

## Parte 1 — Impostos pelo regime (uma função para todo o app)

Módulo novo, sem React: `src/utils/calculos/impostos.ts`.

- **`aliquotaDeducao(taxes)`**, em %, sobre a receita bruta:
  - `aliquotaEfetiva > 0` → `aliquotaEfetiva`;
  - Simples Nacional → `simplesNacional`;
  - Presumido e Real → `iss + icms + pis + cofins` (**sem** `irpj` e `csll`).
- **`irpjCsllMensal(taxes, receitaBruta, lair)`** devolve os 12 meses:
  - **Simples:** 0, porque o DAS já inclui IRPJ e CSLL.
  - **Presumido:** `(irpj + csll)% × receitaBruta[m]`, independente do lucro. Com `aliquotaEfetiva > 0` dá 0, porque a alíquota total já inclui esses impostos.
  - **Real:** é anual, com a compensação de prejuízo dentro do ano.
    - Para cada mês `m`, `base = max(0, LAIR acumulado até m)`.
    - `impostoAcumulado(m) = 15%·base + 10%·max(0, base − 20.000·(nº do mês)) + 9%·base`.
    - `irpjCsll[m] = impostoAcumulado(m) − impostoAcumulado(m−1)`.
    - Um mês de prejuízo depois de meses de lucro gera valor negativo (estorno da provisão). A soma do ano é sempre o imposto anual exato.
  - **Regime vazio ou desconhecido** (planos antigos) → Simples, que é o padrão do app.
- **`irpjCsllAnual(taxes, receitaBrutaAnual, lairAnual)`**: a mesma regra com um único período de 12 meses. Serve para a sensibilidade e o ROIC.
- **Quem passa a usar essas funções:**
  - `applyTaxesTo2025` e `Taxes.tsx` (alíquota exibida) usam `aliquotaDeducao`;
  - a DRE 2026 (`calculateFinancialPlan2026`) usa `irpjCsllMensal` no lugar de `0.34`;
  - o lucro líquido 2025 da Coleta de Dados (`DataCollection.tsx:99-111`);
  - o Comparativo DRE (`DreComparison.tsx`, no lugar de `× 0.85`);
  - a matriz de sensibilidade (`SensitivityAnalysis.tsx:26` e `usePlanData.tsx:847-849`, no lugar de 24%);
  - o ROIC (`usePlanData.tsx:832`, no lugar de `× 0.76`).
- **Texto de ajuda do campo "Alíquota Efetiva Total":** "No Lucro Real, não inclua IRPJ e CSLL: eles são calculados sobre o lucro."

**Exemplos (viram testes):**

| Situação | Esperado |
|---|---|
| Simples 6%, receita 100 mil/mês, LAIR 20 mil/mês | dedução 6 mil/mês; IRPJ/CSLL 0 |
| Presumido: ISS 5, PIS 0,65, COFINS 3, IRPJ 4,8, CSLL 2,88; receita 100 mil | dedução 8.650/mês; IRPJ/CSLL 7.680/mês, mesmo em mês de prejuízo |
| Presumido com `aliquotaEfetiva` 15 | dedução 15%; IRPJ/CSLL 0 |
| Real, LAIR 50 mil todo mês | 15 mil/mês; ano 180 mil (hoje: 204 mil) |
| Real, jan −50 mil e fev–dez somando 650 mil | jan 0; ano 180 mil (hoje: 221 mil) |
| Real, jan +100 mil, fev −100 mil, resto 0 | jan 32 mil; fev −32 mil; ano 0 |
| Real com prejuízo no ano | ano 0; nenhum mês com acumulado positivo |
| Real com `aliquotaEfetiva` 12 | dedução 12%; IRPJ/CSLL pela regra do Real |
| Receita e LAIR zerados, ou campos `null` | tudo 0, nunca `NaN` |
| Regime `undefined` | igual ao Simples |

## Parte 2 — Cenários: variáveis pelo crescimento, fixos pela inflação

`calculateScenarioProjection` passa a chamar uma função pura `projetarCenario(base2025, crescimentoPct, inflacaoPct, taxes)`, em `src/utils/calculos/cenario.ts`.

- **Pelo fator do cenário:** receita bruta, CMV, comissões, fretes e os custos variáveis personalizados. O fator é `1 + (crescimento + score estratégico + bônus de produtividade)/100`, a mesma fórmula de hoje.
- **Pela inflação prevista** (`goals2026.inflacaoPrevista`, fator `1 + inflação/100`): folha, aluguel, despesas operacionais, marketing fixo, administrativo e os custos fixos personalizados.
- **Impostos sobre faturamento:** `receitaBruta2026[m] × aliquotaDeducao(taxes)`. Deixam de ser o valor de 2025 multiplicado pelo fator.
- **Modo manual:** os valores digitados pelo cliente não são recalculados (comportamento atual).
- **Quando recalcula:** os cenários em modo percentual recalculam quando mudam:
  - o crescimento;
  - a inflação prevista;
  - o regime ou as alíquotas;
  - a base de 2025.

  O efeito automático (`usePlanData.tsx:624-662`) compara a projeção inteira, e não só a receita. A DRE/DFC/BP (`financialPlan2026`) recalcula quando a projeção do cenário base ou os impostos mudam. Assim o relatório nunca usa uma DRE velha.
- **Plano já salvo:** ao abrir, os cenários e a DRE são recalculados em memória com a regra nova. Seguindo a entrega 1, nada é gravado só por abrir; a gravação acontece na próxima edição do cliente.

**Exemplos (viram testes):**

| Base 2025 (mês) | Cenário | Esperado no mês |
|---|---|---|
| receita 100 mil, CMV 40 mil, aluguel 10 mil, folha 30 mil; Simples 6%; inflação 4,5 | Otimista 20% (score 0, bônus 0) | receita 120 mil; CMV 48 mil; aluguel 10.450; folha 31.350; impostos 7.200 |
| a mesma | Disruptivo −5% | receita 95 mil; CMV 38 mil; aluguel 10.450; impostos 5.700 |
| a mesma, inflação 0 | Otimista 20% | aluguel e folha iguais a 2025 |
| inflação vazia ou `NaN` | qualquer | trata como 0 |
| custo personalizado fixo de 2 mil e variável de 1 mil | Otimista 20%, inflação 4,5 | fixo 2.090; variável 1.200 |
| score estratégico 5, bônus 2 | Otimista 20% | receita × 1,27; fixos continuam × 1,045 |
| cenário em modo manual | muda a inflação | projeção não muda |

## Parte 3 — Telas que liam campos nunca preenchidos

`receitaProjetada`, `custosProjetados` e `despesasProjetadas` saem do tipo e do estado inicial. Uma função pura `resumoDoCenario(projection)`, em `src/utils/calculos/resumo.ts`, devolve por mês:

- `receita` = receita bruta;
- `custos` = impostos sobre faturamento + custos variáveis, incluindo os personalizados;
- `despesas` = custos fixos e despesas, incluindo os personalizados;
- `ebitda` = `receita − custos − despesas`. Precisa bater com o EBITDA da DRE.

Leitores que passam a usar a função:

- `PlanSummary.tsx:49-53`;
- `MonthlyTracking.tsx:58-63` e `:131-148`;
- `generateMonthlyAnalysis` (`usePlanData.tsx:1727`);
- os prompts `getScenarioAnalysis` (`geminiService.ts:615-625`) e `generatePlanReportAnalysis` (`geminiService.ts:1009-1034`).

`hasScenarioData` passa a ser "receita projetada do ano > 0". O rótulo "Custos realizados" do Acompanhamento ganha a dica "inclui impostos sobre vendas", para o realizado ser comparável ao projetado.

**Exemplos (viram testes):**

| Projeção (mês) | `resumoDoCenario` |
|---|---|
| receita 120 mil, impostos 7.200, CMV 48 mil, aluguel 10.450, folha 31.350 | custos 55.200; despesas 41.800; EBITDA 23.000 (igual à DRE do mesmo mês) |
| projeção vazia (conta nova) | tudo 0; o Acompanhamento mostra o aviso "Dados de cenário não encontrados" |
| plano antigo com `receitaProjetada: {}` salvo | ignorado, sem erro |

## Parte 4 — Erros pontuais

| Onde | Hoje | Correção | Exemplo |
|---|---|---|---|
| Payback do CAC (`usePlanData.tsx:827-829`) | divide o ticket mensal por 12 de novo | `cac / (ticketMedio × margemBruta%)` | CAC 1.200, ticket 1.000/mês, margem 40% → 3 meses (hoje 36) |
| Gráfico de Planejamento Comercial (`CommercialPlanning.tsx:346`) | `dataKey="projeção"`, mas o dado é `projecao` | `dataKey="projecao"` | a série "Projeção" aparece |
| Relatório (`ReportPreview.tsx:105,689`) | lê `dre.despesasFixas`, que não existe | soma de folha, marketing, operacionais e outras despesas fixas da DRE | linha deixa de sair 0 |
| Relatório (`ReportPreview.tsx:668-670`) | "Lucro Líquido 2025 (Real)" mostra o EBITDA 2025 | lucro líquido 2025 pela função da Parte 1 | Simples: igual ao EBITDA 2025; Real: EBITDA − IRPJ/CSLL |

## Fora desta entrega

- CAPEX, depreciação, financiamentos, aportes e contratações no caixa e na folha (próxima entrega).
- Tabela da reforma tributária em `Taxes.tsx:13-18` e a CBS de 2027 (entrega do plano por ano).
- Capital de giro na DFC e o patrimônio líquido do BP como diferença.
- Plano por ano (2027 sem sobrescrever 2026).

## Condições de parada

- Se o recálculo ao abrir um plano salvo só puder ser feito gravando no Firestore sem uma edição do cliente, parar e reportar. Isso iria contra a entrega 1.
- Se alguma tela ou relatório depender do valor antigo de `impostosSobreFaturamento` 2026 crescido pelo fator, parar e reportar.
- Se a Coleta de Dados permitir digitar à mão o imposto de 2025 e `applyTaxesTo2025` sobrescrevê-lo, manter o comportamento atual e registrar em aberto. Não mudar sem perguntar.

## Limitação conhecida

Planos no Presumido ou Real com IRPJ/CSLL preenchidos têm o imposto sobre faturamento de **2025** salvo com a regra antiga, que inclui IRPJ/CSLL. Ele só é recalculado quando um campo de imposto muda, como já acontece hoje. A projeção de 2026 não é afetada, porque passa a calcular a dedução pela alíquota.

## Passos humanos

Nenhum além dos da entrega 1: deploy e publicação. Esta entrega não muda regras do Firestore nem dados de produção.

## Verificação (feita pelo `/ship`)

- `npm run typecheck`, `npm test`, `npm run test:rules`, `npm run build`, `npm audit --audit-level=high`.
- Preview do build no celular e no desktop. As telas com números (Resumo, Acompanhamento, Cenários, DRE, Relatório) dependem de uma conta de teste; sem ela, ficam em aberto.
