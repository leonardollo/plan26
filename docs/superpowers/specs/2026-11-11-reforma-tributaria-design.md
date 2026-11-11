# Reforma tributária nos planos de 2027 em diante (design)

- **Data:** 2026-11-11
- **Nível:** Estrutural + Sensível. Muda o cálculo dos impostos sobre a receita no ano do plano e toca
  `src/hooks/usePlanData.tsx` e `src/services/geminiService.ts`.
- **Branch:** `feat/reforma-tributaria`, criada a partir da `main` local `570a43d`.
- **Origem:** parte B da entrega 3 da revisão para o ciclo 2027. A parte A (um plano por ano) já está
  na `main` local.

## Objetivo

Em 2027 o PIS e a COFINS deixam de existir e entra a CBS (EC 132/2023, LC 214/2025). Hoje o app
projeta o ano do plano com ISS + ICMS + PIS + COFINS, então um plano 2027 sai com o imposto sobre a
receita errado. Os textos da aba Impostos também estão desatualizados: a CBS aparece como "~8,8%" e
a tabela da transição tem 2031 e 2032 trocados.

Depois desta entrega:

- nos planos de 2027 em diante, no Lucro Presumido e no Lucro Real, a CBS substitui o PIS e a COFINS
  no imposto sobre a receita do ano do plano;
- o app sugere a CBS a partir da base e o cliente pode digitar a sua;
- os textos da reforma seguem a referência atual (TCU) e a lei.

Decisões do usuário (2026-11-11):

- **CBS:** estimar e deixar editar ("Estimar e deixar editar (Recomendado)");
- **desenho:** aprovado como apresentado no chat ("pode seguir").

## Termos

- **Ano do plano / ano base:** `anoPlano` e `anoBase = anoPlano − 1`, da entrega 3A.
- **Base:** a Coleta do ano base (`financialSheet`, campos `values2025`).
- **Receita bruta da base (R):** soma dos 12 meses de `receitaBruta`.
- **Custos variáveis da base (V):** soma dos 12 meses de `cmv`, `comissoes`, `fretes` e de cada item
  de `customCustosVariaveis`.
- **CBS de referência:** 11,3%. É o valor que o TCU aprovou em 28/10/2026; o Senado fixa o definitivo
  até dezembro de 2026. Em 2027-28 a CBS cobrada é 0,1 ponto menor (11,2%) e soma-se 0,1% de IBS,
  então o total sobre o consumo continua 11,3%.

## Parte 1 — A regra

Constantes novas em `src/utils/calculos/impostos.ts`, dentro de um bloco `ano-real` (são anos e
valores da lei, não do plano), cada uma com um comentário do porquê:

- `ANO_DA_CBS = 2027`: primeiro ano sem PIS e COFINS;
- `CBS_DE_REFERENCIA = 11.3`: 11,2% de CBS + 0,1% de IBS em 2027-28; atualizar quando o Senado
  fixar a alíquota.

Funções novas, puras, no mesmo arquivo:

- `cbsSugerida(base)`: `CBS_DE_REFERENCIA × min(1, max(0, 1 − V ÷ R))`. Sem receita na base
  (R ≤ 0), devolve `CBS_DE_REFERENCIA`. O desconto vem do crédito: a CBS é não cumulativa e o
  cliente abate o imposto pago nas compras, aqui aproximadas pelos custos variáveis.
- `aliquotaDoAnoDoPlano(taxes, anoPlano, base)`:
  1. `anoPlano < ANO_DA_CBS` → `aliquotaDeducao(taxes)`, sem mudança;
  2. `aliquotaEfetiva > 0` → `aliquotaEfetiva`;
  3. Simples Nacional → `simplesNacional`;
  4. senão → `iss + icms + CBS`, em que CBS = `cbsEfetiva` se for maior que zero, senão
     `cbsSugerida(base)`.

`aliquotaDeducao` continua igual: ela vale para o ano base, que ainda tem PIS e COFINS (o ano base
de um plano 2027 é 2026).

Campo novo em `TaxesData`: `cbsEfetiva: number | null`, valor inicial `null`. Vazio ou zero usa a
sugestão, como `aliquotaEfetiva` (o `updateTaxes` grava 0 para campo apagado). Planos já salvos não
têm o campo e usam a sugestão.

**Começar o ano seguinte:** `cbsEfetiva` **não** entra em `CAMPOS_DE_IMPOSTO_COPIADOS`. A sugestão
é recalculada da nova base, e uma CBS digitada para um ano não vale para o outro.

## Parte 2 — Onde a regra entra

| Lugar | Hoje | Depois |
|---|---|---|
| `projetarCenario` (`cenario.ts:29`) | `aliquotaDeducao(taxes)` | `aliquotaDoAnoDoPlano(taxes, anoPlano, base)`; `anoPlano` vira parâmetro obrigatório |
| `recalcularPlanoLido` (`usePlanData.tsx:263`, chamada em `:301`) | sem ano | recebe o `anoPlano` do plano carregado e o repassa |
| Projeção do cenário (`usePlanData.tsx:1346`) | sem ano | repassa `anoPlano` |
| `calculateSensitivityAnalysis` (`usePlanData.tsx:946`) | `aliquotaDeducao(taxes)` | `aliquotaDoAnoDoPlano(taxes, anoPlano, financialSheet)` |
| `applyTaxesTo2025` (`usePlanData.tsx:1400`) | `aliquotaDeducao` | sem mudança (ano base) |
| `calculatedRate` da aba Impostos (`Taxes.tsx:58`) | `aliquotaDeducao` | sem mudança (ano base) |

DRE, DFC, Balanço, Resumo, relatórios e comparativos leem `impostosSobreFaturamento` da projeção e
seguem sozinhos.

## Parte 3 — Aba Impostos

Só em planos com `anoPlano ≥ ANO_DA_CBS`:

- **Campo "CBS efetiva (%)"**, visível no Lucro Presumido e no Lucro Real, ao lado dos impostos
  sobre a receita. Vazio mostra a sugestão como placeholder ("Sugestão: 6,78%", duas casas).
  Dica: "Estimativa de 11,3% (referência do TCU, a confirmar pelo Senado) sobre a parte da receita
  que não é custo variável, porque a CBS desconta o crédito das compras. Deixe em branco para usar a
  sugestão."
- **Linha "Imposto sobre a receita em {anoPlano}"** com o resultado de `aliquotaDoAnoDoPlano`, para
  o cliente ver o que entra nos cenários.
- **PIS e COFINS** continuam editáveis (valem para o ano base); a dica passa a ser "Vale para
  {anoBase}; em {anoPlano} a CBS substitui".
- **Aviso com `aliquotaEfetiva` preenchida** (fora do Simples): "Em {anoPlano} o PIS e a COFINS
  deixam de existir e entra a CBS. Se a alíquota efetiva inclui PIS e COFINS, revise-a ou deixe-a em
  branco para o app calcular." A alíquota efetiva é copiada do ano anterior, então esse caso existe
  em todo plano 2027 de quem a preencheu em 2026.

Em planos de 2026 a aba fica como está.

## Parte 4 — Textos da reforma

Todos dentro de blocos `ano-real`:

- `Taxes.tsx:18` (linha do tempo, 2029-32): 2031 → "70% ICMS/ISS + 30% IBS"; 2032 → "60% ICMS/ISS +
  40% IBS".
- `Taxes.tsx:17` (2027): "CBS entra com alíquota cheia (~8,8%)" → "CBS de 11,2% + 0,1% de IBS em
  2027-28 (referência de 11,3% do TCU, a confirmar pelo Senado)".
- `Taxes.tsx:351` (cartão "Novo Tributo Federal"): "CBS ~8,8%" → "CBS ~11,2%", e o subtítulo diz
  "+ 0,1% de IBS em 2027-28; referência do TCU, a confirmar pelo Senado".
- `geminiService.ts:230` (prompt de `getTaxRecommendation`): a linha de 2027 passa a "2027: Extincao
  de PIS/COFINS; CBS de 11,2% + 0,1% de IBS em 2027-28 (referencia de 11,3% do TCU, a confirmar pelo
  Senado)". O prompt já não usa acentos; mantém-se assim.

## Casos que precisam de teste

`aliquotaDoAnoDoPlano`, com base R = R$ 1.000.000 e V = R$ 400.000 (CBS sugerida 6,78%), salvo
indicação:

| # | Caso | Esperado |
|---|---|---|
| 1 | 2026, Presumido, ISS 5, PIS 0,65, COFINS 3 | 8,65 (igual a hoje) |
| 2 | 2027, mesmo cadastro, `cbsEfetiva` ausente | 11,78 (5 + 6,78) |
| 3 | 2027, `cbsEfetiva` 8 | 13 |
| 4 | 2027, `cbsEfetiva` 0 | 11,78 (zero usa a sugestão) |
| 5 | 2027, `aliquotaEfetiva` 15 | 15 |
| 6 | 2027, Simples 6 | 6 |
| 7 | 2027, Real, ICMS 18, ISS 0 | 24,78 |
| 8 | 2027, V = R$ 1.200.000 (maior que R) | 5 (CBS 0) |
| 9 | 2027, R = 0 | 16,3 (CBS 11,3) |
| 10 | 2027, V negativo (estorno digitado) | 16,3 (fração limitada a 1) |
| 11 | 2027, CMV 300 mil + item variável próprio de 100 mil | 11,78 (itens próprios contam) |
| 12 | 2029, mesmo cadastro do caso 2 | 11,78 (a transição de 2029-32 fica fora) |

Outros:

- **Projeção:** plano 2027, Presumido ISS 5, base com R = R$ 1.000.000 (R$ 100.000 em janeiro) e
  V = R$ 400.000, crescimento e inflação 0 → `impostosSobreFaturamento.jan` = R$ 11.780.
- **Projeção 2026:** o mesmo cenário em 2026 continua dando R$ 8.650.
- **Carga:** um plano 2027 salvo é recalculado na carga com a CBS (o `anoPlano` chega a
  `recalcularPlanoLido`), e abrir o plano não grava nada além do que já gravava.
- **Ano seguinte:** `montarPlanoDoAnoSeguinte` não copia `cbsEfetiva`.
- **Aba Impostos:** campo, linha do ano do plano e aviso aparecem em 2027 e não em 2026; o campo
  some no Simples.
- **Guarda:** `semAnoFixo.test.ts` continua verde sem ampliar a lista de exceções.

## Fora do escopo

- A transição de 2029-32 no cálculo (ICMS/ISS caindo e IBS subindo): um plano 2029 usa a regra de
  2027.
- O Simulador da aba Impostos (`ivaEstimado = 27,5`).
- O regime híbrido do Simples Nacional.
- Precificação com a CBS "por fora" (`PricingCalculator.tsx`).
- O Imposto Seletivo e o split payment no fluxo de caixa.

## Condições de parada

- Se o teste de guarda exigir ampliar a lista de exceções (não os marcadores `ano-real`), pare e
  reporte.
- Se algum consumidor do imposto do ano do plano não estiver na tabela da Parte 2 (calcula a
  alíquota por conta própria), pare e reporte antes de mudá-lo.
- Se abrir um plano 2026 passar a gravar ou mudar qualquer número, pare e reporte.
- Se o Senado publicar a alíquota antes do merge, pergunte ao usuário antes de mudar a constante.

## Passos humanos

Nenhum. A entrega não muda `firestore.rules`, não grava dados de produção e não precisa de segredo.
A publicação segue os bloqueios das entregas anteriores (deploy pelo Leonardo).
