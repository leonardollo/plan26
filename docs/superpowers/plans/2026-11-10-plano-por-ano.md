# Um plano por ano — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans, as the implementer subagent the main session dispatches, to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cada cliente passa a ter um plano por ano. Começar 2027 não toca no 2026, um seletor troca
de ano e todo ano visível segue o plano aberto.

**Architecture:** `src/services/planos.ts` concentra o mapa ano → caminho: 2026 fica no documento
legado `users/{uid}` e os outros anos em `users/{uid}/planos/{ano}`. O mesmo módulo lista os anos,
escolhe o primeiro ano e monta a cópia do ano seguinte. `usePlanData` passa a carregar e gravar um
ano (`anoCarregado`) e expõe `anoPlano`/`anoBase`, que substituem os anos fixos nas telas, nos
relatórios, no DPE e nos prompts do Gemini. Um teste de guarda impede que um ano fixo volte.

**Tech Stack:** React 19, TypeScript 5.9, Firebase Firestore (web SDK), Vitest + Testing Library
(jsdom), emulador do Firestore para as regras.

**Spec:** `docs/superpowers/specs/2026-11-10-plano-por-ano-design.md` (leia antes; este plano não
repete as tabelas dela).

## Global Constraints

- 2026 usa sempre `users/{uid}` e `plan_data_{uid}`; outro ano usa `users/{uid}/planos/{ano}` e
  `plan_data_{uid}_{ano}`. `planos/2026` nunca é criado.
- `ANO_DO_PLANO_LEGADO = 2026`, só em `src/services/planos.ts`. Nenhum outro arquivo monta caminho
  ou chave de plano.
- `firestore.rules` e `firebase.json` não mudam. Nada é publicado nem gravado em produção.
- Os nomes internos (`goals2026`, `values2025`, `FinancialPlanning2026`…) não mudam. Eles passam a
  significar "ano do plano" e "ano base". Um comentário em `src/types.ts`, acima de `PlanData`, diz
  isso.
- Texto visível: "2026" → `anoPlano`, "2025" → `anoBase`, "2024" → `anoPlano − 2`, "Dez/26" →
  `Dez/{dois dígitos de anoPlano}`, "31/12/25" → `31/12/{anoBase}`.
- Nome do produto: "PLAN {anoPlano}" dentro do app, nos relatórios e nas boas-vindas do onboarding;
  "PLAN" em `Login`, `AguardandoLiberacao`, `SubscriptionExpiredPage` e no `<title>` do
  `index.html`.
- `usePlanData.tsx`, `CommercialPlanning.tsx` e `geminiService.ts` são lidos por faixa de linhas,
  nunca inteiros.
- Testes: depois de cada tarefa, só os afetados (`npx vitest related --run <arquivos>`). O
  typecheck completo (`npm run typecheck`) roda no fim das tarefas 3, 6 e 9. `npm run test:rules`
  roda só na tarefa 2. Um processo pesado por vez (`pgrep -fl "tsc|vitest"` antes).
- Commits: mensagem no padrão do repo (`feat(...)`, `test(...)`), terminando com
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Condições de parada** (pare e relate ao orquestrador, sem contornar):
  - um fluxo que grave em `users/{uid}` sem ser o plano;
  - a cópia do ano novo precisar de um campo fora da tabela da Parte 3 da spec;
  - um ano real (de lei ou de dado), fora de `Taxes.tsx` e de `getTaxRecommendation`, que o teste
    de guarda reprove;
  - um falso positivo do teste de guarda que exija mudar as expressões regulares.

## Review Focus

1. **Trocar para um ano sem documento** (ou carregado depois de outro): a tela não pode mostrar,
   nem gravar, nada do ano anterior. Hoje a carga mistura o lido em `prev`. Testes nas tarefas 3
   e 4.
2. **Troca rápida de ano** (2026 → 2027 → 2026 antes da primeira carga terminar): só a última
   carga entra no estado. Teste na tarefa 4.
3. **Gravação em andamento na hora da troca** (`saving`): a troca espera essa gravação e grava de
   novo o pendente antes de carregar. A gravação antiga vai para o caminho antigo. Teste na
   tarefa 4.
4. **Clique duplo em "Começar plano 2027"**: o botão fica desabilitado enquanto cria, e a
   transação não sobrescreve. Testes nas tarefas 4 e 5.
5. **Liberação do acesso depois de uma carga negada** (`aplicarStatusDeAcesso` →
   `carregarPlano`): recarrega o ano que estava sendo aberto; se a lista de anos nem chegou a ser
   lida, refaz a abertura inteira. Teste na tarefa 3.

---

### Task 1: Módulo `planos.ts`

**Files:**
- Create: `src/services/planos.ts`
- Test: `src/services/planos.test.ts`

**Interfaces:**
- Produces (todas exportadas de `src/services/planos.ts`):
  - `ANO_DO_PLANO_LEGADO = 2026`
  - `type AnosDoPlano = { anoPlano: number; anoBase: number }`
  - `anosDoPlano(anoPlano: number): AnosDoPlano` (`anoBase = anoPlano − 1`)
  - `type DadosDoPlano = { planData: PlanData; goals2026: Goals2026; scenarios2026: Scenarios2026; tracking2026: Tracking2026; taxes: TaxesData; pricingItems: PricingItem[] }`
  - `caminhoDoPlano(uid: string, ano: number): string[]`: `['users', uid]` para 2026,
    `['users', uid, 'planos', String(ano)]` para os outros anos (uso: `doc(db, ...caminhoDoPlano(uid, ano))`)
  - `chaveLocalDoPlano(uid: string, ano: number): string`: `plan_data_{uid}` ou `plan_data_{uid}_{ano}`
  - `anoDoPrimeiroPlano(hoje: Date): number`
  - `proximoAnoDoPlano(anosSalvos: number[], hoje: Date): number | null`
  - `listarPlanos(db: Firestore, uid: string): Promise<number[]>`
  - `listarPlanosLocais(storage: Storage, uid: string): number[]`
  - `montarPlanoDoAnoSeguinte(origem: Partial<DadosDoPlano>, iniciais: DadosDoPlano): DadosDoPlano`
  - `criarPlanoSeNaoExistir(db: Firestore, uid: string, ano: number, anoOrigem: number, iniciais: DadosDoPlano): Promise<void>`

- [ ] **Step 1: Escrever os testes que falham**

Mock de `firebase/firestore` igual ao de `usePlanData.test.tsx` (`doc: vi.fn((_db, ...p) => p.join('/'))`),
mais `collection: vi.fn((_db, ...p) => p.join('/'))`, `getDocs`, `getDoc` e `runTransaction`.
Casos (nomes dos `it` em português):

- `caminhoDoPlano`: `('u1', 2026)` → `['users','u1']`; `('u1', 2027)` → `['users','u1','planos','2027']`.
- `chaveLocalDoPlano`: `('u1', 2026)` → `'plan_data_u1'`; `('u1', 2027)` → `'plan_data_u1_2027'`.
- `anoDoPrimeiroPlano`: as seis linhas da tabela da spec, com datas locais
  (`new Date(2026, 10, 10)` → 2027; `new Date(2026, 8, 30)` → 2026; `new Date(2027, 2, 15)` → 2027;
  `new Date(2027, 8, 30)` → 2027; `new Date(2027, 9, 1)` → 2028; `new Date(2027, 11, 31)` → 2028).
- `proximoAnoDoPlano` (N = maior ano salvo + 1, só se N ≤ ano corrente + 1; lista vazia → `null`,
  porque não há de onde copiar):

  | anos salvos | hoje | resultado |
  |---|---|---|
  | `[2026]` | 10/11/2026 | 2027 |
  | `[2026, 2027]` | 10/11/2026 | `null` |
  | `[]` | 10/11/2026 | `null` |
  | `[2026, 2027]` | 15/01/2027 | 2028 |
  | `[2027]` | 10/11/2026 | `null` |

- `listarPlanos`: as quatro linhas da tabela da spec (`getDoc('users/u1')` com `exists()` e
  `getDocs('users/u1/planos')` com `docs: [{ id }]`). Mais um caso: `planos/` com `'2026'` e o
  legado presente devolve `[2026]` sem repetir.
- `listarPlanosLocais`: `localStorage` com `plan_data_u1`, `plan_data_u1_2027`, `plan_data_u1_x` e
  `plan_data_u2_2028` → `[2026, 2027]`.
- `montarPlanoDoAnoSeguinte` (caso 3 da spec), com uma origem de exemplo cheia (nome
  `'Padaria Sol'`, chave `'k-123'`, um produto `{id:'p1', name:'Pão', revenue2025: 1000, cost2025: 400, quantitySold2025: 50}`,
  SWOT preenchido, `taxes` com `regimeTributario: 'Lucro Presumido'`, `iss: 5`,
  `totalImpostos2024: 10`, `totalImpostos2025: 20`, `goals2026` e `financialSheet` preenchidos):
  - `companyProfile` e `marketAnalysis` iguais aos da origem;
  - `productPortfolio` = `[{id:'p1', name:'Pão', revenue2025: null, cost2025: null, quantitySold2025: null}]`;
  - os 14 campos de imposto da tabela iguais aos da origem; `totalImpostos2024 === 20`;
    `totalImpostos2025 === null`;
  - todo o resto igual a `iniciais` (compare `goals2026`, `scenarios2026`, `tracking2026`,
    `pricingItems` e cada chave de `planData` fora das três copiadas);
  - origem sem `marketAnalysis` e sem `taxes` → esses campos ficam com o valor de `iniciais`.
- `criarPlanoSeNaoExistir` (casos 3 e 4): com `tx.get(destino)` sem documento, chama
  `tx.set('users/u1/planos/2027', <montarPlanoDoAnoSeguinte(origem lida em 'users/u1')>)`; com o
  destino existente, não chama `tx.set`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/services/planos.test.ts`
Expected: FAIL, módulo `./planos` não encontrado.

- [ ] **Step 3: Implementar `src/services/planos.ts`**

`listarPlanos` usa `getDoc(doc(db, 'users', uid))` e `getDocs(collection(db, 'users', uid, 'planos'))`.
Os IDs passam por `/^\d{4}$/`, a lista sai sem repetição e em ordem crescente. Os dois
`listarPlanos*` ficam no mesmo módulo, para um só lugar conhecer os caminhos. `criarPlanoSeNaoExistir`
usa `runTransaction`: lê o destino, sai se ele existir, lê a origem (`caminhoDoPlano(uid, anoOrigem)`)
e grava a cópia. A origem lida vem do banco, não da tela. `totalImpostos2025` fica `null`, mesmo
que o tipo atual diga `number`; ajuste o tipo em `TaxesData` para `number | null` se o typecheck
reclamar. Um comentário de uma linha em `ANO_DO_PLANO_LEGADO` explica que o documento antigo é o
plano 2026.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/services/planos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/planos.ts src/services/planos.test.ts
git commit -m "feat(planos): caminho, lista e cópia do plano de cada ano"
```

---

### Task 2: Regras para `users/{uid}/planos/{ano}`

**Files:**
- Modify: `tests/rules/users.test.ts` (novo `describe`, no padrão do laço `PESSOAS`)

**Interfaces:**
- Consumes: `criarAmbiente`, `semear` e as `Pessoa` de `tests/rules/ambiente.ts`.

- [ ] **Step 1: Escrever os testes**

Para cada pessoa de `PESSOAS`:
- `getDoc` e `setDoc` em `users/{uid}/planos/2027` da própria conta passam só para quem
  `usaOProprio` (liberado e admin), e falham para pendente, bloqueado e sem login;
- `getDocs(collection(db, 'users', uid, 'planos'))` da própria conta segue a mesma regra;
- ler, gravar e listar `users/uid-outro/planos/2027` falha para todas.

- [ ] **Step 2: Rodar**

Run: `npm run test:rules`
Expected: PASS, sem mudar `firestore.rules`. Se algum caso de "passa" falhar, pare e relate: a
spec assume que a regra atual cobre a subcoleção.

- [ ] **Step 3: Ver falhar**

Um teste de regra que passa de primeira só conta depois de visto falhando. Inverta, sem commitar,
a expectativa de um caso de outro usuário (`assertSucceeds`), rode, veja `FAIL`, desfaça e rode
de novo até ver `PASS`.

- [ ] **Step 4: Commit**

```bash
git add tests/rules/users.test.ts
git commit -m "test(regras): plano de cada ano em users/{uid}/planos"
```

---

### Task 3: `usePlanData` carrega e grava um ano

**Files:**
- Modify: `src/hooks/usePlanData.tsx` (imports, linha 10; estado, 316-340; `saveToFirebase`,
  345-385; `carregarPlano`, 387-449; efeito de abertura, 451-455; `resetAllData`, 1616-1647;
  objeto `value`, 1558)
- Modify: `src/types.ts` (`PlanContextType`, a partir da 675; comentário acima de `PlanData`, 368)
- Test: `src/hooks/usePlanData.test.tsx`

**Interfaces:**
- Consumes: da tarefa 1, `caminhoDoPlano`, `chaveLocalDoPlano`, `listarPlanos`,
  `listarPlanosLocais`, `anoDoPrimeiroPlano`, `anosDoPlano` e `DadosDoPlano`.
- Produces (em `PlanContextType` e no `value`):
  - `anoPlano: number`, o ano carregado, ou, antes da primeira carga, o ano sendo aberto;
  - `anoBase: number` (`anoPlano − 1`);
  - `anosDisponiveis: number[]`, os anos salvos mais o ano aberto, sem repetição e em ordem
    crescente.
  - Internos para a tarefa 4: `carregarPlano(ano: number): Promise<void>`, o estado
    `anoCarregado: number | null`, o ref `anosSalvos` (`number[]`) e o ref `cargaAtual`
    (`number`, contador da carga mais recente).

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao mock de `firebase/firestore` as funções `collection`, `getDocs` e `runTransaction`.
Use `vi.setSystemTime(new Date(2026, 10, 10))`. `getDoc` e `getDocs` respondem por caminho (um
mapa `caminho → dados`). Casos:

- `abre o ano mais recente da lista`: legado `{planData: nome 'A'}` e `planos/2027`
  `{planData: nome 'B'}` → `anoPlano === 2027`, nome `'B'`, `anosDisponiveis` `[2026, 2027]`.
- `só com o legado abre 2026`: → `anoPlano === 2026`, `anoBase === 2025`.
- `cliente sem plano abre o ano do primeiro plano sem gravar` (caso 6): nenhum documento →
  `anoPlano === 2027`, `estadoDaCarga === 'carregado'`, `setDoc` não chamado depois de 10 s. Uma
  edição (`updateCompanyProfile('name', 'Nova')`) seguida de 3 s → `setDoc` com caminho
  `'users/u1/planos/2027'`.
- `carga monta do valor inicial, não do estado anterior`: o legado tem só `{planData: {companyProfile}}`
  → `goals2026`, `scenarios2026`, `tracking2026`, `taxes` e `pricingItems` iguais aos iniciais
  (hoje passaria, mas deixa o comportamento preso).
- `"Apagar tudo" no 2027 não toca o legado` (caso 7): abre 2027 e chama `resetAllData()` → `setDoc`
  só com `'users/u1/planos/2027'`.
- `carga negada e acesso liberado recarrega o mesmo ano` (Review Focus 5): o `getDoc` de
  `planos/2027` rejeita com `permission-denied` → `'falhou'`; o status passa a `active` → o
  `getDoc` de `'users/u1/planos/2027'` é chamado de novo. Com `getDocs` rejeitando na listagem, a
  liberação refaz a listagem.
- **Offline** (caso 11): um `describe` próprio que usa `vi.stubEnv('VITE_FIREBASE_API_KEY', 'COLE_SUA_API_KEY_AQUI')`,
  `vi.resetModules()` e `await import('./usePlanData')`. Com `plan_data_u1` e `plan_data_u1_2027`
  no `localStorage`, abre 2027. Uma edição grava em `plan_data_u1_2027` e deixa `plan_data_u1`
  intacto.

Os testes atuais que esperam `setDoc('users/u1', …)` continuam valendo para quem só tem o legado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/usePlanData.test.tsx`
Expected: FAIL (`anoPlano` undefined, caminho `users/u1/planos/2027` nunca usado).

- [ ] **Step 3: Implementar**

- **Abertura (efeito de `user.uid`):** `listarPlanos` (offline: `listarPlanosLocais`) → guarda em
  `anosSalvos` → `carregarPlano(lista.at(-1) ?? anoDoPrimeiroPlano(new Date()))`. Se a listagem
  falhar, o estado vira `'falhou'`.
- **`carregarPlano(ano)`:**
  - incrementa `cargaAtual` e guarda o número;
  - descarta o resultado se, ao terminar, já houver uma carga mais nova;
  - monta o estado a partir dos valores iniciais (`initialPlanData`, `initialGoals`,
    `initialScenarios`, `{}`, `initialTaxes`, `[]`), nunca do `prev`;
  - documento ausente → todos os valores iniciais;
  - mantém o recálculo, os fatores do oceano azul e a chave do Gemini como hoje;
  - chama `setAnoCarregado(ano)` no mesmo tique dos setters e de `setEstadoDaCarga('carregado')`.
- **`saveToFirebase`:** grava em `doc(db, ...caminhoDoPlano(uid, anoCarregado))` ou em
  `chaveLocalDoPlano(uid, anoCarregado)`. Recusa quando `anoCarregado === null`, com o mesmo motivo
  de hoje. Depois de gravar, junta o ano a `anosSalvos`.
- **`tentarCarregarDeNovo` e `aplicarStatusDeAcesso`:** recarregam o ano da última carga pedida;
  sem nenhum ano pedido, refazem a abertura.
- **`resetAllData`:** grava no caminho de `anoCarregado`.

Comentário de uma linha onde a carga parte dos valores iniciais: "carregar outro ano a partir do
`prev` mostraria e gravaria o ano anterior".

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/hooks/usePlanData.test.tsx`
Expected: PASS, incluindo os testes antigos.

- [ ] **Step 5: Typecheck e commit**

Run: `npm run typecheck`. Expected: sem erros. Os `planoFalso` dos testes de componente que tipam
`PlanContextType` ganham `anoPlano: 2026, anoBase: 2025, anosDisponiveis: [2026]` e o que a tarefa
4 acrescentar; faça isso aqui se o typecheck pedir.

```bash
git add src/hooks/usePlanData.tsx src/hooks/usePlanData.test.tsx src/types.ts
git commit -m "feat(plano): carregar e gravar o plano do ano aberto"
```

---

### Task 4: Trocar de ano e começar o seguinte

**Files:**
- Modify: `src/hooks/usePlanData.tsx`, `src/types.ts`
- Test: `src/hooks/usePlanData.test.tsx`

**Interfaces:**
- Consumes: da tarefa 3, `carregarPlano(ano)`, `anoCarregado`, `anosSalvos` e `cargaAtual`; da
  tarefa 1, `proximoAnoDoPlano` e `criarPlanoSeNaoExistir`.
- Produces (em `PlanContextType`):
  - `trocarAno(ano: number): Promise<boolean>`: `false` quando não troca (gravação falhou);
  - `proximoAnoDisponivel: number | null`, que é `proximoAnoDoPlano(anosSalvos, new Date())`;
  - `comecarProximoAno(): Promise<boolean>`;
  - `criandoAno: boolean`.

- [ ] **Step 1: Escrever os testes que falham**

- `trocar com edição pendente grava 2026 no legado e só então carrega 2027` (caso 1): edita, chama
  `trocarAno(2027)` antes dos 3 s → a ordem das chamadas é `setDoc('users/u1', …)` e depois
  `getDoc('users/u1/planos/2027')`. Nenhum `setDoc` em `users/u1/planos/2027` traz o nome do 2026.
- `trocar com gravação falhando continua no ano aberto` (caso 2): `setDoc` rejeita com
  `permission-denied` → devolve `false`, `anoPlano === 2026`, `getDoc('users/u1/planos/2027')` não
  é chamado e `motivoDoErroAoSalvar` contém `'acesso'`.
- `troca espera a gravação em andamento` (Review Focus 3): um `setDoc` que só resolve quando o
  teste mandar, com `saveStatus === 'saving'`, mais uma edição nova → `trocarAno(2027)` espera,
  grava de novo no legado com a edição nova e só depois lê 2027.
- `ano sem documento começa dos valores iniciais` (Review Focus 1): o legado tem nome `'A'`,
  `goals2026` preenchido e `taxes.iss = 5`, e não há `planos/2027`. Abre 2026 e chama
  `trocarAno(2027)` → nome `''`, `goals2026` igual ao inicial, `taxes.iss === 0`, `anoPlano === 2027`
  e nenhum `setDoc` depois de 10 s.
- `troca rápida: só a última carga entra` (Review Focus 2): o `getDoc` de 2027 resolve depois do
  de 2026; `trocarAno(2027)` seguido de `trocarAno(2026)` → o estado final é o do 2026.
- `começar 2027 cria a cópia e abre` (caso 3): lista `[2026]`; `runTransaction` com `tx.get`
  falso → `tx.set('users/u1/planos/2027', …)` com `companyProfile` do legado lido no banco. Depois
  `anoPlano === 2027` e `anosDisponiveis` `[2026, 2027]`.
- `começar 2027 quando outra aba já criou abre o existente` (caso 4): `tx.get` de `planos/2027`
  existente → sem `tx.set`; abre com os dados do documento existente.
- `começar duas vezes seguidas roda uma transação` (Review Focus 4): duas chamadas a
  `comecarProximoAno()` no mesmo `act` → `runTransaction` chamado uma vez.
- `proximoAnoDisponivel` em 10/11/2026: `[2026]` → 2027; depois de começar 2027 → `null`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/usePlanData.test.tsx`
Expected: FAIL (`trocarAno is not a function`).

- [ ] **Step 3: Implementar**

**Gravar antes de sair**, uma função interna usada pelas duas ações: se `saveStatusRef.current`
for `unsaved`, `saving` ou `error`, espera a gravação em andamento (guarde a promessa de
`saveToFirebase` num ref) e chama `saveToFirebase(true)`. Uma rejeição devolve `false`.

`trocarAno` grava antes de sair e, se der certo, chama `carregarPlano(ano)`.

`comecarProximoAno`:
- se `criandoAno` estiver ligado, sai (use um ref, para cobrir duas chamadas no mesmo tique);
- grava antes de sair;
- chama `criarPlanoSeNaoExistir(db, uid, N, max(anosSalvos), iniciais)`; offline, faz a mesma
  coisa em `localStorage`, com `listarPlanosLocais`/`chaveLocalDoPlano`;
- junta N a `anosSalvos`;
- chama `carregarPlano(N)`.

Uma falha da transação vai para `motivoDoErroAoSalvar`, com a mesma tradução da gravação. Os
`iniciais` são os valores iniciais que já estão no hook.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/hooks/usePlanData.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePlanData.tsx src/hooks/usePlanData.test.tsx src/types.ts
git commit -m "feat(plano): trocar de ano e começar o plano seguinte"
```

---

### Task 5: Seletor de ano e nome "PLAN"

**Files:**
- Modify: `src/components/Sidebar.tsx` (cabeçalho, 96-106; rótulos, 119 e 123)
- Modify: `src/components/Login.tsx:87`, `src/components/AguardandoLiberacao.tsx`,
  `src/components/SubscriptionExpiredPage.tsx`, `index.html:7`
- Test: `src/components/Sidebar.test.tsx` (crie, se não existir)

**Interfaces:**
- Consumes: de `usePlan()`, `anoPlano`, `anosDisponiveis`, `trocarAno`, `proximoAnoDisponivel`,
  `comecarProximoAno`, `criandoAno` e `motivoDoErroAoSalvar`.

- [ ] **Step 1: Escrever os testes que falham**

Com `usePlan` mockado (`anoPlano: 2026`, `anosDisponiveis: [2026]`, `proximoAnoDisponivel: 2027`):

- o cabeçalho mostra `PLAN 2026`, e o seletor (`<select aria-label="Ano do plano">`) tem a opção
  2026 selecionada;
- o botão `Começar plano 2027` chama `comecarProximoAno` uma vez; com `criandoAno: true`, ele fica
  `disabled`;
- com `proximoAnoDisponivel: null`, o botão não aparece;
- com `anosDisponiveis: [2026, 2027]`, escolher 2027 chama `trocarAno(2027)`. Se `trocarAno`
  devolver `false`, o `select` volta a 2026;
- os rótulos do menu dizem `Coleta de Dados 2025` e `Planejamento 2026` com
  `anoPlano: 2026`, e `Coleta de Dados 2026` e `Planejamento 2027` com `anoPlano: 2027`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/Sidebar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

O seletor e o botão ficam no cabeçalho da barra lateral. Na barra recolhida (se houver esse modo),
mostra só o ano. O `select` é controlado pelo `anoPlano`, então volta sozinho quando a troca falha.
Login, Aguardando e Assinatura vencida dizem "PLAN", e o `<title>` vira
`PLAN - Planejamento Estratégico`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest related --run src/components/Sidebar.tsx src/components/Login.tsx src/components/AguardandoLiberacao.tsx src/components/SubscriptionExpiredPage.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/Sidebar.test.tsx src/components/Login.tsx src/components/AguardandoLiberacao.tsx src/components/SubscriptionExpiredPage.tsx index.html
git commit -m "feat(plano): seletor de ano e nome PLAN"
```

---

### Task 6: DPE importa o ano base do plano aberto

**Files:**
- Modify: `src/services/dpeImport.ts` (remover `escolherAnoBase`, 168-188; assinatura, 227;
  uso, 240; textos com ano, 262-276 e 701; comentários, 2, 7 e 162)
- Modify: `src/components/ImportFromDpe.tsx` (47, 56 e textos com ano)
- Create: `src/services/dpeImport.test.ts`

**Interfaces:**
- Consumes: `anoBase` de `usePlan()`.
- Produces: `importarDoDiagnostico(foto: FotoDpe, anoBase: number): ResultadoImportacao`.
  `resultado.anoBase` passa a ser o recebido.

- [ ] **Step 1: Escrever os testes que falham**

Uma `FotoDpe` mínima com a série mensal de 2025 completa (12 meses com receita) e de 2026 de
janeiro a outubro:

- `plano 2027 importa 2026` (caso 9): `importarDoDiagnostico(foto, 2026)` → `anoBase === 2026`,
  `mesesEncontrados === 10`, e a anotação da receita traz `'Faltam 2 meses para o ano fechar.'`;
- `plano 2026 importa 2025`: `(foto, 2025)` → `anoBase === 2025`, `mesesEncontrados === 12`;
- `ano base sem nenhum mês`: `(foto, 2024)` → `mesesEncontrados === 0`, e a anotação
  `'Série financeira de 2024'` tem estado `'faltando'`, com o texto citando 2024;
- o texto de 701 cita `PLAN 2027` para `anoBase` 2026.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/services/dpeImport.test.ts`
Expected: FAIL (com o ano 2026, a regra de hoje escolhe 2025, o ano mais completo).

- [ ] **Step 3: Implementar**

`importarDoDiagnostico` usa `serieDoAno(serie, anoBase)`. `escolherAnoBase` sai, porque fica sem
uso. `ImportFromDpe` passa `anoBase` de `usePlan()`, e os textos dele usam `anoBase`/`anoPlano`.

- [ ] **Step 4: Rodar, typecheck e commit**

Run: `npx vitest related --run src/services/dpeImport.ts src/components/ImportFromDpe.tsx` e depois
`npm run typecheck`
Expected: PASS e typecheck sem erros.

```bash
git add src/services/dpeImport.ts src/services/dpeImport.test.ts src/components/ImportFromDpe.tsx
git commit -m "feat(dpe): importar o ano base do plano aberto"
```

---

### Task 7: Prompts do Gemini com os anos do plano

**Files:**
- Modify: `src/services/geminiService.ts`. Funções com ano no texto: getMarketResearchFromCnpj
  (182, 192), getTaxRecommendation (242-264), getGoalSuggestions (301, 314), getOkrKpiSuggestions
  (392, 398), getDecisionTriggers (586), getScenarioAnalysis (617), getBenchmarkAnalysis (687-702),
  generateComprehensiveStrategicAnalysis (734-748), generateDiagnosisReportAnalysis (975-992),
  generatePlanReportAnalysis (1031-1050) e generateMarketingFunnelAnalysis (1084-1104).
- Modify: as chamadas em `src/hooks/usePlanData.tsx` (objeto `value` e funções `generate*`),
  `src/components/Settings.tsx` e `src/components/Taxes.tsx`.
- Test: `src/services/geminiService.test.ts`

**Interfaces:**
- Consumes: `AnosDoPlano` (tarefa 1); `anoPlano` e `anoBase` do hook.
- Produces: cada função da lista recebe `anos: AnosDoPlano` como último parâmetro.

- [ ] **Step 1: Escrever os testes que falham**

Com o mock de `@google/genai` capturando o prompt, e `anos = { anoPlano: 2027, anoBase: 2026 }`:

- `getGoalSuggestions`, `generatePlanReportAnalysis` e `generateDiagnosisReportAnalysis`: o prompt
  contém `2027` e `2026` e não contém `2025`;
- `getTaxRecommendation`: o prompt cita o ano do plano 2027 e mantém o texto da reforma (por
  exemplo, a menção à CBS) intacto.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/services/geminiService.test.ts`
Expected: FAIL (o prompt traz "2025" fixo).

- [ ] **Step 3: Implementar**

Os anos do plano no prompt vêm de `anos`, e "2024" vira `anos.anoPlano - 2`. Em
`getTaxRecommendation`, os anos da lei (calendário da reforma) não mudam. Eles ficam entre
`// ano-real:início` e `// ano-real:fim`, os marcadores que a tarefa 8 reconhece.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest related --run src/services/geminiService.ts src/hooks/usePlanData.tsx src/components/Settings.tsx src/components/Taxes.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/geminiService.ts src/services/geminiService.test.ts src/hooks/usePlanData.tsx src/components/Settings.tsx src/components/Taxes.tsx
git commit -m "feat(gemini): prompts com os anos do plano aberto"
```

---

### Task 8: Teste de guarda, Coleta e Diagnóstico

**Files:**
- Create: `src/utils/semAnoFixo.test.ts`, no padrão de `src/utils/semHtmlCru.test.ts`
- Modify (rótulos com ano): `DataCollection.tsx`, `shared/InvestmentDataSheet.tsx`,
  `shared/PeopleDataSheet.tsx`, `shared/MarketingDataSheet.tsx`, `shared/FinancialDataRow.tsx`,
  `shared/CommercialDataSheet.tsx`, `ProductPortfolio.tsx`, `MarketAnalysis.tsx`, `Dashboard.tsx`,
  `PlanSummary.tsx`, `OnboardingWizard.tsx`, `Taxes.tsx` (todos em `src/components/`)
- Test: `src/components/DataCollection.test.tsx` (crie, se não existir)

**Interfaces:**
- Consumes: `anoPlano`/`anoBase` de `usePlan()`.
- Produces: `src/utils/semAnoFixo.test.ts`, com a lista `PENDENTES` (arquivos da tarefa 9) que a
  tarefa 9 esvazia e remove.

- [ ] **Step 1: Escrever o teste de guarda**

O teste lê os `.ts`/`.tsx` de `src/`, menos `*.test.*`. Em cada arquivo:

1. Ignora as linhas entre `ano-real:início` e `ano-real:fim`, que aparecem como `// …` ou
   `{/* … */}`. Um `início` sem `fim` reprova o arquivo.
2. Troca os comentários `/* … */` por quebras de linha equivalentes, para manter a numeração.
   Remove `//…` até o fim da linha, quando não vier depois de `:` (preserva URLs).
3. Reprova cada ocorrência de `/(?<![\w])20[2-3]\d(?!\d)/` e de
   `/(?<![\w])(?:[A-Za-z]{3}|\d{2})\/2\d(?!\d)/` ("Dez/26", "31/12/25").
4. Exceção: a linha de `ANO_DO_PLANO_LEGADO =` em `services/planos.ts`.

A falha lista `src/<arquivo>:<linha>: <trecho>`, como em `semHtmlCru`. A lista `PENDENTES` traz os
arquivos da tarefa 9, ignorados até ela. Testes do próprio guarda, com texto em memória:
`<h2>Metas 2026</h2>` reprova; `goals2026.financeiras` passa; `// até 2027` passa;
`'https://x.com/2026'` reprova; `Saldo Dez/26` reprova; um bloco `ano-real` passa.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/utils/semAnoFixo.test.ts`
Expected: FAIL, listando os arquivos desta tarefa. Anote a contagem no relato.

- [ ] **Step 3: Escrever o teste de componente que falha** (caso 8, Coleta)

`DataCollection.test.tsx`, com `usePlan` mockado (`anoPlano: 2027, anoBase: 2026`, o resto do
`planoFalso` padrão) → `container.textContent` casa com `/2026/` e não casa com `/2025/`.

- [ ] **Step 4: Trocar os rótulos**

Use as regras de Global Constraints. Em `Taxes.tsx`:
- os rótulos do plano (152, 167, 243, 244, 544, 597 e 875: "Receita Bruta 2025", "Coleta de Dados
  2025", "Total Impostos 2024/2025", "base 2025") mudam;
- o conteúdo da reforma com anos da lei (`timelineData`, 15-18, e os blocos de 220-221, 264-359,
  446-492, 528, 552, 574, 675-680, 797, 813, 854 e 953) fica entre marcadores `ano-real`.

Na dúvida se um ano em `Taxes.tsx` é do plano ou da lei, pare e pergunte. Um ano de dado real em
outro arquivo também é condição de parada.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/utils/semAnoFixo.test.ts` e depois
`npx vitest related --run <arquivos alterados nesta tarefa>`
Expected: PASS. Os testes de componente existentes que procuravam "2025" com `planoFalso` de 2026
continuam passando (o `planoFalso` tem `anoPlano: 2026, anoBase: 2025`).

- [ ] **Step 6: Commit**

```bash
git add src/utils/semAnoFixo.test.ts src/components/DataCollection.test.tsx <arquivos alterados>
git commit -m "feat(plano): anos da coleta e do diagnóstico seguem o plano aberto"
```

---

### Task 9: Planejamento, relatórios e ajuda

**Files:**
- Modify (em `src/components/`): `GoalSetting.tsx`, `OkrsAndKpis.tsx`, `CommercialPlanning.tsx`
  (por faixa), `ScenarioPlanning.tsx`, `MarketingFunnel.tsx`, `FinancialPlanning2026.tsx` (50 e
  223: "Saldo Dez/26"), `InvestimentosFinanciamentos2026.tsx` (124: "31/12/25"),
  `MonthlyTracking.tsx`, `ReportGenerator.tsx`, `reports/ReportPreview.tsx`,
  `reports/FinancialPlanReport.tsx`, `reports/DataCollectionReport.tsx`, `HelpGuide.tsx`
- Modify: `src/utils/semAnoFixo.test.ts` (remover `PENDENTES`)
- Test: `GoalSetting.test.tsx` (crie, se não existir), `FinancialPlanning2026.test.tsx` (crie, se
  não existir), `reports/ReportPreview.test.tsx`

**Interfaces:**
- Consumes: `anoPlano`/`anoBase` de `usePlan()`. Os relatórios recebem os anos pelo mesmo caminho
  pelo qual recebem os dados hoje (props ou `usePlan`).

- [ ] **Step 1: Escrever os testes que falham** (caso 8)

Para as Metas, o Planejamento Financeiro e o Relatório, com `anoPlano: 2027, anoBase: 2026`:
`container.textContent` casa com `/2027/` e não casa com `/2025/`. O relatório mostra
`PLAN 2027`, e o Planejamento Financeiro mostra `Dez/27`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/GoalSetting.test.tsx src/components/FinancialPlanning2026.test.tsx src/components/reports/ReportPreview.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Trocar os rótulos e esvaziar `PENDENTES`**

Use as regras de Global Constraints. A `HelpGuide` cita os anos do plano aberto.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/utils/semAnoFixo.test.ts` e
`npx vitest related --run <arquivos alterados nesta tarefa>`; depois `npm run typecheck`
Expected: PASS, guarda sem violações e typecheck sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/utils/semAnoFixo.test.ts <testes novos> <arquivos alterados>
git commit -m "feat(plano): anos do planejamento, relatórios e ajuda seguem o plano aberto"
```
