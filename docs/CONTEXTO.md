# PLAN 2026 + Diagnóstico — onde estamos

**Última atualização:** 21/08/2026

Este arquivo existe para que qualquer pessoa (ou qualquer sessão futura) consiga
retomar sem reconstruir o raciocínio. Se algo aqui contradisser o código, **o
código ganha** — e este arquivo precisa ser corrigido.

---

## 1. Os dois sistemas e o que cada um faz

| | **DPE-GI (diagnóstico)** | **PLAN 2026** |
|---|---|---|
| Endereço | gestaoimpacto.com/planejamento | plan2026.gestaoimpacto.com |
| Serve para | Diagnosticar: onde a empresa está e por quê | Projetar: orçamento, DRE, cenários |
| Pasta | `~/Documents/PROJETOS/PLANEJAMENTO-ESTRATEGICO` | `~/Documents/PROJETOS/app-orcamento-gi` |
| Repositório | *(sem repositório remoto)* | `github.com/leonardollo/plan26` — **público** |
| Banco | Supabase `vyacxhqkkekkfytgaklv` (o do FluxoGI) | Firebase `plan-ea4cc` → **migrando para o Supabase** |
| Publicação | `DEPLOY_TOKEN=… node deploy.mjs` | Vercel, pela CLI (ver seção 6) |

**A divisão:** o DPE coleta e diagnostica; o PLAN projeta e acompanha. Não são
concorrentes. O Bloco 2 do diagnóstico é exatamente o que a Coleta de Dados do
PLAN pede — por isso a integração existe.

---

## 2. O que foi construído em 20/08/2026

### No diagnóstico (DPE-GI)

Três páginas no ar:

- `/planejamento` — formulário de 7 blocos, link aberto ao cliente
- `/planejamento/painel` — as respostas, login + allowlist `dpe_admins`
- `/planejamento/caderno` — o documento-mestre como página de leitura

**Como nada se perde:** cada gravação é uma **foto nova** em `dpe_fotos` — nunca
um UPDATE. Não existe policy de UPDATE nem de DELETE, então nada do que foi
gravado pode ser alterado de fora. Retomar de outro aparelho passa pela função
`dpe_retomar(id, chave)`, que exige o par que só existe no link da pessoa.

### No PLAN 2026 — quatro PRs

| PR | O quê | Estado |
|---|---|---|
| #1 | Importar do Diagnóstico | no ar |
| #2 | Revisão: 5 defeitos que o cliente via | no ar |
| #3 | Portão de liberação + aba de admin | no ar |
| #4 | Aviso de "não salvou" explica o motivo | **aberto** |

**Os cinco defeitos do PR #2**, todos em coisa que o cliente enxergava:

1. O dashboard **acusava prejuízo em empresa lucrativa** — o ponto de equilíbrio
   era anual e era comparado com a receita mensal. Erro de fator 12.
2. **Taxa de retenção e conversão fixadas em zero** no código, saindo como "0,0%"
   no relatório entregue.
3. **Margem de contribuição saía R$ 0,00** no DRE — o campo era declarado no tipo
   e nunca devolvido, e `formatCurrency(undefined)` devolve zero.
4. **Metas e Plano de Ação saíam vazios** no relatório — liam `planData.goals2026`
   e `planData.actionPlanItems`, que não existem.
5. **Pré-preenchimento de drivers inventava 5% de conversão** e derivava os leads
   desse chute: número 20× inventado com cara de "veio de 2025".

**Por que sobreviveram tanto:** `npm run build` era só `vite build`, sem checar
tipo. Eram 27 erros de TypeScript e o build passava por todos. Os defeitos 3 e 4
estavam apontados pelo compilador o tempo todo. Hoje o build roda
`tsc --noEmit && vite build` e os 27 estão zerados.

---

## 3. O portão de liberação (PR #3) — como funciona

Antes, **qualquer pessoa da internet** se cadastrava e usava o sistema inteiro:
o cadastro chamava `createUserWithEmailAndPassword` sem trava, e a verificação
de acesso era `setSubscriptionStatus('active')` fixo.

Agora:

- Quem se cadastra entra como `pendente` e vê a tela "Seu cadastro foi recebido"
- O administrador libera na aba **Gestão de Acessos**
- Só então o espaço de dados daquela pessoa passa a existir

**Quem barra é o banco, não a tela.** O código do navegador pode ser burlado por
qualquer um com o console aberto; a regra do Firestore, não.

**Administrador se cadastra à mão** (coleção `admins`, e-mail como ID do
documento). Se o app pudesse criar administradores, quem entrasse se promoveria
sozinho.

**Defeito que apareceu e já foi corrigido:** a primeira versão da regra exigia
estar na fila como liberado — mas administrador não entra na fila, e ficou sem
poder salvar o próprio plano. A regra agora aceita `liberado OU admin`, mantendo
`request.auth.uid == uid`.

---

## 4. A migração para o Supabase — EM ANDAMENTO

### Por que

Não é economizar uma conta. É que **o caderno promete benchmarks por setor**
("o cliente número 100 recebe uma comparação que o cliente número 1 não teve").
No Firestore isso é inviável: cada empresa é um JSON solto. No Postgres é uma
consulta. E a importação do diagnóstico deixa de ser chamada HTTP e vira junção
entre tabelas.

### O que foi decidido

- **Migração completa** (dados + login), não híbrida. O caminho híbrido deixaria
  uma amarra permanente no Firebase.
- **Vai para o Supabase do FluxoGI**, onde o diagnóstico já mora. Banco separado
  não dá benchmark nenhum — o ganho depende de estarem no mesmo lugar. E banco
  que ninguém abre o Supabase apaga (dois projetos da GI morreram assim).
- **As senhas não vão junto** — o Firebase guarda num formato que o Supabase não
  lê. São ~40 pessoas para redefinir. Decisão consciente do Leonardo.

### A garantia sobre os dados

**Nada é apagado do Firebase em momento nenhum.** Só leitura. O Firebase fica de
pé, inteiro, depois da migração — é a rede de segurança. Se algo der errado, a
volta é apontar o app de novo para ele.

Os dados são amarrados **pelo e-mail**, não pelo id interno, para que cada pessoa
reencontre o plano dela independentemente de como entrar.

### Onde parou

| Passo | Estado |
|---|---|
| 1. Estrutura no Supabase (`supabase/001_plan_no_supabase.sql`) | **escrito, esperando ser rodado** |
| 2. Exportar do Firestore e importar | bloqueado, faltam as chaves |
| 3. Conferir e mostrar a conferência | — |
| 4. Trocar o código, num PR | — |
| 5. Virar (só com aprovação) | — |

**Bloqueado em duas chaves**, as duas do próprio Leonardo:

1. `SUPABASE_SERVICE_ROLE` do projeto do FluxoGI → em `.env.local`
2. Chave de conta de serviço do Firebase → arquivo `chave-firebase.json` na raiz

Os dois já estão no `.gitignore`. **Quando a migração terminar, revogar a chave
do Firebase** no mesmo lugar onde foi gerada.

### Janela de virada

O que for escrito **depois do export e antes da virada** não vai junto. Fazer o
export final na hora da virada, em horário morto. Falta combinar o horário.

---

## 5. Armadilhas que custaram tempo — não repetir

**O domínio da Vercel estava fixado num deploy antigo.** `plan2026.gestaoimpacto.com`
apontava para um deploy de 165 dias atrás, sem acompanhar a produção. Nenhum
"Redeploy" mudava nada no ar. Resolve-se com `vercel promote`, não com
`vercel alias set` (que dá "You don't have access to the domain"). **Se o site
voltar a congelar, conferir `vercel alias ls` antes de suspeitar do build.**

**São dois times na Vercel.** O projeto é `app-orcamento-gi` no time de slug
`gestaoimpacto` (nome "GI") — diferente de "Gestao de Impacto's projects". Por
isso o projeto some quando se procura pelo caminho errado.

**A ligação GitHub → Vercel está quebrada.** Push no `main` não publica sozinho.
Provavelmente ficou apontando para o nome antigo do repositório
(`app-orcamento-gi` → renomeado para `plan26`). Enquanto não se conserta, publica-se
pela CLI.

**Duas contas diferentes, não confundir:**
- Firebase / Vercel (console e CLI): `leonardollo@hotmail.com`
- Login no PLAN 2026: `leonardo@gestaoimpacto.com` ← é este que vai em `admins`

**Indicador zerado é pior que indicador ausente.** O padrão do projeto agora é
`temBaseConversao` / `temBaseRetencao` e o texto "não medido". Antes de exibir
qualquer indicador, conferir se existe base para a conta.

**Aplicar patch com `{...prev, ...patch}` apaga bloco aninhado inteiro** — o Blue
Ocean e o Bowman somem junto com `marketAnalysis`. Por isso `aplicarImportacaoDpe`
junta bloco por bloco.

**`.env` no histórico do Git: assunto encerrado, não reabrir.** Foi conferido
linha a linha: só as 6 chaves de config do Firebase (públicas por natureza, já
servidas no bundle a qualquer visitante) e o `VITE_API_KEY` do Gemini **vazio**.
Não há segredo. Decidiu-se **não** reescrever o histórico: quebraria todo clone
e trocaria o SHA de todos os commits sem ganho nenhum.

---

## 6. Como publicar

**PLAN 2026** (a CLI está instalada fora do repositório, em `scratchpad/cli`):

```bash
vercel deploy --prod --scope gestaoimpacto --yes
vercel promote <url-do-deploy> --scope gestaoimpacto   # ← sem isto o domínio não muda
```

**Regras do Firestore:**

```bash
firebase deploy --only firestore:rules --project plan-ea4cc
```

**Diagnóstico (DPE-GI):**

```bash
cd ~/Documents/PROJETOS/PLANEJAMENTO-ESTRATEGICO
DEPLOY_TOKEN='...' node deploy.mjs
```

---

## 7. O que falta

### Nunca testado — o mais importante

**O portão de liberação com alguém real se cadastrando.** Eu não crio contas, então
esse caminho ficou por testar. Em janela anônima: cadastrar um e-mail, conferir
que para na tela de espera, que aparece na aba Gestão de Acessos, e que entra
depois de liberado.

### Aberto

- **PR #4** — o aviso de "não salvou" explicando o motivo
- **A migração para o Supabase** — bloqueada nas duas chaves

### Na fila, não começado

- **A lista do `ANALYSIS.md`** — tirar o Editor de Imagens, melhorar Metas
  Comerciais e Precificação, módulos de C-Suite (valuation, ROI/payback)
- **O PDF entregável do diagnóstico** — o caderno promete capa, sumário executivo
  e um A3 por frente. Hoje só sai a impressão do navegador, que não é produto que
  se venda. É o que falta para a coleta virar entregável.
- **O deck de 12 slides** e o **rito de revisão trimestral (D90)**
- **Consertar a ligação GitHub → Vercel**

### Dívida conhecida

- O `checkSubscription` foi reaproveitado para o controle de acesso, mas os nomes
  ainda falam de "assinatura" (`SubscriptionStatus`, `SubscriptionExpiredPage`).
  Funciona, mas confunde quem lê.
