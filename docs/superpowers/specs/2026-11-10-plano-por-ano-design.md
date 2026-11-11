# Um plano por ano (design)

- **Data:** 2026-11-10
- **Nível:** Estrutural + Sensível. Muda onde o plano é guardado e como ele é carregado e gravado.
  Toca `src/hooks/usePlanData.tsx`, `src/services/**`, `src/App.tsx`, `Login.tsx`,
  `AguardandoLiberacao.tsx` e `SubscriptionExpiredPage.tsx`.
- **Branch:** `feat/plano-por-ano`, criada a partir da `main` local `17719a1`.
- **Origem:** parte A da entrega 3 da revisão para o ciclo 2027. A parte B (CBS de 2027 e tabela
  da reforma) vira a entrega seguinte, por decisão do usuário.

## Objetivo

Hoje cada cliente tem um único documento, `users/{uid}`, com o plano inteiro. Os anos estão fixos
no código: nos nomes dos campos (`values2025`, `goals2026`, `*2026`), nos rótulos, nos relatórios
e nos textos enviados ao Gemini. Começar o ciclo 2027 nesse documento apaga o 2026.

Depois desta entrega:

- cada ano tem o seu plano;
- o cliente troca de ano por um seletor;
- começar 2027 não toca no 2026;
- todos os anos que aparecem na tela seguem o plano aberto.

Decisões do usuário (2026-11-10):

- **escopo:** separar a entrega 3 e fazer o plano por ano primeiro;
- **ano novo:** copia o cadastro e deixa os números em branco;
- **plano antigo:** continua editável, com um seletor de ano;
- **nome:** "PLAN" + ano do plano aberto;
- **desenho:** aprovado como apresentado no chat, com a opção de guardar o legado como 2026.

## Termos

- **Ano do plano (`anoPlano`):** o ano planejado. Nos dados, são os campos `*2026` (`goals2026`,
  `scenarios2026`, `tracking2026`, `investment2026`, `financialPlan2026`, `target2026`).
- **Ano base (`anoBase`):** `anoPlano − 1`. Nos dados, são os campos `*2025` (`values2025`,
  `revenue2025`, `value2025`, `saldoCaixaFinal2025`, `totalImpostos2025`).
- **Ano anterior ao base:** `anoPlano − 2`. No campo `totalImpostos2024`.

Os nomes internos não mudam. Eles passam a significar "ano base" e "ano do plano". Renomear cerca
de 1.000 ocorrências aumentaria o risco sem mudar nada para o cliente. Um comentário em `types.ts`
registra esse significado.

## Parte 1 — Onde cada ano fica

| Ano | Documento no Firestore | Modo offline (`localStorage`) |
|---|---|---|
| 2026 | `users/{uid}`, o documento de hoje, sem migração | `plan_data_{uid}`, a chave de hoje |
| outro ano | `users/{uid}/planos/{ano}`, com o ano como ID (`"2027"`) | `plan_data_{uid}_{ano}` |

- Um módulo puro, `src/services/planos.ts`, concentra esse mapa: `ANO_DO_PLANO_LEGADO = 2026` e o
  caminho de cada ano. Nenhum outro arquivo monta caminho de plano.
- `planos/2026` nunca é criado. O ano 2026 sempre usa o documento legado.
- **Regras:** `firestore.rules` já libera `users/{uid}/{documento=**}` só para o dono com acesso
  liberado, ou para o admin no próprio espaço. A entrega não muda as regras e não exige publicá-las.
  Os testes de regras ganham casos para `planos/{ano}`.

### Quais planos o cliente tem

`listarPlanos(uid)` devolve os anos em ordem crescente:

- 2026, se o documento legado existir;
- mais os IDs numéricos de `users/{uid}/planos`.

IDs que não são um ano inteiro de 4 dígitos são ignorados.

Exemplos:

| Legado existe | `planos/` | Resultado |
|---|---|---|
| sim | vazio | `[2026]` |
| sim | `2027` | `[2026, 2027]` |
| não | vazio | `[]`, o cliente não tem plano |
| não | `2027`, `abc` | `[2027]` |

### Primeiro plano de quem não tem nenhum

`anoDoPrimeiroPlano(hoje)`: a partir de 1º de outubro vale o ano seguinte; antes disso, o ano
corrente. A data usada é a local.

| Hoje | Ano |
|---|---|
| 10/11/2026 | 2027 |
| 30/09/2026 | 2026 (vai para o documento legado) |
| 15/03/2027 | 2027 |
| 30/09/2027 | 2027 |
| 01/10/2027 | 2028 |
| 31/12/2027 | 2028 |

Abrir esse plano não grava nada. Ele passa a existir na primeira edição, pelo salvamento automático
de hoje. Até lá, `listarPlanos` devolve `[]` e o seletor mostra só esse ano.

## Parte 2 — Abrir, trocar e gravar

- **Ao entrar:** o app abre o ano mais recente da lista, ou o ano do primeiro plano se a lista
  estiver vazia.
- **Seletor de ano na barra lateral:**
  - mostra os anos da lista e o ano aberto;
  - trocar de ano carrega aquele plano pelo mesmo caminho de carga de hoje (`carregarPlano`), com o
    recálculo na carga e sem gravar ao abrir.
- **Antes de trocar:**
  - se houver gravação pendente (`unsaved`) ou em andamento (`saving`), o app grava primeiro e
    espera terminar;
  - se a gravação falhar (`error`), a troca não acontece, o seletor volta ao ano aberto e o motivo
    aparece como hoje.
- **O ano viaja com os dados:**
  - o ano carregado (`anoCarregado`) é definido no mesmo commit em que os dados lidos entram no
    estado;
  - `saveToFirebase` grava no caminho de `anoCarregado`, nunca no ano escolhido no seletor;
  - durante a troca o estado volta a `'carregando'`, e a gravação continua recusada até a carga
    terminar, como hoje.
- **Carga que falha:** vale o fluxo de hoje (`ErroAoAbrirPlano` com "Tentar de novo"), que recarrega
  o mesmo ano.
- **"Apagar tudo" (`resetAllData`):** limpa só o plano do ano aberto, no caminho dele.
- **Gemini:** a chave fica no `companyProfile` de cada plano. Ao abrir um ano, o `localStorage` passa
  a ter a chave daquele plano, como hoje. Editar a chave no 2027 não muda a do 2026.

## Parte 3 — Começar o ano seguinte

- **Botão "Começar plano {N}":** fica no seletor, com `N = maior ano da lista + 1`. Aparece só se
  `N ≤ ano corrente + 1`. Em 10/11/2026, com `[2026]`, oferece 2027; com `[2026, 2027]`, não
  oferece nada.
- **Ao clicar:**
  1. grava o pendente do ano aberto (mesma regra da troca);
  2. cria `planos/{N}` numa transação que só grava se o documento não existir; se outra aba já
     criou, apenas abre o que existe;
  3. abre o ano N.
- **Origem da cópia:** o maior ano da lista, lido do banco, não o estado da tela.
- **O que é copiado:**

| Campo | Regra |
|---|---|
| `planData.companyProfile` | inteiro: nome, CNPJ, setor e chave do Gemini |
| `planData.productPortfolio` | `id` e `name`; `revenue2025`, `cost2025` e `quantitySold2025` ficam `null` |
| `planData.marketAnalysis` | inteiro: concorrência, SWOT, oceano azul e relógio de Bowman |
| `taxes` | `regimeTributario`, `anexoSimples`, `aliquotaEfetiva`, `simplesNacional`, `iss`, `icms`, `pis`, `cofins`, `irpj`, `csll`, `inssPatronal`, `fgts`, `ratTerceiros`, `totalEncargosFolha` |
| `taxes.totalImpostos2024` | recebe o `totalImpostos2025` da origem, porque é o mesmo ano civil |
| `taxes.totalImpostos2025` | `null` |

- **O que começa no valor inicial do app:** todo o resto. Isso inclui:
  - Coleta (`financialSheet`, `commercial`, `people`, `marketing`, `investment`);
  - `investment2026`, `okrsAndKpis`, `commercialPlanning`, `hiringProjection` e `actionPlan`;
  - `financialPlan2026`, `scenarioRelatedData`, `scenariosInputMode` e `analysis`;
  - `goals2026`, `scenarios2026`, `tracking2026` e `pricingItems`.
- **Dado ausente na origem:** um campo copiado que falte na origem fica com o valor inicial.

## Parte 4 — Anos na tela

- **Contexto:** `usePlan()` passa a expor `anoPlano` e `anoBase`.
- **Substituição dos anos:** todo texto visível que hoje diz "2026" ou "2025" passa a usar esses
  valores; "2024" passa a usar `anoPlano − 2`. Isso vale para:
  - rótulos e títulos de telas e abas;
  - tabelas, gráficos e relatórios;
  - a ajuda (`HelpGuide`);
  - o onboarding;
  - mensagens da importação do DPE;
  - textos como "dívida em 31/12/25", que vira "31/12/{anoBase}".
- **Gemini:** as funções de `geminiService.ts` recebem os anos e os usam nos prompts, em vez de
  "2025" e "2026" fixos.
- **Nome do produto:**
  - dentro do app e nos relatórios: "PLAN {anoPlano}";
  - no login, na tela de aguardando liberação, na de assinatura vencida e no `<title>` do
    `index.html`: "PLAN";
  - nas boas-vindas do onboarding, que aparece com um plano aberto: "PLAN {anoPlano}".
- **Fica de fora:** a linha do tempo da reforma em `Taxes.tsx` (`timelineData`) traz anos reais da
  lei e fica como está; ela é da parte B.
- **Teste de guarda, `src/utils/semAnoFixo.test.ts`:**
  - lê os `.ts`/`.tsx` de `src/`, exceto testes;
  - falha se encontrar um ano solto (`(?<![\w])20[2-3]\d(?!\d)`) fora de comentários;
  - não pega identificadores como `goals2026`, porque o ano vem colado a letras;
  - exceções, por arquivo e trecho: `timelineData` em `Taxes.tsx` e a constante
    `ANO_DO_PLANO_LEGADO` em `planos.ts`;
  - exemplo: `<h2>Metas 2026</h2>` reprova; `goals2026.financeiras` passa; `// até 2027` passa.

## Parte 5 — Importação do DPE

- **Ano escolhido:** `dpeImport` passa a receber o `anoBase` do plano aberto e usa os meses desse
  ano. A regra de hoje, "o ano mais completo", sai.
- **Exemplos, com o DPE trazendo 2025 completo e jan–out de 2026:**
  - plano 2027 → importa 2026 e mantém o aviso "Faltam 2 meses para o ano fechar";
  - plano 2026 → importa 2025.
- **DPE sem nenhum mês do ano base:** a série financeira entra como "faltando", com a mensagem de
  hoje, que passa a citar o ano.
- **Destino:** a importação aplica no plano aberto.

## Casos que precisam de teste

1. Trocar de 2026 para 2027 com edição pendente: grava 2026 no documento legado e só então carrega
   2027. Nenhuma gravação de dados de 2026 em `planos/2027`, nem o contrário.
2. Trocar com gravação falhando: continua no ano aberto e mostra o motivo.
3. Começar 2027: o documento criado tem exatamente os campos copiados da tabela, com os valores
   iniciais no resto e `totalImpostos2024` igual ao `totalImpostos2025` da origem.
4. Começar 2027 quando `planos/2027` já existe (outra aba): não sobrescreve e abre o existente.
5. `listarPlanos` e `anoDoPrimeiroPlano` com os exemplos das tabelas.
6. Cliente sem plano: abre o ano do primeiro plano sem gravar; a primeira edição cria o documento no
   caminho certo.
7. "Apagar tudo" no 2027 não toca o legado.
8. Num plano 2027, as telas mostram "2027" e "2026" onde hoje mostram "2026" e "2025". Testes de
   componente cobrem pelo menos a Coleta, as Metas, o Planejamento Financeiro e o Relatório.
9. DPE com os exemplos da Parte 5.
10. Regras: o dono liberado lê e grava `users/{uid}/planos/2027`; outro usuário, um usuário pendente
    e alguém sem login são recusados.
11. Modo offline: as chaves de `localStorage` por ano.

## Fora do escopo

- CBS de 2027, a tabela da reforma e a linha do tempo de `Taxes.tsx` (parte B).
- Renomear campos, tipos e componentes (`FinancialPlanning2026`, `Goals2026` etc.).
- Copiar realizado de 2026 para o ano base de 2027 (decisão do usuário: base em branco).
- Apagar um ano inteiro ou mover o legado para `planos/2026`.
- Edição simultânea do mesmo ano em duas abas (salvamento do documento inteiro, anterior a esta
  entrega).

## Condições de parada

- Se algum fluxo legítimo gravar em `users/{uid}` sem ser o plano 2026 (por exemplo, dados de conta
  ou assinatura), pare e relate antes de mudar o caminho.
- Se a cópia do ano novo exigir campo fora da tabela da Parte 3, pare e pergunte.
- Se o teste de guarda achar um ano que seja dado real e não rótulo (como a linha do tempo da
  reforma), pare e relate, em vez de ampliar a lista de exceções por conta própria.

## Passos humanos

Nenhum novo. As regras não mudam. Publicar continua dependendo dos acessos da entrega 1:
deploy na Vercel e publicação das regras já pendentes.
