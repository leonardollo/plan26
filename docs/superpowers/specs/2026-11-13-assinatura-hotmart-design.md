# Assinatura anual pela Hotmart — desenho

Data: 2026-11-13 · Nível: Estrutural + Sensível (pagamento, acesso, nova Edge Function, migração)
Desenho aprovado pela dona do produto em conversa ("esta certo").

## Objetivo

Quem ainda não é cliente compra o PLAN sozinho: vê o plano na tela de acesso, paga na Hotmart e
ganha acesso automático por um ano, sem esperar um admin. Há um único plano, anual e recorrente.
O produto, o preço e o link da Hotmart ainda não existem: o app fica pronto e funciona sem eles
(mostra "Assinaturas abrem em breve").

**Sucesso:** um comprador novo paga, recebe o e-mail "Defina sua senha", entra e usa o app; um ano
depois, se a renovação não for paga, o acesso vence sozinho; os 45 clientes atuais e os admins não
percebem diferença.

## O que a dona do produto decidiu

- Os clientes já liberados seguem **sem prazo**.
- Compra com e-mail sem conta: **a conta é criada sozinha**, já liberada, com o e-mail "Defina sua senha".
- Assinatura **recorrente anual** na Hotmart.

## Arquitetura

Abordagem A: a Hotmart avisa uma Edge Function do Supabase PLAN26, `hotmart-webhook`, que grava o
pagamento e ajusta o prazo de acesso. O app só lê o prazo.

```
Hotmart ──POST (x-hotmart-hottok)──▶ hotmart-webhook (Edge Function, verify_jwt = false)
                                       │ 1. confere hottok e produto
                                       │ 2. cria a conta, se o e-mail não tem (Auth admin)
                                       │ 3. rpc aplicar_pagamento_hotmart(...)  ← regra toda no banco, numa transação
                                       │ 4. manda "Defina sua senha", se criou a conta
                                       ▼
                         acessos.acesso_ate · pagamentos_hotmart · registro_admin
```

A regra de prazo mora numa função SQL, não na Edge Function: a trava da linha e a chave única da
transação no mesmo `begin…commit` impedem que dois avisos simultâneos contem duas vezes.

## Dados (migração nova)

- `acessos.acesso_ate timestamptz null`.
  - `null` = sem prazo: os 45 atuais, os admins, quem o admin libera à mão.
  - Data = o acesso vale até ela (exclusive).
- `posso_usar_o_espaco()` passa a exigir `status = 'liberado' and (acesso_ate is null or acesso_ate > now())`,
  ou ser admin. Sem tarefa agendada: o vencimento acontece pela própria data.
- Tabela `pagamentos_hotmart`, só o mínimo, sem CPF, telefone nem endereço:
  - `transacao text primary key`, `email text`, `situacao text` (`aprovada` | `estornada` | `ignorada`),
    `evento text` (o último aplicado), `user_id uuid null`, `mexeu_no_prazo boolean` (só assim o estorno
    desfaz), `recebido_em timestamptz`, `alterado_em timestamptz`.
  - RLS ligada e nenhuma política: só a service role lê e escreve. O admin vê os pagamentos pelo Registro.
- `aplicar_pagamento_hotmart(transacao, email, tipo, evento)`: `security definer`, `execute` só para
  `service_role`. `tipo` é `aprova` ou `estorna`. Devolve o que fez (para o log da função e os testes).
- `admin_definir_prazo(alvo uuid, sem_prazo boolean)`: só admin; hoje só serve para "Liberar sem prazo"
  (põe `acesso_ate = null`). Vai ao Registro.

## Regras do aviso da Hotmart

Leitura do aviso (formato v2, conferido no webhook do projeto fluxo de caixa):
- evento: `event`; transação: `data.purchase.transaction`; status: `data.purchase.status`;
- e-mail: `data.buyer.email` (senão `data.subscriber.email`), com `trim` e minúsculas;
- produto: `data.product.id` (senão `data.purchase.product.id`, `data.subscription.product.id`).

Ordem das conferências:
1. Sem o segredo `HOTMART_HOTTOK` configurado: **500 e nada é gravado** (falha fechada; um webhook
   de outro projeto já aceitou tudo quando o segredo faltou).
2. Header `x-hotmart-hottok` diferente do segredo (comparação de tempo constante): **401**.
3. Corpo que não é JSON: 400.
4. Sem `HOTMART_PRODUTO_ID`, ou produto diferente dele: **200 e ignora** (a Hotmart não fica reenviando).
5. Sem transação ou sem e-mail válido: 200 e ignora, com log.

Eventos:

| Evento | Tipo |
|---|---|
| `PURCHASE_APPROVED`, `PURCHASE_COMPLETE`, com status `APPROVED`/`COMPLETE`/`COMPLETED` | aprova |
| `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK` | estorna |
| todos os outros (`PURCHASE_CANCELED`, `PURCHASE_DELAYED`, `PURCHASE_PROTEST`, `SUBSCRIPTION_CANCELLATION`, `UPDATE_SUBSCRIPTION_CHARGE_DATE`, boleto impresso…) | nada muda; 200 |

Cada cobrança da assinatura (a primeira e cada renovação) chega com uma transação própria.

**aprova** (transação ainda não aprovada nem estornada):
- Conta não existe → a Edge Function cria (confirmada) antes do RPC; o RPC deixa `liberado`,
  `liberado_por = 'hotmart'`, `acesso_ate = now() + 1 ano`; depois sai o "Defina sua senha".
- `pendente` → `liberado`, `liberado_por = 'hotmart'`, `acesso_ate = now() + 1 ano`.
- `liberado` com data → `acesso_ate = greatest(now(), acesso_ate) + 1 ano`.
- `liberado` sem prazo → continua sem prazo; o pagamento é gravado.
- `bloqueado` ou `removido` → **nada muda**; o pagamento é gravado como `aprovada` e vai ao Registro
  ("pagamento de conta bloqueada/removida") para o admin decidir.
- Transação já `aprovada` → nada (é o `PURCHASE_COMPLETE` depois do `APPROVED`, ou reenvio).
- Transação já `estornada` → nada (o estorno chegou antes).

**estorna** (transação `aprovada`):
- Com `mexeu_no_prazo` → `acesso_ate = acesso_ate - 1 ano`; se cair no passado, o acesso vence na hora.
- Sem `mexeu_no_prazo` (conta sem prazo, bloqueada ou removida na aprovação) → só marca `estornada`.
- Conta sem prazo (o admin tirou o prazo depois) → continua sem prazo.
- Transação desconhecida → grava como `estornada`, sem mexer em nada; uma aprovação posterior da
  mesma transação não conta.
- Transação já `estornada` → nada.

Toda mudança de prazo vai ao Registro, com `admin_email = 'hotmart'`, a transação e o prazo antes e depois.

### Exemplos (viram testes)

Hoje = 2027-03-10.
1. E-mail novo `Ana@X.com ` paga → conta `ana@x.com` criada, liberada até 2028-03-10, e-mail de senha enviado uma vez.
2. O mesmo aviso chega duas vezes → o segundo não muda nada e não manda outro e-mail.
3. `PURCHASE_APPROVED` e depois `PURCHASE_COMPLETE` da mesma transação → um ano só.
4. Cliente com prazo até 2027-05-01 renova em 2027-04-20 → prazo vai a 2028-05-01 (não perde os dias).
5. Cliente com prazo vencido em 2027-01-01 paga hoje → prazo vai a 2028-03-10.
6. Estorno da renovação do exemplo 4 → prazo volta a 2027-05-01.
7. Estorno da primeira compra em 2027-03-20 → prazo 2027-03-10 já passou → acesso vence na hora.
8. Cliente antigo sem prazo compra → continua sem prazo; pagamento gravado.
9. Conta bloqueada paga → continua bloqueada; Registro mostra o pagamento.
10. Aviso de outro produto → 200, nada gravado.
11. Sem hottok, hottok errado ou segredo ausente → 401/401/500, nada gravado.
12. Estorno que chega antes da aprovação → nada muda; a aprovação depois também não conta.
13. Dois avisos de transações diferentes para o mesmo e-mail novo ao mesmo tempo → uma conta, dois anos.
14. `PURCHASE_CANCELED` de boleto não pago e `SUBSCRIPTION_CANCELLATION` → nada muda.

## Telas

Configuração por variáveis públicas da Vercel: `VITE_HOTMART_CHECKOUT_URL` e `VITE_PRECO_ANUAL`
(texto, ex.: `R$ 497`). Uma função lê as duas e devolve `null` se o link faltar ou não for `https://`
de `pay.hotmart.com`; com `null`, o cartão mostra "Assinaturas abrem em breve" e esconde o botão.

- **Login:** cartão "Plano anual — R$ X/ano", uma linha do que inclui, botão "Assinar" que abre o
  checkout em nova aba. Quem já é cliente segue entrando como hoje.
- **Conta pendente** (`AguardandoLiberacao`): o cartão com o checkout já com o e-mail da conta
  (`?email=`), o aviso "Pague com este mesmo e-mail; o acesso libera em poucos minutos" e o botão
  "Já paguei, verificar" que relê o acesso. O texto atual de espera continua para quem prefere
  aguardar um admin.
- **Acesso vencido:** `situacaoDoAcesso` recebe o prazo; `liberado` com `acesso_ate <= agora` vira
  `'expired'` → `SubscriptionExpiredPage` com o link verdadeiro (sem link: "Fale com a Gestão de Impacto").
  Admin nunca vê essa tela.
- **Administração, aba Clientes:** coluna "Acesso até" ("Sem prazo", a data, ou "Vencido em …").
  Para conta com prazo, a ação "Liberar sem prazo".

## Fora do escopo

E-mail de aviso antes de vencer · cupons · mais de um plano · mostrar pagamentos numa tela própria ·
nota fiscal.

## Testes

- Unidade (Vitest): leitura do aviso (campos, e-mail, produto, tipo), conferência do hottok, a função
  de configuração do checkout, `situacaoDoAcesso` com prazo, as telas (cartão com e sem link).
- Banco (`test:db`): `aplicar_pagamento_hotmart` com os exemplos 1–9, 12 e 13; `posso_usar_o_espaco`
  e as políticas de `planos` com prazo vencido; `pagamentos_hotmart` fechada para `authenticated`
  e `anon`; `aplicar_pagamento_hotmart` negado para `authenticated`.
- Função servida localmente na CI, como a `admin-usuarios`: exemplos 10, 11 e o fluxo de conta nova.
- No navegador: Login, conta pendente e acesso vencido, no celular e no desktop.

## Passos humanos (depois do merge)

1. `supabase db push` (migração nova) e `supabase functions deploy hotmart-webhook` no PLAN26.
2. Criar o produto de assinatura anual na Hotmart.
3. Segredos do Supabase: `HOTMART_HOTTOK` e `HOTMART_PRODUTO_ID`.
4. Na Hotmart, apontar o webhook (v2) para `https://aixjmxfkaziqlxnpudkk.supabase.co/functions/v1/hotmart-webhook`.
5. Variáveis da Vercel `VITE_HOTMART_CHECKOUT_URL` e `VITE_PRECO_ANUAL`, e novo deploy.
6. Uma compra de teste (ou o "enviar teste" da Hotmart) e conferir o Registro.

Até o passo 3, a função recusa tudo; até o passo 5, a tela mostra "Assinaturas abrem em breve".

## Riscos

- A Hotmart muda o formato do aviso → os campos são lidos em vários caminhos e o que não casa é
  ignorado com log, nunca libera.
- E-mail da compra diferente do da conta → vira outra conta; o aviso na tela pendente pede o mesmo e-mail,
  e o admin resolve pelo Registro.
- O cadastro aberto continua existindo: quem se cadastra e não paga fica `pendente`, como hoje.
