# Investimentos, financiamentos e contratações em 2026 (design)

- **Data:** 2026-11-10
- **Nível:** Estrutural + Sensível (módulo de cálculo novo, bloco novo no `planData`, regras de dinheiro e
  impostos; toca `src/hooks/usePlanData.tsx`)
- **Branch:** `feat/capex-financiamentos-contratacoes`, criada a partir da `main` local `d471b6b`
- **Origem:** entrega adiada da Entrega 2 ("CAPEX/financiamentos/contratações numa entrega própria"), por
  decisão do usuário

## Objetivo

Hoje o plano de 2026 ignora o que o cliente pretende investir, tomar emprestado, receber de sócios e contratar.
Na prática:

- a DRE mostra depreciação e despesas financeiras sempre em zero;
- o Fluxo de Financiamentos (FCF) é sempre zero;
- o Fluxo de Investimentos (FCI) repete 1/12 do CAPEX de **2025** todo mês;
- o Balanço não tem ativo não circulante nem empréstimos;
- a tabela de contratações não muda a folha dos cenários.

Depois desta entrega, esses planos de 2026 mudam caixa, lucro, IRPJ/CSLL (no Lucro Real), Balanço e indicadores.

Decisões do usuário (2026-11-10):

- **origem dos dados de 2026:** um bloco novo. A Coleta de Dados (2025) continua como ponto de partida;
- **dívida atual:** saldo + pagamento simples;
- **contratações:** uma coluna "mês de entrada" na tabela que já existe.

## Parte 1 — Dados novos

### Bloco `investment2026` no `planData`

```ts
interface Investimento2026 { id: string; descricao: string; valor: number | null; mes: Month | null; vidaUtilAnos: number | null }
interface Emprestimo2026  { id: string; descricao: string; valor: number | null; mes: Month | null; jurosMensalPct: number | null; parcelas: number | null }
interface Aporte2026      { id: string; descricao: string; valor: number | null; mes: Month | null }
interface InvestmentData2026 {
  investimentos: Investimento2026[];
  emprestimos: Emprestimo2026[];
  aportes: Aporte2026[];
  jurosDividaAtualPct: number | null; // juros médios a.m. da dívida que já existe em 31/12/25
}
```

- Valor inicial: listas vazias e `jurosDividaAtualPct: null`.
- Plano gravado sem o bloco: abre com o valor inicial. Nada é gravado só por abrir; vale a regra das
  entregas anteriores, em que o recálculo da carga acontece dentro de `carregarPlano`.
- A importação do DPE não mexe neste bloco.
- `firestore.rules` não valida campos do `planData`, então a entrega não muda as regras.

### Contratações: `mesEntrada`

- `HiringProjectionItem` ganha `mesEntrada?: Month | null`.
- Item novo nasce com `mesEntrada: 'jan'`.
- Item antigo sem o campo vale janeiro.

### Ponto de partida (sem mudança na Coleta de Dados)

- `investment.financing.saldoCaixaFinal2025` → caixa inicial (como hoje).
- `investment.financing.financiamentoCurtoPrazo` e `financiamentoLongoPrazo` → dívida em 31/12/25. Vale tanto
  para o que foi digitado quanto para o que foi importado do DPE.
- `investment.capex` (2025) **deixa de entrar no FCI de 2026**. Continua visível na Coleta como dado de 2025.

## Parte 2 — Regras de cálculo

Módulos novos, sem React, em `src/utils/calculos/`:

- `contratacoes.ts`: custo mensal das contratações;
- `investimentos.ts`: depreciação, tabela Price, dívida atual e aportes.

Os dois devolvem `MonthlyData` (12 meses) e nunca `NaN`.

**Campos vazios** (valem para todas as regras):

- valor vazio ou ≤ 0 → a linha é ignorada;
- mês vazio → janeiro;
- juros vazio → 0;
- vida útil vazia ou ≤ 0 → 5 anos;
- nº de parcelas vazio ou < 1 → a linha é ignorada, e a tela avisa "Informe o nº de parcelas";
- nº de parcelas fracionado → arredonda para baixo.

Nenhum valor é arredondado no cálculo. Só a tela formata.

### 2.1 Contratações → folha dos cenários

- **Custo mensal** = `newHires × avgAnnualCost ÷ 12`, de `mesEntrada` (inclusive) até dezembro. Ele soma em
  todos os itens da tabela.
- **Onde entra:** é somado a `folhaPagamento` da projeção de **todo cenário em modo percentual**.
  - O valor não é corrigido pela inflação: o custo médio digitado já é de 2026.
  - Cenário manual não é recalculado (como hoje).
- `projetarCenario` ganha o parâmetro opcional `custoContratacoes?: MonthlyData`. Quem chama (o recálculo da
  carga, `calculateScenarioProjection` e o "Recalcular Todos") passa
  `custoContratacoesMensal(planData.hiringProjection)`.
- O efeito que recalcula os cenários passa a observar `hiringProjection`.

### 2.2 Investimentos (CAPEX 2026)

- **FCI:** `−valor` no mês da compra.
- **Depreciação linear:** `valor ÷ (vidaUtilAnos × 12)` por mês, a partir do **mês seguinte** à compra.
  - A depreciação acumulada nunca passa do valor (vida útil curta).
  - Vai para a DRE em `depreciacao`.
- **Balanço:** `ativoNaoCirculante[m]` = soma de `valor − depreciação acumulada até m` dos investimentos
  comprados até m.

### 2.3 Empréstimos novos (tabela Price)

- **Parcela** = `P × i ÷ (1 − (1 + i)^−n)`. Com `i = 0`, a parcela é `P ÷ n`.
- **Entrada:** o valor entra no FCF no mês do contrato.
- **Parcelas:** a 1ª é no mês seguinte. O cronograma é calculado inteiro, mesmo quando passa de dezembro,
  porque o Balanço precisa das parcelas de 2027.
- **DRE:** os juros de cada parcela (`saldo devedor no início do mês × i`) vão para `despesasFinanceiras`.
- **FCF:** sai a parcela inteira (juros + amortização).
- **Balanço** (saldo devedor no fim do mês m):
  - a amortização das 12 parcelas seguintes a m vai para `emprestimosCurtoPrazo`;
  - o restante vai para `emprestimosLongoPrazo`.

### 2.4 Dívida atual (31/12/25)

- **Curto prazo:** paga em 12 amortizações iguais (`financiamentoCurtoPrazo ÷ 12`), de janeiro a dezembro.
  Elas saem pelo FCF.
- **Longo prazo:** fica parado em `emprestimosLongoPrazo` o ano inteiro. Não há reclassificação para curto
  prazo; fica registrado como simplificação aceita.
- **Juros:** `jurosDividaAtualPct × (saldo de curto prazo no início do mês + longo prazo)`.
  - Vão para `despesasFinanceiras`.
  - São pagos no mês, pelo FCF.

### 2.5 Aportes de sócios

`+valor` no FCF no mês informado. Não mexem na DRE.

### 2.6 Como fica `calcularPlanoFinanceiro2026`

A assinatura passa a ser `calcularPlanoFinanceiro2026(proj, taxes, investment, investment2026?)`. Sem o 4º
parâmetro, o bloco vale vazio.

**DRE:**

- `depreciacao` = 2.2;
- `despesasFinanceiras` = juros de 2.3 + juros de 2.4;
- `lucroAntesImpostos = ebit − despesasFinanceiras`;
- o IRPJ/CSLL continua saindo de `irpjCsllMensal`:
  - no **Lucro Real**, depreciação e juros reduzem o imposto, porque ele já é calculado sobre o LAIR;
  - **Presumido** e **Simples** não mudam.

**DFC:**

- `fco = ebitda − irpjCsll` (como hoje). Os juros saem no FCF, para não contar duas vezes;
- `fci` = 2.2;
- `fcf` = entradas de empréstimos + aportes − parcelas Price − amortização da dívida atual − juros da dívida atual.

**Balanço:**

- `ativoNaoCirculante` = 2.2;
- `emprestimosCurtoPrazo` = saldo de curto prazo da dívida atual + parte de curto prazo de 2.3;
- `emprestimosLongoPrazo` = longo prazo atual + parte de longo prazo de 2.3;
- `passivoCirculante = fornecedores + emprestimosCurtoPrazo`;
- `passivoNaoCirculante = emprestimosLongoPrazo`;
- o Patrimônio Líquido continua como fechamento, como hoje;
- `capitalSocial` e `lucrosAcumulados` continuam fora.

**Quem chama:**

- o recálculo da carga (`recalcularPlanoLido`) e `calculateFinancialPlan2026` passam `investment2026`;
- o efeito da DRE passa a observar `JSON.stringify(planData.investment2026)`.

**Indicadores (`financialIndicators`):** não mudam de código. Passam a enxergar a dívida pelo Balanço:

- liquidez corrente, seca e imediata (passivo circulante maior);
- Dívida/EBITDA e Dívida/PL;
- ROIC (capital investido).

### Exemplos (viram testes)

| Situação | Esperado |
|---|---|
| 2 contratações × R$ 60 mil/ano, entrada em julho | folha +R$ 10 mil/mês de jul a dez; jan–jun sem mudança |
| Contratação sem `mesEntrada` (plano antigo), 1 × R$ 24 mil | +R$ 2 mil/mês de jan a dez |
| `newHires` ou `avgAnnualCost` vazio | custo 0 |
| Cenário manual com contratações | projeção não muda |
| Investimento R$ 120 mil em março, vida útil 5 anos | FCI −120 mil em março; depreciação R$ 2 mil/mês de abr a dez (R$ 18 mil no ano); ativo não circulante R$ 120 mil em março e R$ 102 mil em dezembro |
| Investimento R$ 12 mil em dezembro | FCI −12 mil em dez; depreciação 0 em 2026; ativo R$ 12 mil em dez |
| Investimento R$ 12 mil em janeiro, vida útil 0,5 ano | R$ 2 mil/mês de fev a jul; 0 de ago a dez; ativo 0 a partir de julho |
| Investimento com vida útil vazia | vida útil de 5 anos |
| Empréstimo R$ 100 mil em jan, 2% a.m., 24× | FCF +100 mil em jan; parcela ≈ R$ 5.287,11 de fev a dez (FCF −5.287,11); juros fev R$ 2.000,00, mar ≈ R$ 1.934,26; saldo fim de fev ≈ R$ 96.712,89 |
| O mesmo empréstimo, Balanço de dezembro | curto + longo = saldo devedor em dez; curto = amortização das parcelas de jan a dez de 2027 |
| Empréstimo R$ 12 mil, juros 0, 12× em janeiro | parcela R$ 1 mil de fev a dez (11 em 2026); despesa financeira 0; em dez sobra R$ 1 mil no curto prazo |
| Empréstimo em dezembro | só a entrada em 2026; nenhuma parcela; saldo inteiro no Balanço |
| Empréstimo sem nº de parcelas | ignorado; aviso na tela |
| Dívida atual: curto R$ 120 mil, longo R$ 240 mil, juros 1% a.m. | FCF jan = −10 mil − 3.600 (1% de 360 mil); fev = −10 mil − 3.500; CP em dez 0; LP R$ 240 mil o ano todo |
| Dívida atual com juros vazio | só as amortizações do curto prazo; despesa financeira 0 |
| Aporte R$ 50 mil em maio | FCF +50 mil em maio; DRE sem mudança |
| Lucro Real, EBITDA 50 mil/mês; só em fevereiro, R$ 2 mil de depreciação e R$ 2 mil de juros | jan R$ 15.000; fev R$ 13.640 (sem eles, R$ 15.000) |
| Presumido com investimento e empréstimo | IRPJ/CSLL igual ao de antes |
| CAPEX de 2025 R$ 120 mil e nenhum investimento em 2026 | FCI 0 todo mês (antes: −10 mil/mês) |
| Plano sem `investment2026` | abre sem gravar; DRE, DFC e Balanço iguais aos de hoje, exceto pelos efeitos visíveis abaixo |
| Indicadores com empréstimo | Dívida/PL > 0; liquidez corrente menor que sem o empréstimo |

### Efeito visível em planos que já existem

Ao abrir, os números mudam sem o cliente digitar nada:

- planos com **CAPEX 2025** preenchido: caixa maior (o FCI deixa de descontar 1/12 do CAPEX de 2025 por mês);
- planos com **dívida de curto prazo** na Coleta: caixa menor (as amortizações passam a sair);
- planos com **contratações** preenchidas: folha maior nos cenários percentuais.

Abrir o plano continua sem gravar. A gravação vem na próxima edição.

## Parte 3 — Telas

- **Planejamento Financeiro 2026** (`FinancialPlanning2026.tsx`): uma aba nova, "Investimentos e
  Financiamentos", ao lado de DRE, DFC e Balanço. Ela tem:
  - **Investimentos 2026:** descrição, valor (R$), mês, vida útil (anos; placeholder "5"); adicionar e
    remover;
  - **Empréstimos novos:** descrição, valor (R$), mês de entrada do dinheiro, juros a.m. (%), nº de parcelas,
    e a parcela calculada (só leitura); adicionar e remover; aviso na linha sem nº de parcelas;
  - **Aportes de sócios:** descrição, valor (R$), mês; adicionar e remover;
  - **Dívida atual:** mostra o curto e o longo prazo de 31/12/25 (só leitura, vindos da Coleta) e o campo
    "Juros médios a.m. da dívida atual (%)".
- **Comercial e RH** (`CommercialPlanning.tsx`): a tabela de contratações ganha a coluna "Mês de entrada" (um
  seletor de jan a dez) e o texto "O custo das novas contratações entra na folha a partir deste mês".
- Os componentes seguem os já usados nessas telas (`CurrencyInput`, tabelas com rolagem horizontal no
  celular). As tabelas cabem em 390 px com rolagem horizontal e sem quebrar a página.

## Fora do escopo

- depreciação dos ativos que já existiam em 31/12/25;
- carência e sistema SAC;
- reclassificar o longo prazo atual para curto prazo;
- capital social e lucros acumulados no Balanço;
- o campo "Quanto (R$)" do Plano de Ação;
- plano por ano (2027 não sobrescrever 2026), CBS 2027 e tabela da reforma: Entrega 3.

## Condições de parada (o implementador para e reporta)

- Alguma tela ou relatório depende do FCI de 2026 valer o CAPEX de 2025 ÷ 12.
- O custo das contratações já é somado em outro lugar da projeção ou da DRE, o que contaria duas vezes.
- Não dá para incluir `investment2026` e `hiringProjection` no recálculo da carga sem que abrir o plano grave.
- A entrega exige mudar `firestore.rules`.
- Um teste existente muda de valor por motivo diferente dos efeitos visíveis listados acima.

## Passos só humanos

Nenhum passo novo. A publicação depende dos mesmos acessos da Entrega 1 (write no `origin`, deploy na Vercel).

## Testes

- `contratacoes.test.ts` e `investimentos.test.ts`: os exemplos da tabela.
- `planoFinanceiro.test.ts`:
  - DRE, DFC e Balanço com cada bloco;
  - o Balanço fecha (total de ativos = passivo + PL) em todos os meses;
  - FCI sem o CAPEX de 2025.
- `cenario.test.ts`: contratações somadas à folha.
- `usePlanData.test.tsx`:
  - plano antigo sem o bloco abre sem gravar;
  - mudar `investment2026` recalcula a DRE;
  - mudar `hiringProjection` recalcula os cenários percentuais e não mexe no manual;
  - indicadores enxergam a dívida.
- Telas: teste de componente da aba nova (adicionar, editar e remover cada lista) e da coluna "Mês de entrada".
