# Investimentos, financiamentos e contratações em 2026: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `executing-plans`, como o subagente implementador que a sessão principal despacha, para implementar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** investimentos, empréstimos, aportes e contratações planejados para 2026 passam a mudar o caixa, o lucro, os impostos e o Balanço do plano.

**Arquitetura:**
- **Regras de cálculo:** dois módulos puros novos em `src/utils/calculos/`, `contratacoes.ts` e `investimentos.ts`, cada um com o seu teste.
- **Quem usa as regras:**
  - `projetarCenario` soma o custo das contratações à folha;
  - `calcularPlanoFinanceiro2026` recebe o bloco novo `investment2026` e preenche depreciação, despesas financeiras, FCI, FCF e a dívida no Balanço.
- **Hook:** normaliza o bloco na carga, sem gravar, e expõe a API de edição.
- **Telas:** uma aba nova no Planejamento Financeiro e uma coluna nova na tabela de contratações.

**Tecnologias:** React 19, TypeScript 5.9, Vitest + jsdom + Testing Library.

**Especificação:** `docs/superpowers/specs/2026-11-10-capex-financiamentos-contratacoes-design.md`. Leia junto com este plano. A tabela "Exemplos (viram testes)" de lá dá os valores dos testes daqui.

## Restrições globais

- **Branch:** `feat/capex-financiamentos-contratacoes`, no checkout principal, sem worktree.
  - No mínimo um commit por tarefa.
  - Cada mensagem termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Não commitar `MAPA_PLAN_2026.md`.
- **npm:** usar só o npm; não tocar no `pnpm-lock.yaml`.
- **Proibido:** `firebase deploy`, `vercel`, push, merge na `main`, qualquer comando contra `plan-ea4cc` e mudar `firestore.rules`.
- **RAM (16 GB):** `tsc`, `vitest` e `build` rodam um de cada vez.
  - Rode só os testes afetados, com `npx vitest run <arquivo de teste>` ou `npx vitest related --run <arquivos>`.
  - A suíte inteira, o typecheck completo e o build ficam para o `/ship`.
- **Comandos:** um comando simples por chamada, a partir da raiz, sem `cd`, `$?` ou `${...}`. Edite com a ferramenta de edição, nunca com `sed -i`.
- **Arquivos grandes:** leia por faixa, nunca inteiros: `src/hooks/usePlanData.tsx`, `src/components/CommercialPlanning.tsx` e `src/services/geminiService.ts`.
- **Comentários:** cada decisão que restringe o código ganha um comentário de uma linha, em português, explicando o porquê.
- **Valores:**
  - porcentagens chegam de 0 a 100 (`2` = 2% a.m.);
  - `null`, `undefined`, `NaN` e string vazia valem 0, salvo as regras de campo vazio da especificação (mês → jan, vida útil → 5, parcelas → linha ignorada);
  - nenhuma função devolve `NaN` e nenhum cálculo arredonda; só a tela formata.
- **Meses:** usar `MONTHS` e `Month` de `src/types.ts`; `MONTHS.indexOf(mes ?? 'jan')` dá o índice 0–11.
- **Textos fixos da interface (exatos):**
  - aba: "Investimentos e Financiamentos";
  - seções: "Investimentos 2026", "Empréstimos novos", "Aportes de sócios", "Dívida atual (31/12/25)";
  - campo: "Juros médios a.m. da dívida atual (%)";
  - aviso: "Informe o nº de parcelas";
  - coluna: "Parcela (R$)";
  - botões: "Adicionar investimento", "Adicionar empréstimo", "Adicionar aporte"; botão de remover com `aria-label="Remover"`;
  - opções de mês: "Jan" … "Dez", com valores `'jan'` … `'dez'`;
  - contratações: coluna "Mês de entrada" e a dica "O custo das novas contratações entra na folha a partir deste mês".

## Review Focus

1. **Plano antigo ou bloco parcial** (sem `investment2026`, ou só com `emprestimos`): abre com o bloco completo, os números novos aparecem e nada é gravado. Teste na Tarefa 4.
2. **Campo digitado e depois apagado:**
   - `valor`, `parcelas`, `vidaUtilAnos` ou `jurosMensalPct` passam a valer `null`;
   - `mes` vazio passa a valer `null`;
   - o resultado nunca tem `NaN` e a linha segue as regras de campo vazio.
   
   Testes nas Tarefas 2, 3 e 4.
3. **Empréstimo que passa de dezembro:** o curto prazo de dezembro é a amortização das 12 parcelas de 2027, e curto + longo dá o saldo devedor. Teste na Tarefa 2.
4. **Todos os blocos juntos:**
   - o Balanço fecha em todos os meses;
   - o caixa de dezembro é o saldo inicial + Σ(FCO + FCI + FCF).
   
   Teste na Tarefa 3.
5. **Mudança nas contratações**, inclusive o `newHires` do Comercial ajustado sozinho a partir de `repsNeeded`:
   - recalcula os cenários percentuais;
   - não mexe no manual;
   - não entra em laço.
   
   Teste na Tarefa 4.

## Condições de parada (copiadas da especificação)

- Alguma tela ou relatório depende do FCI de 2026 valer o CAPEX de 2025 ÷ 12.
- O custo das contratações já é somado em outro lugar da projeção ou da DRE, o que contaria duas vezes.
- Não dá para incluir `investment2026` e `hiringProjection` no recálculo da carga sem que abrir o plano grave.
- A entrega exige mudar `firestore.rules`.
- Um teste existente muda de valor por motivo diferente dos efeitos visíveis listados na especificação:
  - caixa sem o CAPEX de 2025;
  - amortização da dívida de curto prazo;
  - folha com contratações.

## Passos humanos

Nenhum. Esta entrega não muda regras do Firestore nem dados de produção.

---

### Tarefa 1: Tipos e contratações na folha dos cenários

**Arquivos:**
- Modificar: `src/types.ts` (perto de `HiringProjectionItem`, linha ~263, e de `PlanData`, linha ~360)
- Criar: `src/utils/calculos/contratacoes.ts`
- Modificar: `src/utils/calculos/cenario.ts`
- Teste: `src/utils/calculos/contratacoes.test.ts` (novo), `src/utils/calculos/cenario.test.ts`

**Interfaces:**
- Produz, em `src/types.ts`, exatamente os tipos da especificação:
  - `Investimento2026 { id: string; descricao: string; valor: number | null; mes: Month | null; vidaUtilAnos: number | null }`;
  - `Emprestimo2026 { id: string; descricao: string; valor: number | null; mes: Month | null; jurosMensalPct: number | null; parcelas: number | null }`;
  - `Aporte2026 { id: string; descricao: string; valor: number | null; mes: Month | null }`;
  - `InvestmentData2026 { investimentos: Investimento2026[]; emprestimos: Emprestimo2026[]; aportes: Aporte2026[]; jurosDividaAtualPct: number | null }`;
  - em `PlanData`: `investment2026: InvestmentData2026`;
  - em `HiringProjectionItem`: `mesEntrada?: Month | null`.
- Produz: `custoContratacoesMensal(itens: HiringProjectionItem[] | undefined): MonthlyData`, com os 12 meses sempre presentes.
- Produz: `projetarCenario(base, crescimentoPct, inflacaoPct, taxes, custoContratacoes?: MonthlyData)`. O 5º parâmetro é somado a `folhaPagamento` depois da inflação; ausente vale 0.

- [ ] **Passo 1: Escreva os testes que falham.** Crie `contratacoes.test.ts`:

```ts
it('2 contratações × 60 mil/ano a partir de julho somam 10 mil de jul a dez', () => {
    const c = custoContratacoesMensal([{ id: '1', department: 'X', currentHeadcount: 0, newHires: 2, avgAnnualCost: 60000, mesEntrada: 'jul' }]);
    expect(c.jun).toBe(0);
    expect(c.jul).toBeCloseTo(10000);
    expect(c.dez).toBeCloseTo(10000);
});
it('sem mesEntrada (plano antigo) entra em janeiro', () => {
    const c = custoContratacoesMensal([{ id: '1', department: 'X', currentHeadcount: 0, newHires: 1, avgAnnualCost: 24000 }]);
    MONTHS.forEach(m => expect(c[m]).toBeCloseTo(2000));
});
it('newHires ou avgAnnualCost vazio dá 0, sem NaN', () => {
    const c = custoContratacoesMensal([
        { id: '1', department: 'X', currentHeadcount: 0, newHires: null as any, avgAnnualCost: 60000, mesEntrada: 'jan' },
        { id: '2', department: 'Y', currentHeadcount: 0, newHires: 2, avgAnnualCost: NaN, mesEntrada: null },
    ]);
    MONTHS.forEach(m => expect(c[m]).toBe(0));
});
it('lista ausente dá 12 meses zerados', () => {
    expect(Object.keys(custoContratacoesMensal(undefined))).toHaveLength(12);
});
```

Em `cenario.test.ts`, acrescente:
- `'contratações somam na folha depois da inflação'`: com a base do arquivo, compare `projetarCenario(base, 0, 10, taxes, custo)` com `projetarCenario(base, 0, 10, taxes)`. O custo vale 10000 de jul a dez. Esperado:
  - `folhaPagamento.jul` com custo = sem custo + 10000;
  - `folhaPagamento.jun` igual nos dois.
- `'sem o 5º parâmetro a projeção não muda'`: o resultado é igual ao de hoje (`toEqual`).

- [ ] **Passo 2: Rode e veja falhar.** `npx vitest run src/utils/calculos/contratacoes.test.ts src/utils/calculos/cenario.test.ts`. Esperado: FAIL, porque o módulo não existe e a folha não muda.
- [ ] **Passo 3: Implemente** os tipos, `custoContratacoesMensal` e o 5º parâmetro.
  - Custo: `num(newHires) × num(avgAnnualCost) ÷ 12`, do índice de `mesEntrada ?? 'jan'` até dezembro.
  - Comentário de porquê: o custo não é corrigido pela inflação porque o custo médio digitado já é de 2026.
- [ ] **Passo 4: Rode e veja passar.** O mesmo comando dá PASS. Rode também `npx vitest related --run src/types.ts src/utils/calculos/cenario.ts`; os testes existentes continuam verdes.
- [ ] **Passo 5: Commit.** `feat(calculos): custo das contratações na folha dos cenários`

### Tarefa 2: Regras de investimentos, empréstimos, dívida atual e aportes

**Arquivos:**
- Criar: `src/utils/calculos/investimentos.ts`
- Teste: `src/utils/calculos/investimentos.test.ts`

**Interfaces:**
- Consome: os tipos da Tarefa 1; `num` de `./impostos`.
- Produz:
  - `investimento2026Vazio(): InvestmentData2026`: listas vazias e `jurosDividaAtualPct: null`.
  - `normalizarInvestimento2026(lido: unknown): InvestmentData2026`: completa listas ausentes ou que não sejam array com `[]` e o juros ausente com `null`; mantém o resto.
  - `investimentos2026(itens: Investimento2026[] | undefined): { fci: MonthlyData; depreciacao: MonthlyData; ativoNaoCirculante: MonthlyData }`.
  - `parcelaPrice(valor: number | null, jurosMensalPct: number | null, parcelas: number | null): number`. Devolve 0 quando o valor é ≤ 0 ou as parcelas são < 1.
  - `emprestimosNovos(itens: Emprestimo2026[] | undefined): { entradas: MonthlyData; juros: MonthlyData; parcelas: MonthlyData; curtoPrazo: MonthlyData; longoPrazo: MonthlyData }`. Todos positivos; quem chama aplica o sinal.
  - `dividaAtual(financing: Partial<InvestmentData2025['financing']> | undefined, jurosMensalPct: number | null | undefined): { juros: MonthlyData; amortizacao: MonthlyData; curtoPrazo: MonthlyData; longoPrazo: MonthlyData }`. `curtoPrazo` e `longoPrazo` são os saldos no fim do mês.
  - `aportes2026(itens: Aporte2026[] | undefined): MonthlyData`.

- [ ] **Passo 1: Escreva os testes que falham**, um por linha da tabela de exemplos da especificação. Use `toBeCloseTo(x, 2)` para valores com centavos.

```ts
// Investimentos
it('120 mil em março, 5 anos', () => {
    const r = investimentos2026([inv({ valor: 120000, mes: 'mar', vidaUtilAnos: 5 })]);
    expect(r.fci.mar).toBe(-120000); expect(r.fci.fev).toBe(0);
    expect(r.depreciacao.mar).toBe(0); expect(r.depreciacao.abr).toBeCloseTo(2000);
    expect(MONTHS.reduce((s, m) => s + r.depreciacao[m]!, 0)).toBeCloseTo(18000);
    expect(r.ativoNaoCirculante.fev).toBe(0); expect(r.ativoNaoCirculante.mar).toBe(120000);
    expect(r.ativoNaoCirculante.dez).toBeCloseTo(102000);
});
it('12 mil em dezembro: sem depreciação em 2026', ...);           // fci.dez −12000; depreciação 0; ativo.dez 12000
it('12 mil em janeiro, vida 0,5 ano: 2 mil de fev a jul, depois 0', ...); // depreciacao.jul 2000, .ago 0; ativo.jul 0
it('vida útil vazia ou ≤ 0 vale 5 anos', ...);                    // vidaUtilAnos null e 0 → 120 mil dá 2000/mês
it('valor vazio ou ≤ 0 e mês vazio', ...);                        // valor null → tudo 0; mes null → compra em jan

// Empréstimos (Price)
it('parcelaPrice: 100 mil, 2%, 24× ≈ 5.287,11; juros 0 → P ÷ n; parcelas < 1 → 0', ...);
it('100 mil em jan, 2% a.m., 24×', () => {
    const r = emprestimosNovos([emp({ valor: 100000, mes: 'jan', jurosMensalPct: 2, parcelas: 24 })]);
    expect(r.entradas.jan).toBe(100000);
    expect(r.parcelas.jan).toBe(0); expect(r.parcelas.fev).toBeCloseTo(5287.11, 2); expect(r.parcelas.dez).toBeCloseTo(5287.11, 2);
    expect(r.juros.fev).toBeCloseTo(2000, 2); expect(r.juros.mar).toBeCloseTo(1934.26, 2);
    expect(r.curtoPrazo.fev + r.longoPrazo.fev).toBeCloseTo(96712.89, 2);
});
it('Balanço de dezembro: curto = amortização das 12 parcelas de 2027; curto + longo = saldo', ...);
    // calcule o saldo e as amortizações esperadas no próprio teste, iterando a tabela Price
it('12 mil, juros 0, 12× em jan: 1 mil de fev a dez e 1 mil no curto prazo em dez', ...);
it('empréstimo em dezembro: só a entrada; saldo inteiro no Balanço', ...);
    // entradas.dez 100000; parcelas 0 o ano todo; curtoPrazo.dez + longoPrazo.dez = 100000
it('sem nº de parcelas, parcelas 0,5 ou valor vazio: linha ignorada, sem NaN', ...);
it('nº de parcelas fracionado arredonda para baixo', ...);        // 12,9 → 12
it('última parcela zera o saldo', ...);                           // 12 mil, 0%, 12× em jan → curto + longo de 2027 somam 1000 em dez

// Dívida atual
it('curto 120 mil, longo 240 mil, juros 1%', () => {
    const r = dividaAtual({ financiamentoCurtoPrazo: 120000, financiamentoLongoPrazo: 240000 }, 1);
    expect(r.amortizacao.jan).toBeCloseTo(10000); expect(r.juros.jan).toBeCloseTo(3600); expect(r.juros.fev).toBeCloseTo(3500);
    expect(r.curtoPrazo.dez).toBeCloseTo(0); MONTHS.forEach(m => expect(r.longoPrazo[m]).toBe(240000));
});
it('juros vazio: só amortizações, juros 0', ...);
it('financing ausente: tudo 0', ...);

// Aportes e normalização
it('aporte de 50 mil em maio', ...);                              // maio 50000, demais 0
it('normalizar: undefined dá o vazio; bloco parcial é completado', ...);
    // normalizarInvestimento2026({ emprestimos: [x] }) → { investimentos: [], emprestimos: [x], aportes: [], jurosDividaAtualPct: null }
```

Os helpers `inv`, `emp` e `aporte` montam um item com `id` e `descricao` e aceitam sobrescritas.

- [ ] **Passo 2: Rode e veja falhar.** `npx vitest run src/utils/calculos/investimentos.test.ts`. Esperado: FAIL, módulo inexistente.
- [ ] **Passo 3: Implemente o módulo.** Pontos que o teste não decide sozinho:
  - **Empréstimos:**
    - gere o cronograma inteiro de cada empréstimo, de 1 a n, mesmo além de dezembro;
    - as parcelas começam no índice do mês + 1;
    - na última parcela, a amortização é o saldo restante, para fechar em 0 sem resto de ponto flutuante;
    - o saldo de cada mês m é o saldo depois das parcelas pagas até m (antes do contrato, 0);
    - o curto prazo em m é a soma das amortizações das parcelas que vencem em m+1 … m+12 (índices além de 11 = 2027); o longo prazo é o saldo menos o curto prazo.
  - **Investimentos:** a depreciação acumulada é limitada ao valor.
  - **Juros negativos:** contam como 0, com comentário.
- [ ] **Passo 4: Rode e veja passar.** O mesmo comando dá PASS.
- [ ] **Passo 5: Commit.** `feat(calculos): investimentos, empréstimos, dívida atual e aportes de 2026`

### Tarefa 3: DRE, DFC e Balanço com o bloco de 2026

**Arquivos:**
- Modificar: `src/utils/calculos/planoFinanceiro.ts`
- Teste: `src/utils/calculos/planoFinanceiro.test.ts`

**Interfaces:**
- Consome: o módulo da Tarefa 2.
- Produz: `calcularPlanoFinanceiro2026(proj, taxes, investment, investment2026?: InvestmentData2026): FinancialPlan2026`. Sem o 4º parâmetro, o bloco vale `investimento2026Vazio()`.

- [ ] **Passo 1: Escreva os testes que falham** em `planoFinanceiro.test.ts`, com os helpers do arquivo (`baseDeExemplo`, `simples`, `real`, `investimento`):
  - **`'FCI não usa mais o CAPEX de 2025'`:** `investimento` com `capex.totalCapex: 120000` e sem bloco 2026 → `dfc.fci[m] === 0` em todo mês.
  - **`'investimento: FCI, depreciação na DRE e ativo não circulante'`:** 120 mil em março, 5 anos.
    - `dfc.fci.mar` −120000;
    - `dre.depreciacao.abr` 2000;
    - `dre.ebit.abr = ebitda.abr − 2000`;
    - `bp.ativoNaoCirculante.dez` 102000.
  - **`'empréstimo novo: entrada e parcela no FCF, juros na DRE, dívida no Balanço'`:** 100 mil em jan, 2%, 24×.
    - `dfc.fcf.jan` 100000 e `dfc.fcf.fev` ≈ −5287,11;
    - `dre.despesasFinanceiras.fev` ≈ 2000;
    - `dfc.fco.fev` igual ao de sem empréstimo (os juros não saem duas vezes);
    - `bp.passivoCirculante.dez = bp.fornecedores.dez + bp.emprestimosCurtoPrazo.dez`;
    - `bp.passivoNaoCirculante.dez = bp.emprestimosLongoPrazo.dez > 0`.
  - **`'dívida atual: amortização e juros no FCF, juros na DRE, LP parado'`:** `investment.financing` com curto 120000, longo 240000 e `jurosDividaAtualPct: 1`.
    - `dfc.fcf.jan` ≈ −13600 e `fev` ≈ −13500;
    - `dre.despesasFinanceiras.jan` ≈ 3600;
    - `bp.emprestimosCurtoPrazo.dez` ≈ 0;
    - `bp.emprestimosLongoPrazo` = 240000 em todos os meses.
  - **`'aporte entra no FCF e não mexe na DRE'`:** 50 mil em maio.
    - `dfc.fcf.mai` 50000;
    - `dre.lucroLiquido` igual ao de sem aporte.
  - **`'Lucro Real: depreciação e juros reduzem o IRPJ/CSLL'`:**
    - projeção com receita 100000 e CMV 50000 por mês, o resto 0, impostos sobre vendas 0 → EBITDA 50000;
    - regime `real`;
    - bloco com investimento de 2000 em jan e `vidaUtilAnos: 1/12` (depreciação só em fev), mais empréstimo de 100000 em jan, 2%, `parcelas: 1` (juros 2000 só em fev);
    - esperado `dre.irpjCsll.jan` 15000 e `dre.irpjCsll.fev` ≈ 13640;
    - controle: sem o bloco, `fev` ≈ 15000.
  - **`'Presumido: IRPJ/CSLL igual com e sem investimento e empréstimo'`.**
  - **`'todos os blocos juntos: Balanço fecha e caixa bate com a DFC'`:** os quatro blocos de uma vez.
    - em todo mês, `totalAtivos` ≈ `totalPassivoPL`;
    - `bp.caixa.dez` ≈ saldo inicial + Σ(fco + fci + fcf).
  - **`'campos apagados (null) não geram NaN'`:**
    - um item de cada lista com todos os campos numéricos `null` e `mes: null`, mais `jurosDividaAtualPct: null`;
    - nenhum valor de `dre`, `dfc` ou `bp` é `NaN` (`Number.isNaN` em todos).
- [ ] **Passo 2: Rode e veja falhar.** `npx vitest run src/utils/calculos/planoFinanceiro.test.ts`. Esperado: FAIL nos testes novos, inclusive o do FCI.
- [ ] **Passo 3: Implemente** a regra 2.6 da especificação. O PL continua como fechamento; `capitalSocial` e `lucrosAcumulados` não mudam.
  - **Comentário de porquê (FCI):** o CAPEX de 2025 deixou de entrar porque já foi gasto em 2025.
  - **Comentário de porquê (FCF):** os juros saem no FCF e não no FCO, para não contar duas vezes.
- [ ] **Passo 4: Rode e veja passar.** O mesmo comando dá PASS.
  - Rode também `npx vitest related --run src/utils/calculos/planoFinanceiro.ts`.
  - Se um teste existente mudar de valor por motivo diferente do FCI sem CAPEX de 2025 ou da dívida atual, pare (condição de parada).
- [ ] **Passo 5: Commit.** `feat(calculos): DRE, DFC e Balanço com investimentos, empréstimos e aportes de 2026`

### Tarefa 4: Hook — carga, recálculo e API de edição

**Arquivos:**
- Modificar: `src/hooks/usePlanData.tsx`, por faixa:
  - estado inicial;
  - `recalcularPlanoLido` (~241-282);
  - `carregarPlano` (~367-420);
  - efeito dos cenários (~585-620) e efeito da DRE (~622-632);
  - `calculateScenarioProjection` (~1203) e "Recalcular Todos";
  - `calculateFinancialPlan2026`;
  - o CRUD de contratações (~1561-1563);
  - o objeto do contexto.
- Modificar: `src/types.ts` (tipo do contexto, perto de `updateHiringProjectionItem`, linha ~747)
- Teste: `src/hooks/usePlanData.test.tsx`

**Interfaces:**
- Consome: `custoContratacoesMensal` (Tarefa 1); `investimento2026Vazio` e `normalizarInvestimento2026` (Tarefa 2); a assinatura nova de `calcularPlanoFinanceiro2026` (Tarefa 3).
- Produz, no contexto (`usePlan()`):
  - `updateJurosDividaAtual(value: string): void`, em que `''` vira `null` e o resto passa por `parseFloat`;
  - `addItemInvestimento2026(lista: 'investimentos' | 'emprestimos' | 'aportes'): void`, que cria um item com `id` de `uuidv4()`, `descricao: ''`, `mes: 'jan'` e os campos numéricos `null`;
  - `updateItemInvestimento2026(lista: 'investimentos' | 'emprestimos' | 'aportes', id: string, campo: string, value: string): void`, em que:
    - `descricao` fica string;
    - `mes` fica string, e `''` vira `null`;
    - os demais campos passam por `parseFloat`, e `''` ou `NaN` vira `null`;
  - `removeItemInvestimento2026(lista: 'investimentos' | 'emprestimos' | 'aportes', id: string): void`.
- Muda:
  - `addHiringProjectionItem` cria o item com `mesEntrada: 'jan'`;
  - `updateHiringProjectionItem(id, 'mesEntrada', value)` guarda a string; `''` vira `null`, nunca `parseFloat`.

- [ ] **Passo 1: Escreva os testes que falham** em `usePlanData.test.tsx`. Use os helpers existentes: `documentoCom`, `montar`, `avancar`, `setDocMock`, `baseDeExemplo` e `documentoComOtimistaManual`.
  - **`'plano antigo sem investment2026 abre com o bloco vazio e não grava'`:**
    - `planData.investment2026` igual a `investimento2026Vazio()`;
    - depois de `avancar(5000)`, `setDocMock` não é chamado.
  - **`'bloco parcial é completado na carga'`:**
    - o documento só tem `investment2026: { emprestimos: [emprestimo] }`;
    - `investimentos` e `aportes` vêm `[]`;
    - `dre.despesasFinanceiras.fev` ≈ 2000 (100 mil, jan, 2%, 24×) já na carga.
  - **`'contratações salvas entram na folha na carga, sem gravar'`:**
    - `hiringProjection` com 2 × 60000 a partir de `'jul'`, cenário Conservador em percentual;
    - `scenarios2026.Conservador.projection.folhaPagamento.jul − .jun` ≈ 10000;
    - `setDocMock` não é chamado.
  - **`'adicionar empréstimo recalcula a DRE, os indicadores e grava'`:**
    - `act` com `addItemInvestimento2026('emprestimos')` e `updateItemInvestimento2026` em `valor` '100000', `jurosMensalPct` '2' e `parcelas` '24';
    - `financialPlan2026.dre.despesasFinanceiras.fev` ≈ 2000;
    - `bp.emprestimosCurtoPrazo.dez > 0`;
    - `financialIndicators.debtToEquity > 0`;
    - depois de `avancar(3500)`, `setDocMock` é chamado.
  - **`'mudar contratações recalcula cenários percentuais e não o manual'`:**
    - parta de `documentoComOtimistaManual()`;
    - adicione uma contratação e atualize `newHires` '2', `avgAnnualCost` '60000' e `mesEntrada` 'jul';
    - a folha `jul` do Conservador sobe 10000;
    - a projeção do Otimista manual fica igual (`toEqual` com a de antes).
  - **`'mesEntrada: novo item vem jan; valor vazio vira null'`.**
  - **`'campo de empréstimo apagado vira null e não gera NaN'`:**
    - `updateItemInvestimento2026('emprestimos', id, 'parcelas', '')`;
    - o item fica com `parcelas` `null`;
    - nenhum valor de `financialPlan2026` é `NaN`.
- [ ] **Passo 2: Rode e veja falhar.** `npx vitest run src/hooks/usePlanData.test.tsx`. Esperado: FAIL nos testes novos.
- [ ] **Passo 3: Implemente.**
  - Estado inicial com `investment2026: investimento2026Vazio()`.
  - Em `carregarPlano`, no mesmo `setPlanData` que já traz o plano lido: `investment2026: normalizarInvestimento2026(data.planData.investment2026)`.
  - Em `recalcularPlanoLido`, use o bloco normalizado e o custo das contratações lidas. Assim o recálculo entra no commit da carga e o `acabouDeCarregar` continua impedindo a gravação.
  - `calculateScenarioProjection` e "Recalcular Todos" passam `custoContratacoesMensal(planData.hiringProjection)`.
  - Deps dos efeitos:
    - efeito dos cenários: `+ JSON.stringify(planData.hiringProjection)`;
    - efeito da DRE: `+ JSON.stringify(planData.investment2026)`.
  - A DFC usa `investment2026` em `calculateFinancialPlan2026`.
  - A API acima, no objeto do contexto e no tipo.
- [ ] **Passo 4: Rode e veja passar.** O mesmo comando dá PASS; os testes que já existiam no arquivo continuam verdes.
- [ ] **Passo 5: Commit.** `feat(plano): investimentos, empréstimos e contratações no recálculo do plano`

### Tarefa 5: Aba "Investimentos e Financiamentos"

**Arquivos:**
- Criar: `src/components/InvestimentosFinanciamentos2026.tsx`
- Modificar: `src/components/FinancialPlanning2026.tsx`: `FinancialStatement` ganha `'investimentos'`; `TABS` (~91-94) ganha a aba; renderize o componente novo quando ela estiver ativa.
- Teste: `src/components/InvestimentosFinanciamentos2026.test.tsx`

**Interfaces:**
- Consome, de `usePlan()`:
  - `planData.investment2026`;
  - `planData.investment.financing`;
  - as quatro funções da Tarefa 4.
- Consome, das Tarefas 2 e 1:
  - `parcelaPrice` (Tarefa 2);
  - `MONTHS` e `CurrencyInput` (`value`, `onChange(value: string)`).
- Produz: `export default function InvestimentosFinanciamentos2026(): JSX.Element`.

- [ ] **Passo 1: Escreva os testes que falham.** Siga o padrão de `src/components/Taxes.test.tsx`: `vi.hoisted` com `planoFalso` e `vi.mock('../hooks/usePlanData', …)`.
  - **`'mostra as quatro seções e a dívida atual da Coleta'`:** os títulos exatos e os valores de curto e longo prazo do `financing` falso.
  - **`'adicionar chama a função de cada lista'`:** clicar em cada botão "Adicionar …" chama `addItemInvestimento2026` com `'investimentos'`, `'emprestimos'` e `'aportes'`.
  - **`'editar valor e mês chama updateItemInvestimento2026'`:**
    - `fireEvent.change` no valor de um empréstimo → `('emprestimos', id, 'valor', '100000')`;
    - no seletor de mês → `('emprestimos', id, 'mes', 'mar')`.
  - **`'remover chama removeItemInvestimento2026'`.**
  - **`'empréstimo mostra a parcela calculada'`:** 100 mil, 2%, 24× → o texto contém "5.287,11".
  - **`'empréstimo sem nº de parcelas mostra o aviso'`:** "Informe o nº de parcelas".
  - **`'juros da dívida atual chama updateJurosDividaAtual'`.**
- [ ] **Passo 2: Rode e veja falhar.** `npx vitest run src/components/InvestimentosFinanciamentos2026.test.tsx`. Esperado: FAIL, componente inexistente.
- [ ] **Passo 3: Implemente.**
  - **Tabelas:** dentro de `overflow-x-auto`, com o visual das tabelas vizinhas.
  - **Campos:**
    - `CurrencyInput` para os valores;
    - `<input type="number">` para juros, parcelas e vida útil (placeholder "5");
    - `<select>` com Jan … Dez;
    - cada campo com `aria-label`, para o teste e para leitor de tela.
  - **Parcela:** formatada em pt-BR.
  - **Aba:** acrescente-a em `FinancialPlanning2026.tsx` sem mudar as outras.
- [ ] **Passo 4: Rode e veja passar.** O mesmo comando dá PASS. Rode também `npx vitest related --run src/components/FinancialPlanning2026.tsx`.
- [ ] **Passo 5: Commit.** `feat(financeiro): aba Investimentos e Financiamentos`

### Tarefa 6: Coluna "Mês de entrada" nas contratações

**Arquivos:**
- Modificar: `src/components/CommercialPlanning.tsx`, por faixa:
  - o cabeçalho da tabela de contratações (~1097-1107);
  - as linhas, logo abaixo;
  - `renderHiringTab` (~1322), onde fica a dica.
- Teste: `src/components/CommercialPlanning.test.tsx` (novo)

**Interfaces:**
- Consome:
  - `updateHiringProjectionItem(id, 'mesEntrada', value)` e `addHiringProjectionItem` (Tarefa 4);
  - `HiringProjectionItem.mesEntrada` (Tarefa 1).

- [ ] **Passo 1: Escreva os testes que falham.**
  - Monte um `planoFalso` com só os campos que o componente lê para renderizar. Descubra quais lendo o início do componente (~744-830).
  - Se o recharts reclamar no jsdom, faça mock de `ResizeObserver`.
  - Clique na aba "4. Contratacoes".
  - Testes:
    - `'mostra a coluna Mês de entrada e a dica'`, com os textos exatos;
    - `'item sem mesEntrada aparece como Jan'`: o valor do seletor é `'jan'`;
    - `'trocar o mês chama updateHiringProjectionItem'`: `('h1', 'mesEntrada', 'jul')`.
- [ ] **Passo 2: Rode e veja falhar.** `npx vitest run src/components/CommercialPlanning.test.tsx`. Esperado: FAIL, coluna inexistente.
- [ ] **Passo 3: Implemente.**
  - Seletor com `value={item.mesEntrada ?? 'jan'}`.
  - Coluna depois de "Novas Contratações".
  - Dica abaixo da tabela.
  - Não mude o ajuste automático do `newHires` do Comercial.
- [ ] **Passo 4: Rode e veja passar.** O mesmo comando dá PASS.
- [ ] **Passo 5: Commit.** `feat(comercial): mês de entrada das contratações`
