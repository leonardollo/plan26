# Reforma tributária nos planos de 2027+ — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans, as the implementer subagent the main session dispatches, to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** nos planos de 2027 em diante (Presumido e Real), a CBS estimada e editável substitui PIS +
COFINS no imposto sobre a receita do ano do plano, e os textos da reforma ficam corretos.

**Architecture:** uma função pura nova, `aliquotaDoAnoDoPlano(taxes, anoPlano, base)`, em
`src/utils/calculos/impostos.ts`, decide a alíquota do ano do plano; `aliquotaDeducao` continua
valendo para o ano base. `projetarCenario` recebe `anoPlano` e usa a função nova; o hook passa o ano
do plano aberto. A aba Impostos mostra o campo `cbsEfetiva`, a sugestão e o total do ano do plano.

**Tech Stack:** React 19, TypeScript 5.9, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-reforma-tributaria-design.md` (leia antes de começar).

## Global Constraints

- Branch `feat/reforma-tributaria`, no checkout principal (sem worktree). Nada de push, merge ou deploy.
- `ANO_DA_CBS = 2027` e `CBS_DE_REFERENCIA = 11.3` ficam num bloco `// ano-real:início` / `// ano-real:fim` em `impostos.ts`, com comentário do porquê (11,2% de CBS + 0,1% de IBS em 2027-28; valor do TCU de 28/10/2026, atualizar quando o Senado fixar).
- Todo texto novo com ano literal fica dentro de um bloco `ano-real`. Não amplie a lista de exceções de `src/utils/semAnoFixo.test.ts`; se precisar, pare e reporte.
- Anos na tela vêm de `anoPlano` / `anoBase` do `usePlan()`, nunca de número fixo.
- `cbsEfetiva` vazia ou 0 usa a sugestão (mesma regra de `aliquotaEfetiva > 0`).
- `cbsEfetiva` não entra em `CAMPOS_DE_IMPOSTO_COPIADOS`.
- `applyTaxesTo2025` e `calculatedRate` (`Taxes.tsx:58`) continuam com `aliquotaDeducao`: são do ano base.
- Fora do escopo: transição 2029-32 no cálculo, Simulador (27,5%), Simples híbrido, `PricingCalculator.tsx`, Imposto Seletivo, split payment.
- Leia `src/hooks/usePlanData.tsx` e `src/services/geminiService.ts` por faixa de linhas, nunca inteiros.
- Commits terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (segundo `-m`).
- Testes por tarefa: só os arquivos afetados (`npx vitest run <arquivo>`). Typecheck completo e suíte inteira ficam para o `/ship`. Antes de rodar algo pesado: `pgrep -fl "tsc|vitest|next build|playwright"`.

## Review Focus

1. Cliente apaga o campo CBS (o app grava 0): o campo mostra vazio com a sugestão no placeholder, não "0" → teste na Tarefa 3.
2. Abrir um plano 2026 já salvo: números idênticos aos de hoje e nenhuma gravação → teste na Tarefa 2.
3. Base com meses vazios, `null` ou string (`'100000'`, `''`) na Coleta: somam como `num()` → teste na Tarefa 1.
4. Mudar só a CBS na aba não dispara o preenchimento automático do imposto do ano base (`applyTaxesTo2025`) → teste na Tarefa 3.
5. Começar o ano seguinte a partir de um plano com `cbsEfetiva` 8 e `aliquotaEfetiva` 15: o novo plano vem com `cbsEfetiva` `null` e `aliquotaEfetiva` 15 → teste na Tarefa 1.

---

### Tarefa 1: Regra da CBS e campo `cbsEfetiva`

**Files:**
- Modify: `src/utils/calculos/impostos.ts` (constantes e duas funções novas)
- Modify: `src/types.ts:497-514` (`TaxesData.cbsEfetiva: number | null`)
- Modify: `src/hooks/usePlanData.tsx:243`, `:1744`, `:1759` (valores iniciais de `taxes`: `cbsEfetiva: null`)
- Test: `src/utils/calculos/impostos.test.ts`, `src/services/planos.test.ts`

**Interfaces:**
- Produces:
  - `export const ANO_DA_CBS: number` (2027), `export const CBS_DE_REFERENCIA: number` (11.3)
  - `export const cbsSugerida = (base: Partial<FinancialSheetData>): number` — em %
  - `export const aliquotaDoAnoDoPlano = (taxes: Partial<TaxesData>, anoPlano: number, base: Partial<FinancialSheetData>): number` — em %

- [ ] **Step 1: Testes que falham** em `impostos.test.ts`, `describe('aliquotaDoAnoDoPlano')`. Monte a base com um auxiliar `baseCom(R, V, extra?)` que põe R em `receitaBruta.values2025.jan` e V em `cmv.values2025.jan`. Cadastro padrão `presumido = { regimeTributario: 'Lucro Presumido', iss: 5, pis: 0.65, cofins: 3 }`; R = 1.000.000 e V = 400.000 salvo indicação. `toBeCloseTo` em todos:

| Teste | Chamada | Esperado |
|---|---|---|
| 2026 fica igual | `(presumido, 2026, base)` | 8.65 |
| 2027 usa a CBS sugerida | `(presumido, 2027, base)` | 11.78 |
| CBS digitada substitui | `({...presumido, cbsEfetiva: 8}, 2027, base)` | 13 |
| CBS 0 usa a sugestão | `({...presumido, cbsEfetiva: 0}, 2027, base)` | 11.78 |
| alíquota efetiva manda | `({...presumido, aliquotaEfetiva: 15}, 2027, base)` | 15 |
| Simples fica igual | `({regimeTributario: 'Simples Nacional', simplesNacional: 6}, 2027, base)` | 6 |
| Real com ICMS | `({regimeTributario: 'Lucro Real', icms: 18, iss: 0, pis: 1.65, cofins: 7.6}, 2027, base)` | 24.78 |
| custo maior que a receita | `(presumido, 2027, baseCom(1e6, 1.2e6))` | 5 |
| base sem receita | `(presumido, 2027, baseCom(0, 0))` | 16.3 |
| custo negativo | `(presumido, 2027, baseCom(1e6, -100000))` | 16.3 |
| item variável próprio conta | base com `cmv.jan` 300.000 e `customCustosVariaveis: [{ id: 'x', name: 'Embalagem', values2025: { jan: 100000 } }]` | 11.78 |
| 2029 usa a regra de 2027 | `(presumido, 2029, base)` | 11.78 |
| meses vazios e strings | `receitaBruta.values2025 = { jan: '1000000' as any, fev: null as any, mar: '' as any }`, `cmv.values2025 = { jan: 400000 }` | 11.78 |

  Também: `cbsSugerida(baseCom(1e6, 4e5))` ≈ 6.78 e `cbsSugerida(baseCom(0, 0))` = 11.3.

- [ ] **Step 2: Teste que falha** em `planos.test.ts`: origem com `taxes` `{ ...cheia, cbsEfetiva: 8, aliquotaEfetiva: 15 }` → `montarPlanoDoAnoSeguinte(origem, iniciais()).taxes.cbsEfetiva` é `null` e `.aliquotaEfetiva` é 15. Acrescente `cbsEfetiva: null` ao `taxes` de `iniciais()` do teste.

- [ ] **Step 3: Rodar e ver falhar**
  Run: `npx vitest run src/utils/calculos/impostos.test.ts src/services/planos.test.ts`
  Expected: FAIL (`aliquotaDoAnoDoPlano` não exportada; `cbsEfetiva` undefined em vez de null).

- [ ] **Step 4: Implementar** as constantes (bloco `ano-real`), `cbsSugerida` (`CBS_DE_REFERENCIA × min(1, max(0, 1 − V/R))`, R ≤ 0 → `CBS_DE_REFERENCIA`; somas com `num()` sobre `MONTHS`, incluindo cada item de `customCustosVariaveis`), `aliquotaDoAnoDoPlano` na ordem da Parte 1 da especificação, e `cbsEfetiva` em `TaxesData` e nos três valores iniciais do hook. Comentário de porquê em `cbsSugerida`: a CBS é não cumulativa e o crédito das compras é aproximado pelos custos variáveis.

- [ ] **Step 5: Rodar e ver passar**
  Run: `npx vitest run src/utils/calculos/impostos.test.ts src/services/planos.test.ts src/utils/semAnoFixo.test.ts`
  Expected: PASS.

- [ ] **Step 6: Commit** — `git add` dos arquivos acima; mensagem `feat(impostos): CBS do ano do plano a partir de 2027`.

### Tarefa 2: Projeção e hook usam a alíquota do ano do plano

**Files:**
- Modify: `src/utils/calculos/cenario.ts:16-32`
- Modify: `src/hooks/usePlanData.tsx:263` (`recalcularPlanoLido`) e sua chamada, `:301`, `:946`, `:1346`
- Test: `src/utils/calculos/cenario.test.ts`, `src/hooks/usePlanData.test.tsx`; atualizar chamadas em `src/utils/calculos/resumo.test.ts` e `src/utils/calculos/planoFinanceiro.test.ts`

**Interfaces:**
- Consumes: `aliquotaDoAnoDoPlano` (Tarefa 1).
- Produces: `projetarCenario(base, crescimentoPct, inflacaoPct, taxes, anoPlano: number, custoContratacoes?)` — `anoPlano` é obrigatório e entra antes de `custoContratacoes`. `recalcularPlanoLido(data, baseScenario, anoPlano: number)`.

- [ ] **Step 1: Atualizar as chamadas existentes** de `projetarCenario` nos três arquivos de teste para passar `2026` como quinto argumento (constante local `const ANO = 2026` em cada arquivo; arquivos de teste ficam fora da guarda).

- [ ] **Step 2: Testes que falham** em `cenario.test.ts`, `describe('projetarCenario — imposto do ano do plano')`. Base: `receitaBruta.values2025 = { jan: 100000, fev: 900000 }`, `cmv.values2025 = { jan: 400000 }`, demais linhas vazias; `presumido = { regimeTributario: 'Lucro Presumido', iss: 5, pis: 0.65, cofins: 3 }`; crescimento e inflação 0:
  - `projetarCenario(base, 0, 0, presumido, 2027).impostosSobreFaturamento.jan` ≈ 11780
  - `projetarCenario(base, 0, 0, presumido, 2026).impostosSobreFaturamento.jan` ≈ 8650

- [ ] **Step 3: Testes que falham** em `usePlanData.test.tsx`, `describe('usePlanData — CBS no plano 2027')`, com `bancoCom`, `perfil`, `baseDeExemplo` e `projecaoVazia` já existentes. Documento: `perfil('B', { planData: { financialSheet: baseDeExemplo() }, taxes: { regimeTributario: 'Lucro Presumido', iss: 5, pis: 0.65, cofins: 3, irpj: 4.8, csll: 2.88 }, scenarios2026: { Conservador: { growthPercentage: 10, projection: projecaoVazia() } } })`. A base dá R = 1,2 mi e V = 480 mil, CBS 6,78; o score de mercado vazio (−1,5) leva o crescimento a 8,5% → receita de janeiro 108.500.
  - `'plano 2027 abre com a CBS no cenário e não grava'`: banco `{ 'users/u1/planos/2027': doc }` → `scenarios2026.Conservador.projection.impostosSobreFaturamento.jan` ≈ 12781.3 (108.500 × 11,78%); após `avancar(10000)`, `setDocMock` não chamado.
  - `'o mesmo plano em 2026 continua com PIS e COFINS'`: banco `{ 'users/u1': doc }` → ≈ 9385.25 (108.500 × 8,65%); `setDocMock` não chamado.
  - `'CBS digitada no 2027 recalcula o cenário'`: no plano 2027, `act(() => result.current.updateTaxes('cbsEfetiva', '8'))` → Conservador jan ≈ 14105 (108.500 × 13%).
  - `'sensibilidade no 2027 reconstrói a receita bruta com a CBS'`: no plano 2027, `calculateSensitivityAnalysis(100000, 40000, 30000, 20)[2][2].netProfit` ≈ 21294.49 (30.000 − 7,68% × 100.000 ÷ 0,8822). No mesmo documento em 2026 ≈ 21592.78 (÷ 0,9135).

- [ ] **Step 4: Rodar e ver falhar**
  Run: `npx vitest run src/utils/calculos/cenario.test.ts src/hooks/usePlanData.test.tsx`
  Expected: os testes novos de 2027 FAIL (valores de 8,65%); os de 2026 passam.

- [ ] **Step 5: Implementar.** Em `projetarCenario`, troque `aliquotaDeducao(taxes)` por `aliquotaDoAnoDoPlano(taxes, anoPlano, base)` e atualize o JSDoc ("projeção do ano do plano a partir da base"). No hook: `recalcularPlanoLido` recebe o `anoPlano` do plano que está sendo carregado (o ano do caminho lido, não o estado anterior) e o repassa em `:301`; `:1346` e `calculateSensitivityAnalysis` usam o `anoPlano` aberto e `planData.financialSheet` como base. Se algum outro ponto calcular o imposto do ano do plano por conta própria, pare e reporte.

- [ ] **Step 6: Rodar e ver passar**
  Run: `npx vitest run src/utils/calculos/cenario.test.ts src/utils/calculos/resumo.test.ts src/utils/calculos/planoFinanceiro.test.ts src/hooks/usePlanData.test.tsx`
  Expected: PASS, inclusive os testes antigos do hook (nenhum plano 2026 muda de número).

- [ ] **Step 7: Commit** — mensagem `feat(cenario): projeção do ano do plano usa a CBS a partir de 2027`.

### Tarefa 3: Aba Impostos — campo CBS, total do ano do plano e aviso

**Files:**
- Modify: `src/components/Taxes.tsx` (bloco "Impostos sobre Faturamento", `:208-232`, e `renderPercentInput`, `:100-120`)
- Test: `src/components/Taxes.test.tsx`

**Interfaces:**
- Consumes: `ANO_DA_CBS`, `cbsSugerida`, `aliquotaDoAnoDoPlano` (Tarefa 1); `anoPlano`, `anoBase` de `usePlan()`.
- Produces: `renderPercentInput(name, label, hint?, disabled = false, opcoes?: { placeholder?: string; vazioQuandoZero?: boolean })`.

- [ ] **Step 1: Testes que falham** em `Taxes.test.tsx`, `describe('Taxes — CBS a partir de 2027')`. Auxiliar `montarPlanoCbs(ano, taxesExtra)` que reaproveita `montarPlano({})`, define `anoPlano: ano`, `anoBase: ano - 1`, `taxes = { regimeTributario: 'Lucro Presumido', iss: 5, pis: 0.65, cofins: 3, inssPatronal: 0, fgts: 0, ratTerceiros: 0, totalEncargosFolha: 0, ...taxesExtra }` e `financialSheet.cmv = { values2025: mesesIguais(40000) }` (R 1,2 mi, V 480 mil → sugestão 6,78).
  - 2027: `getByText('CBS efetiva (%)')`; `getByPlaceholderText('Sugestão: 6,78%')`; `getByText('Imposto sobre a receita em 2027')` e `getByText('11,78%')`; `getByText('Vale para 2026; em 2027 a CBS substitui')` (dica de PIS e de COFINS: `getAllByText(...)` com 2).
  - `cbsEfetiva: 0` em 2027: o input do placeholder `'Sugestão: 6,78%'` tem `value` `''`.
  - 2026: `queryByText('CBS efetiva (%)')` null; `queryByText(/Imposto sobre a receita em/)` null.
  - 2027 Simples (`regimeTributario: 'Simples Nacional', simplesNacional: 6`): `queryByText('CBS efetiva (%)')` null.
  - 2027 com `aliquotaEfetiva: 15`: `getByText(/Em 2027 o PIS e a COFINS deixam de existir/)`; em 2026 com `aliquotaEfetiva: 15`, `queryByText(/deixam de existir e entra a CBS/)` null.
  - 2027, linha de imposto do ano base vazia: anote quantas vezes `applyTaxesTo2025` foi chamado depois da montagem; rerender só com `cbsEfetiva: 8` → o número de chamadas não muda.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run src/components/Taxes.test.tsx`
  Expected: FAIL (campo e textos não existem).

- [ ] **Step 3: Implementar**, só quando `anoPlano >= ANO_DA_CBS`:
  - fora do Simples, logo depois de ICMS: `renderPercentInput('cbsEfetiva', 'CBS efetiva (%)', <dica>, false, { placeholder: \`Sugestão: ${pct(cbsSugerida(base))}%\`, vazioQuandoZero: true })`, com `base = planData.financialSheet`. Dica literal: "Estimativa de 11,3% (referência do TCU, a confirmar pelo Senado) sobre a parte da receita que não é custo variável, porque a CBS desconta o crédito das compras. Deixe em branco para usar a sugestão." (em bloco `ano-real`, porque cita a alíquota da lei);
  - dicas de PIS e COFINS: `Vale para ${anoBase}; em ${anoPlano} a CBS substitui`; em 2026 ficam as atuais;
  - abaixo dos campos do bloco: rótulo `Imposto sobre a receita em ${anoPlano}` e o valor `${pct(aliquotaDoAnoDoPlano(taxes, anoPlano, base))}%`;
  - fora do Simples e com `aliquotaEfetiva > 0`, aviso: `Em ${anoPlano} o PIS e a COFINS deixam de existir e entra a CBS. Se a alíquota efetiva inclui PIS e COFINS, revise-a ou deixe-a em branco para o app calcular.`
  - `pct` formata com `toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
  - `vazioQuandoZero` passa `null` ao `CurrencyInput` quando o valor é 0, para o placeholder aparecer.

- [ ] **Step 4: Rodar e ver passar**
  Run: `npx vitest run src/components/Taxes.test.tsx src/utils/semAnoFixo.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit** — mensagem `feat(impostos): campo CBS e imposto do ano do plano na aba Impostos`.

### Tarefa 4: Textos da reforma

**Files:**
- Modify: `src/components/Taxes.tsx:17-18` (linha do tempo) e `:346-352` (cartão "Novo Tributo Federal")
- Modify: `src/services/geminiService.ts:230` (calendário do prompt)

- [ ] **Step 1: Trocar os textos**, todos dentro de blocos `ano-real` (o cartão do `:351` precisa de um bloco novo se ainda não estiver em um):
  - `'2031: 60% ICMS/ISS + 40% IBS'` → `'2031: 70% ICMS/ISS + 30% IBS'`; `'2032: 40% ICMS/ISS + 60% IBS'` → `'2032: 60% ICMS/ISS + 40% IBS'`;
  - `'CBS entra com alíquota cheia (~8,8%)'` → `'CBS de 11,2% + 0,1% de IBS em 2027-28 (referência de 11,3% do TCU, a confirmar pelo Senado)'`;
  - cartão: `CBS ~8,8%` → `CBS ~11,2%`; subtítulo `Substitui PIS/COFINS com alíquota cheia` → `+ 0,1% de IBS em 2027-28; referência do TCU, a confirmar pelo Senado`;
  - prompt: `- 2027: Extincao de PIS/COFINS, CBS com aliquota cheia (~8,8%)` → `- 2027: Extincao de PIS/COFINS; CBS de 11,2% + 0,1% de IBS em 2027-28 (referencia de 11,3% do TCU, a confirmar pelo Senado)` (sem acentos, como o resto do prompt).

- [ ] **Step 2: Conferir**
  Run: `grep -rn "8,8%\|2032: 40%" src`
  Expected: nenhuma linha.
  Run: `npx vitest run src/utils/semAnoFixo.test.ts src/components/Taxes.test.tsx`
  Expected: PASS.

- [ ] **Step 3: Commit** — mensagem `fix(impostos): textos da reforma com a CBS de referência e a transição da lei`.
