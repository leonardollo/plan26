# Entrega 2 — Números certos: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `executing-plans`, como o subagente implementador que a sessão principal despacha, para implementar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** todas as telas, relatórios e prompts de IA mostram receita, impostos, cenários e lucro calculados por uma única regra, a do regime tributário, e com fixos pela inflação.

**Arquitetura:**
- **Regras de cálculo:** saem do hook para funções puras em `src/utils/calculos/`, cada uma com o seu teste: `impostos.ts`, `cenario.ts`, `planoFinanceiro.ts`, `resumo.ts` e `indicadores.ts`.
- **Hook `usePlanData`:** só chama essas funções.
- **Recálculo de plano já salvo:** acontece dentro da própria carga, no mesmo commit que traz o plano lido. Assim o `acabouDeCarregar` da entrega 1 continua impedindo a gravação sem edição.

**Tecnologias:** React 19, TypeScript 5.9, Vitest + jsdom + Testing Library.

**Especificação:** `docs/superpowers/specs/2026-11-10-numeros-certos-design.md`. Leia junto com este plano: as tabelas de exemplos de lá são os valores dos testes daqui.

## Restrições globais

- **Branch:** `fix/numeros-certos`, no checkout principal, sem worktree. No mínimo um commit por tarefa, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **npm:** usar só o npm; não tocar no `pnpm-lock.yaml`.
- **Proibido:** `firebase deploy`, `vercel`, push, merge na `main` e qualquer comando contra `plan-ea4cc`.
- **RAM (16 GB):** `tsc`, `vitest` e `build` rodam um de cada vez. Rode só os testes afetados, com `npx vitest run <arquivo de teste>` ou `npx vitest related --run <arquivos>`. A suíte inteira, o typecheck completo e o build ficam para o `/ship`.
- **Comandos:** um comando simples por chamada, a partir da raiz, sem `cd`, `$?` ou `${...}`. Edite com a ferramenta de edição, nunca com `sed -i`.
- **Arquivos grandes:** leia por faixa, nunca inteiros: `src/hooks/usePlanData.tsx`, `src/services/geminiService.ts` e `src/components/CommercialPlanning.tsx`.
- **Comentários:** cada decisão que restringe o código ganha um comentário de uma linha, em português, explicando o porquê.
- **Valores:** porcentagens chegam como número de 0 a 100 (`6` = 6%). `null`, `undefined`, `NaN` e string vazia valem 0. Nenhuma função devolve `NaN`.
- **Regime:** comparar `taxes.regimeTributario` com `'Simples Nacional'`, `'Lucro Presumido'` e `'Lucro Real'`. Antes, confira os valores exatos do `<select>` em `src/components/Taxes.tsx`. Qualquer outro valor conta como Simples.
- **Textos fixos da interface (exatos):**
  - dica do campo Alíquota Efetiva: "Se souber a alíquota total, preencha aqui. No Lucro Real, não inclua IRPJ e CSLL: eles são calculados sobre o lucro."
  - dica do custo realizado no Acompanhamento: "inclui impostos sobre vendas"

## Review Focus

1. **Plano antigo aberto sem edição:** os números novos aparecem e nada é gravado (`setDoc` não é chamado). Teste na Tarefa 3.
2. **Cenário em modo manual:** mudar a base, a inflação ou os impostos não sobrescreve os valores digitados. Teste na Tarefa 2.
3. **Impostos e inflação incompletos** (`taxes` parcial, regime `''`, inflação `NaN`, campos `null`): o resultado é 0 e nunca `NaN`. Testes nas Tarefas 1 e 2.
4. **Sem laço e sem gravação espúria:** abrir Liquidez ou Indicadores, que chamam `calculateFinancialPlan2026` ao montar, com a DRE já em dia não muda estado nem grava. Teste na Tarefa 3.
5. **Troca do cenário base** (Conservador → Otimista): a DRE passa a refletir a projeção do novo cenário. Teste na Tarefa 3.

## Condições de parada (copiadas da especificação, mais uma)

- Se o recálculo ao abrir um plano salvo só funcionar gravando no Firestore sem uma edição do cliente, pare e reporte.
- Se alguma tela ou relatório depender do `impostosSobreFaturamento` de 2026 crescido pelo fator, pare e reporte.
- Se a Coleta de Dados permitir digitar à mão o imposto de 2025 e o `applyTaxesTo2025` o sobrescrever, mantenha o comportamento atual e reporte. Não mude nada sem perguntar.
- Se `calcularPlanoFinanceiro2026` precisar de algum dado além de projeção, `taxes` e `investment`, pare e reporte antes de ampliar a assinatura.

## Passos humanos

Nenhum. Esta entrega não muda regras do Firestore nem dados de produção.

---

### Tarefa 1: Impostos pelo regime

**Arquivos:**
- Criar: `src/utils/calculos/impostos.ts`
- Teste: `src/utils/calculos/impostos.test.ts`

**Interfaces:**
- Produz:
  - `aliquotaDeducao(taxes: Partial<TaxesData>): number`, em %;
  - `irpjCsllMensal(taxes: Partial<TaxesData>, receitaBruta: MonthlyData, lair: MonthlyData): MonthlyData`, com os 12 meses de `MONTHS` sempre presentes;
  - `irpjCsllAnual(taxes: Partial<TaxesData>, receitaBrutaAnual: number, lairAnual: number): number`;
  - `lucroLiquidoMensal(taxes: Partial<TaxesData>, receitaBruta: MonthlyData, lair: MonthlyData): MonthlyData`, igual a `lair[m] − irpjCsllMensal[m]`.

- [ ] **Passo 1: escrever os testes, um `it` por linha da tabela da Parte 1 da especificação.**
  - **Simples 6%, receita 100.000/mês, LAIR 20.000/mês:**
    - `aliquotaDeducao` = 6;
    - `irpjCsllMensal` = 0 em todos os meses;
    - `lucroLiquidoMensal.jan` = 20.000.
  - **Presumido** (ISS 5, PIS 0,65, COFINS 3, IRPJ 4,8, CSLL 2,88):
    - `aliquotaDeducao` = 8,65;
    - `irpjCsllMensal.jan` = 7.680 com LAIR de −10.000 (`toBeCloseTo`).
  - **Presumido com `aliquotaEfetiva` 15:** dedução 15; IR 0 em todos os meses.
  - **Real com LAIR de 50.000 em todos os meses:**
    - todo mês = 15.000;
    - soma do ano = 180.000;
    - `irpjCsllAnual(t, 0, 600000)` = 180.000.
  - **Real com jan = −50.000 e fev–dez = 650.000/11 cada:** jan = 0; soma do ano = 180.000 (`toBeCloseTo`).
  - **Real com jan = +100.000, fev = −100.000 e o resto 0:** jan = 32.000; fev = −32.000; soma = 0.
  - **Real com o ano em prejuízo** (todos os meses −10.000): todo mês = 0; `irpjCsllAnual` = 0.
  - **Real com `aliquotaEfetiva` 12:** dedução 12; IR pela regra do Real (LAIR 50.000/mês → 15.000/mês).
  - **`{}` como taxes, `MonthlyData` vazio e campos `null`:** tudo 0; `Number.isNaN` é falso em todos os meses.
  - **Regime `undefined` e regime `''`:** iguais ao Simples.
- [ ] **Passo 2:** `npx vitest run src/utils/calculos/impostos.test.ts`. Esperado: FAIL, módulo não encontrado.
- [ ] **Passo 3: implementar as quatro funções em `src/utils/calculos/impostos.ts`.**

  Para o Real, use o acumulado. Para cada mês na ordem de `MONTHS`:

  ```
  base(m) = max(0, Σ lair até m)
  acum(m) = 0,15·base + 0,10·max(0, base − 20.000·(índice+1)) + 0,09·base
  ir[m]   = acum(m) − acum(m−1)
  ```

  Em `irpjCsllAnual`, a mesma regra vale com um período só, de limite 240.000. As alíquotas 15, 10 e 9 e o limite de 20.000/mês ficam em constantes nomeadas, com um comentário citando a regra.
- [ ] **Passo 4:** o mesmo comando do Passo 2. Esperado: PASS.
- [ ] **Passo 5: commit** `feat(calculos): IRPJ/CSLL e dedução pelo regime tributário`.

### Tarefa 2: Cenários com variáveis pelo crescimento e fixos pela inflação

**Arquivos:**
- Criar: `src/utils/calculos/cenario.ts`
- Teste: `src/utils/calculos/cenario.test.ts`
- Modificar:
  - `src/hooks/usePlanData.tsx:1229-1262` (`calculateScenarioProjection`);
  - `src/hooks/usePlanData.tsx:624-662` (efeito de recálculo);
  - `recalculateScenario` / `recalculateAllScenarios` (~1264-1310).
- Teste: `src/hooks/usePlanData.test.tsx`

**Interfaces:**
- Consome: `aliquotaDeducao` (Tarefa 1).
- Produz: `projetarCenario(base: FinancialSheetData, crescimentoPct: number, inflacaoPct: number, taxes: Partial<TaxesData>): ScenarioProjectionData`. O `crescimentoPct` já chega somado (crescimento + score + bônus).

- [ ] **Passo 1: escrever `cenario.test.ts` com a tabela da Parte 2 da especificação.**
  - Base com receita 100.000, CMV 40.000, aluguel 10.000 e folha 30.000 em todos os meses; Simples 6; inflação 4,5.
  - **`projetarCenario(base, 20, 4.5, t)`:** receita 120.000; CMV 48.000; aluguel 10.450; folha 31.350; impostos 7.200.
  - **Crescimento −5:** receita 95.000; CMV 38.000; aluguel 10.450; impostos 5.700.
  - **Inflação 0:** aluguel e folha iguais a 2025.
  - **Inflação `NaN`:** fixos iguais a 2025, sem `NaN`.
  - **Itens personalizados:** fixo de 2.000 → 2.090 e variável de 1.000 → 1.200. A projeção mantém `id` e `name` e guarda o valor em `values`.
  - **Crescimento 27 (20 + score 5 + bônus 2):** receita 127.000; aluguel 10.450.
- [ ] **Passo 2: escrever no `usePlanData.test.tsx` o teste de modo manual.**
  - Monte o hook com um `documento` que traga:
    - `financialSheet` com a base acima;
    - `scenariosInputMode.Otimista = 'manual'`;
    - uma projeção Otimista salva com `receitaBruta.jan = 999`.
  - Chame `updateInflation('10')`.
  - Esperado: `scenarios2026.Otimista.projection.receitaBruta.jan` continua 999; o Conservador muda os fixos para × 1,10.
- [ ] **Passo 3:** `npx vitest run src/utils/calculos/cenario.test.ts src/hooks/usePlanData.test.tsx`. Esperado: FAIL.
- [ ] **Passo 4: implementar `projetarCenario`.**
  - `calculateScenarioProjection` passa a delegar para ele, com `goals2026.inflacaoPrevista` e `taxes`.
- [ ] **Passo 5: no efeito de 624-662:**
  - pular os cenários com `planData.scenariosInputMode[name] === 'manual'`;
  - trocar a comparação de receita por `JSON.stringify(nova) !== JSON.stringify(antiga)` da projeção inteira;
  - deps: `JSON.stringify(planData.financialSheet)`, score, bônus, `goals2026.inflacaoPrevista`, `JSON.stringify(taxes)` e `JSON.stringify(planData.scenariosInputMode)`.

  O retorno antecipado com `acabouDeCarregar` continua: a carga é tratada na Tarefa 3.
- [ ] **Passo 6:** o mesmo comando do Passo 3. Esperado: PASS, incluindo os testes antigos do hook.
- [ ] **Passo 7: commit** `fix(cenarios): fixos pela inflação, variáveis pelo crescimento e impostos pela alíquota`.

### Tarefa 3: DRE com IR pelo regime e recálculo sem gravar

**Arquivos:**
- Criar: `src/utils/calculos/planoFinanceiro.ts`
- Teste: `src/utils/calculos/planoFinanceiro.test.ts`
- Modificar:
  - `src/hooks/usePlanData.tsx:1476-1576` (`calculateFinancialPlan2026`);
  - `carregarPlano` (~320-367);
  - um efeito novo, logo depois do efeito de cenários.
- Teste: `src/hooks/usePlanData.test.tsx`

**Interfaces:**
- Consome: `irpjCsllMensal` (Tarefa 1); `projetarCenario` (Tarefa 2).
- Produz:
  - `calcularPlanoFinanceiro2026(proj: ScenarioProjectionData, taxes: Partial<TaxesData>, investment: PlanData['investment']): { dre: DRE2026; dfc: DFC2026; bp: BP2026 }`. Use os nomes de tipo que existirem em `src/types.ts`.
  - `despesasFixasDaDre(dre: DRE2026): MonthlyData`, igual a `despesasFolha + despesasMarketing + despesasOperacionais + outrasDespesasFixas`.

- [ ] **Passo 1: escrever `planoFinanceiro.test.ts`.**
  - **Projeção da Tarefa 2 (Otimista, Simples 6):**
    - `dre.ebitda.jan` = 23.000;
    - `dre.irpjCsll.jan` = 0;
    - `dre.lucroLiquido.jan` = 23.000 (hoje dá 15.180).
  - **A mesma projeção no Real:**
    - `dre.irpjCsll.jan` = 0,24·23.000 + 0,10·3.000 = 5.820;
    - `dfc.fco.jan` = 23.000 − 5.820.
  - **`despesasFixasDaDre`:** o mês de exemplo dá 41.800 (folha 31.350 + aluguel 10.450, que entra em `despesasOperacionais`).
- [ ] **Passo 2: escrever os testes de hook do Review Focus 1, 4 e 5.**
  - **Plano antigo:**
    - o `documento` traz `financialSheet` com a base da Tarefa 2, `taxes` Simples 6 e uma projeção Conservador salva pela regra antiga (impostos de 6.000 × 1,1 e aluguel de 11.000);
    - depois de `montar()` e `avancar(10000)`: `scenarios2026.Conservador.projection.aluguel.jan` = 10.450; `impostosSobreFaturamento.jan` = 6.600; `planData.financialPlan2026.dre.irpjCsll.jan` = 0; `setDocMock` não foi chamado;
    - em seguida, uma edição (`updateCompanyProfile('name','X')`) mais `avancar(3500)` faz o `setDoc` gravar a projeção nova.
  - **Sem gravação espúria:** depois da carga, `act(() => result.current.calculateFinancialPlan2026())` mais `avancar(10000)` não chama `setDoc`.
  - **Troca do cenário base:** `setBaseScenario('Otimista')` → `dre.receitaBruta.jan` = 120.000.
- [ ] **Passo 3:** `npx vitest run src/utils/calculos/planoFinanceiro.test.ts src/hooks/usePlanData.test.tsx`. Esperado: FAIL.
- [ ] **Passo 4: implementar `calcularPlanoFinanceiro2026`.**
  - Mova o corpo atual de DRE/DFC/BP sem mudar as outras fórmulas. Só troca o `taxRate = 0.34` por `irpjCsllMensal(taxes, dre.receitaBruta, dre.lucroAntesImpostos)`.
  - `calculateFinancialPlan2026` passa a chamar essa função e só faz `setPlanData` se `JSON.stringify` do resultado diferir do `financialPlan2026` atual.
- [ ] **Passo 5: criar o efeito de recálculo da DRE.**
  - Deps: `baseScenario`, `JSON.stringify(scenarios2026[baseScenario].projection)`, `JSON.stringify(taxes)`, `JSON.stringify(planData.investment)`.
  - Ele chama `calculateFinancialPlan2026()`, com o mesmo retorno antecipado do efeito de cenários (`estadoDaCargaRef`, `acabouDeCarregar`).
- [ ] **Passo 6: recalcular dentro de `carregarPlano`.**
  - Monte os valores mesclados (padrões + lido) de `financialSheet`, `analysis`, `scenariosInputMode`, `goals2026.inflacaoPrevista`, `taxes` e `investment`.
  - Recalcule com `projetarCenario` cada cenário em modo percentual.
  - Calcule `financialPlan2026` com `calcularPlanoFinanceiro2026` sobre o cenário base atual.
  - Passe esses valores nos mesmos setters, no mesmo tique, antes de `acabouDeCarregar.current = true`.
  - Comentário: "Recalcula na própria carga: o commit da carga não é gravado (entrega 1), então abrir não salva."
  - Conta nova (documento inexistente) não recalcula.
- [ ] **Passo 7:** o mesmo comando do Passo 3. Esperado: PASS, incluindo os testes antigos de carga e salvamento.
- [ ] **Passo 8: commit** `fix(dre): IRPJ/CSLL pelo regime e DRE recalculada sem gravar ao abrir`.

### Tarefa 4: A mesma regra de imposto no resto do app

**Arquivos:**
- Criar: `src/utils/calculos/indicadores.ts`
- Teste: `src/utils/calculos/indicadores.test.ts`
- Modificar:
  - `src/hooks/usePlanData.tsx:1314-1334` (`applyTaxesTo2025`), `:832` (ROIC) e `:847-849` (`calculateSensitivityAnalysis`);
  - `src/components/Taxes.tsx:53-61` (`calculatedRate`) e `:211` (dica);
  - `src/components/DataCollection.tsx:99-111`;
  - `src/components/DreComparison.tsx:208` e `:256`;
  - `src/components/SensitivityAnalysis.tsx:26`.
- Testes:
  - `src/hooks/usePlanData.test.tsx`;
  - `src/components/DreComparison.test.tsx` (novo; `usePlan` mockado como em `src/components/Settings.test.tsx`).

**Interfaces:**
- Consome: `aliquotaDeducao`, `irpjCsllAnual` e `lucroLiquidoMensal` (Tarefa 1).
- Produz:
  - `nopat(taxes: Partial<TaxesData>, receitaBrutaAnual: number, ebitdaAnual: number): number`, igual a `ebitda − irpjCsllAnual`;
  - `paybackCacMeses(cac: number, ticketMedioMensal: number, margemBrutaPct: number): number`, que dá 0 quando o denominador ≤ 0.

- [ ] **Passo 1: escrever `indicadores.test.ts`.**
  - `nopat` no Simples, com EBITDA 600.000, dá 600.000.
  - `nopat` no Real, com EBITDA 600.000, dá 420.000 (hoje, com × 0,76, daria 456.000).
  - `paybackCacMeses(1200, 1000, 40)` = 3 (hoje 36).
  - `paybackCacMeses(1200, 0, 40)` = 0.
- [ ] **Passo 2: escrever o teste de hook da sensibilidade.**
  - Numa conta nova (Simples), a célula central de `calculateSensitivityAnalysis(100000, 40000, 30000)` tem `ebit` 30.000 e `netProfit` 30.000. Hoje dá 22.800.
- [ ] **Passo 3: escrever `DreComparison.test.tsx`.**
  - Simples 6; projeção Conservador com receita 100.000, impostos 6.000 e CMV 40.000 por mês; mais nada.
  - O "Lucro Líquido" planejado de jan é igual ao EBITDA planejado (54.000), e não 85% dele.
- [ ] **Passo 4:** `npx vitest run src/utils/calculos/indicadores.test.ts src/hooks/usePlanData.test.tsx src/components/DreComparison.test.tsx`. Esperado: FAIL.
- [ ] **Passo 5: ligar as funções em cada ponto.**
  - **`applyTaxesTo2025` e `calculatedRate`:** `aliquotaDeducao(taxes) / 100`. Comentário: a simulação da reforma em `Taxes.tsx:521-535` passa a comparar só os tributos sobre consumo, que são os que a reforma substitui.
  - **Dica de `aliquotaEfetiva`:** o texto exato das Restrições globais.
  - **`DataCollection`:** `lucroLiquidoMensal(taxes, financialSheet.receitaBruta.values2025, lair)`, com `lair[m]` = `ebitda` do `monthlySummary`. Os padrões 15/9 saem.
  - **`DreComparison`:**
    - antes do laço, calcule `lucroLiquidoMensal` do planejado (receita e EBITDA planejados por mês) e do realizado;
    - no realizado, um mês com `aEbitda === null` conta 0 no acumulado e continua exibindo `null`.
  - **`SensitivityAnalysis.tsx:26`:** `baseEbit − irpjCsllAnual(taxes, Σ projection.receitaBruta, baseEbit)`; pegue `taxes` do `usePlan()`.
  - **`calculateSensitivityAnalysis`:**
    - a receita bruta de cada célula é `newRevenue / (1 − aliquotaDeducao/100)`, quando a alíquota é menor que 100; senão, é `newRevenue`;
    - o imposto da célula é `irpjCsllAnual(taxes, receitaBruta, newEbit)`.
  - **ROIC:** `nopat(taxes, Σ dre.receitaBruta, totalEbitda) / investedCapital × 100`.
  - **Payback:** `paybackCacMeses(cac, ticketMedio, margemBrutaPercent)`; acrescente `taxes` às deps do `useMemo`.
- [ ] **Passo 6:** o mesmo comando do Passo 4. Esperado: PASS.
- [ ] **Passo 7: commit** `fix(impostos): uma regra de IR para coleta, comparativo, sensibilidade, ROIC e payback`.

### Tarefa 5: Resumo e Acompanhamento leem a projeção

**Arquivos:**
- Criar: `src/utils/calculos/resumo.ts`
- Teste: `src/utils/calculos/resumo.test.ts`
- Modificar:
  - `src/types.ts:453-459` (tirar `receitaProjetada`, `custosProjetados` e `despesasProjetadas`);
  - `src/hooks/usePlanData.tsx:221` (estado inicial) e `:1727` (`generateMonthlyAnalysis`);
  - `src/components/PlanSummary.tsx:47-53`;
  - `src/components/MonthlyTracking.tsx:56-66`, `:106` e `:128-150`;
  - `src/services/geminiService.ts:615-625` e `:1006-1011`.
- Testes:
  - `src/components/MonthlyTracking.test.tsx` (novo; `usePlan` mockado);
  - `src/services/geminiService.test.ts`.

**Interfaces:**
- Produz: `resumoDoCenario(projection: Partial<ScenarioProjectionData> | undefined): { receita: MonthlyData; custos: MonthlyData; despesas: MonthlyData; ebitda: MonthlyData }`, com os 12 meses sempre presentes.

- [ ] **Passo 1: escrever `resumo.test.ts`.**
  - Para a projeção Otimista da Tarefa 2, jan dá receita 120.000, custos 55.200, despesas 41.800 e EBITDA 23.000. O EBITDA é igual a `calcularPlanoFinanceiro2026(...).dre.ebitda.jan`.
  - `resumoDoCenario(undefined)` e `resumoDoCenario({})` dão tudo 0.
- [ ] **Passo 2: escrever `MonthlyTracking.test.tsx`.**
  - Com uma projeção de receita > 0 e um `receitaProjetada: {}` antigo no objeto, a tela não mostra "Dados de cenário não encontrados" e mostra a receita projetada do mês.
  - Com a projeção vazia, mostra o aviso.
- [ ] **Passo 3: escrever o teste do Gemini.**
  - No estilo de `geminiService.test.ts`, o prompt de `getScenarioAnalysis` contém a receita do Otimista vinda de `projection` ("R$ 1.440.000,00" para 120.000 × 12; confira o formato de `formatCurrency`).
- [ ] **Passo 4:** `npx vitest run src/utils/calculos/resumo.test.ts src/components/MonthlyTracking.test.tsx src/services/geminiService.test.ts`. Esperado: FAIL.
- [ ] **Passo 5: implementar `resumoDoCenario` e trocar todos os leitores por ele.**
  - `hasScenarioData` passa a ser `Σ resumo.receita > 0`.
  - O rótulo da linha 106 vira "Custos variáveis e impostos".
  - O campo de custos realizados ganha a dica exata das Restrições globais.
  - Tire os três campos do tipo e do estado inicial. Depois, `npm run typecheck` deve achar todos os leitores restantes; corrija até ficar sem erros. Este é o único typecheck completo da entrega fora do `/ship`; confira antes com `pgrep -fl "tsc|vitest"`.
- [ ] **Passo 6:** o mesmo comando do Passo 4. Esperado: PASS.
- [ ] **Passo 7: commit** `fix(resumo): Resumo, Acompanhamento e prompts usam a projeção do cenário`.

### Tarefa 6: Correções pontuais do relatório e do gráfico

**Arquivos:**
- Modificar:
  - `src/components/CommercialPlanning.tsx:346`;
  - `src/components/reports/ReportPreview.tsx:105`, `:668-670` e `:689`.
- Teste: `src/components/reports/ReportPreview.test.tsx` (novo; `usePlan` mockado).

**Interfaces:**
- Consome: `despesasFixasDaDre` (Tarefa 3); `lucroLiquidoMensal` (Tarefa 1).

- [ ] **Passo 1: escrever `ReportPreview.test.tsx`.**
  - DRE com `despesasFolha.jan` 30.000 e `despesasOperacionais.jan` 10.000: a linha "(-) Despesas Fixas" mostra 40.000, e não 0.
  - No Simples, o "Lucro Líquido" de 2025 é igual ao EBITDA de 2025. No Real, com EBITDA de 2025 de 50.000/mês, mostra 420.000.
- [ ] **Passo 2:** `npx vitest run src/components/reports/ReportPreview.test.tsx`. Esperado: FAIL.
- [ ] **Passo 3: corrigir.**
  - **`dataKey`:** passa a ser `"projecao"`.
  - **Despesas fixas:** os totais e a linha da tabela usam `despesasFixasDaDre(dre)`; a linha da tabela deixa de ler `dre[key]` para esse item.
  - **Lucro 2025:** `Σ lucroLiquidoMensal(taxes, financialSheet.receitaBruta.values2025, ebitda mensal de summary2025.monthlySummary)`, usado no valor e na variação.
- [ ] **Passo 4:** o mesmo comando do Passo 2. Esperado: PASS.
- [ ] **Passo 5: commit** `fix(relatorio): despesas fixas, lucro 2025 e série de projeção do gráfico`.

## Fora deste plano (registrar se aparecer)

- A linha "(-) Custos Variáveis" do relatório não soma `outrosCustosVariaveis`.
- CAPEX, depreciação, financiamentos, tabela da reforma, CBS 2027, capital de giro e plano por ano.
