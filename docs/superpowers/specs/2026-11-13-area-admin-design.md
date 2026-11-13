# Área de administração do PLAN

**Data:** 2026-11-13 · **Nível:** Estrutural + Sensível (permissões, RLS, contas de clientes, plano de terceiros) · **Branch:** `feat/area-admin`

## Objetivo

Dar ao administrador do GI uma tela para gerenciar tudo no PLAN, sem pedir nada a um desenvolvedor:
adicionar clientes, remover e reativar, liberar e bloquear, reenviar o e-mail de senha, abrir e editar o plano de
qualquer cliente, e gerenciar os administradores. Hoje a tela "Gestão de Acessos" só lista, libera e bloqueia.

**Sucesso:**
- o admin adiciona um cliente pelo e-mail e o cliente recebe o "Defina sua senha" e entra já liberado;
- o admin remove um cliente sem perder o plano, e o reativa com o plano intacto;
- o admin abre o plano de um cliente, edita, e o cliente vê a edição;
- toda ação de admin fica no Registro (quem, o quê, qual cliente, quando);
- o cliente continua lendo e gravando só o próprio plano, e cada regra nova tem um teste.

## Decisões tomadas (com o usuário, 2026-11-13)

- **Escopo:** adicionar cliente, remover cliente, ver e editar o plano, gerenciar administradores.
- **Plano do cliente:** o admin vê e edita. Isso substitui a regra do commit `4399e2c` do Leonardo ("ser
  administrador dá acesso ao PRÓPRIO espaço, nunca ao dos outros"). **O Leonardo precisa ser avisado.**
- **Remover:** desativa e guarda. Nada é apagado: a conta e o plano ficam, e o cliente pode ser reativado.
- **Admins:** todos iguais. Qualquer admin promove e rebaixa outro.
- **Abordagem:** funções no banco (security definer) para tudo que só mexe em tabelas, e uma Edge Function do
  Supabase (`admin-usuarios`) só para o que precisa da chave secreta (criar conta e mandar o e-mail de senha).
  Descartadas: chave secreta no navegador (proibida, `src/seguranca.test.ts`) e função na Vercel (segundo lugar com
  a chave secreta, sem ganho).

## 1. Tela

A tela "Administração" substitui "Gestão de Acessos" (`src/components/GestaoDeAcessos.tsx`, rota `'gestao-acessos'`
em `src/App.tsx`), com três abas.

**Clientes**
- Busca por nome ou e-mail; filtros Pendentes, Liberados, Bloqueados, Removidos.
- "Adicionar cliente": e-mail e nome. O cliente é criado liberado e recebe o "Defina sua senha".
- Ações por cliente, conforme o status: liberar, bloquear, remover, reativar, reenviar e-mail de senha, abrir plano,
  tornar admin.
- Remover pede confirmação. Não aparece para si mesmo nem para um admin (rebaixe antes).

**Administradores**
- Lista dos admins; "Adicionar admin" por e-mail de um cliente que já tem conta; "Rebaixar".
- Rebaixar não aparece para si mesmo.

**Registro**
- As últimas 200 ações, mais novas primeiro, com filtro por cliente: quando, admin, ação, cliente, detalhe.

**Abrir o plano de um cliente**
- O app abre o plano do cliente como se fosse o dele, com uma faixa fixa no topo:
  "Você está no plano de Fulano (e-mail) — Voltar à Administração".
- Se o cliente gravou o plano nos últimos 30 minutos, a faixa avisa: "Fulano editou há X min".
- As edições gravam sozinhas, como no plano do próprio admin. Se o cliente e o admin editarem ao mesmo tempo, vale a
  última gravação (a faixa avisa).
- O navegador do admin não guarda cópia do plano do cliente (sem o cache local `chaveLocalDoPlano`); ao voltar, nada
  do cliente fica no `localStorage`.
- Abrir o plano de um ano que o cliente ainda não tem mostra o plano vazio; ele só é gravado quando o admin editar.

**Cliente removido**
- Ao entrar, vê "Sua conta foi desativada" (mesmo componente de `AguardandoLiberacao`, variante própria), com o
  botão Sair. Não lê nem grava o plano.

## 2. Banco e segurança

**Princípio:** as políticas RLS de `planos` não mudam; cada cliente segue lendo e gravando só o próprio plano. Todo
poder novo do admin passa por funções `security definer` que, antes de agir, conferem `sou_admin()` (admin com
e-mail confirmado) e gravam no Registro. Nenhuma tela escreve direto em `registro_admin`, `admins` ou no plano de
outra pessoa.

**Migração nova** em `supabase/migrations/`:
- `acessos.status` aceita `removido`. `posso_usar_o_espaco()` já só deixa passar liberado ou admin, então o removido
  fica barrado sem mudança nela.
- Tabela `registro_admin(id, quando timestamptz default now(), admin_email text, acao text, alvo uuid null,
  alvo_email text null, detalhe jsonb)`. RLS: select só para `sou_admin()`; sem insert, update ou delete para
  `anon` e `authenticated`. Só as funções gravam.
- `definir_status_de_acesso(alvo, novo_status)`: passa a aceitar `removido` e a gravar no Registro. Recusa: mexer em
  si mesmo; bloquear ou remover um admin; status fora da lista.
- `listar_admins()`, `promover_admin(email)`, `rebaixar_admin(email)`.
  - Promover recusa e-mail sem conta ("adicione como cliente antes") e cliente removido; quem já é admin não muda.
  - Rebaixar recusa a si mesmo e o último admin, e trava a tabela `admins` antes de contar, para dois admins
    rebaixando um ao outro ao mesmo tempo nunca deixarem zero.
- `anos_do_cliente(alvo)`, `plano_do_cliente(alvo, ano)`: leem e registram "abriu plano" (uma linha por abertura).
- `salvar_plano_do_cliente(alvo, ano, dados)`: mesmos limites do cliente (ano de 2026 até o ano UTC atual + 1, até
  1 MB) e mesmas mensagens; registra "alterou plano" agrupado: uma linha por admin, cliente e ano a cada 30 minutos
  (contados da última linha desse grupo).
- O admin não usa esses caminhos para o próprio plano: alvo igual a si mesmo é recusado.

**Edge Function `admin-usuarios`** (`supabase/functions/admin-usuarios/`)
- Exige login (JWT) e confere `sou_admin()` com o token de quem chamou antes de qualquer coisa: sem login, 401;
  não admin ou admin de e-mail não confirmado, 403; ação desconhecida, 400.
- `criar {email, nome}`: e-mail aparado e em minúsculas, formato válido; nome de 1 a 120 caracteres. Cria a conta já
  confirmada, marca liberada, registra "adicionou cliente" e manda o "Defina sua senha".
  - E-mail já existente: responde "já existe" com o status (ou "administrador") e não muda nada.
  - Conta criada e e-mail falhou: responde "conta criada, e-mail não saiu: use Reenviar" e registra a falha.
- `reenviar {alvo}`: manda de novo o e-mail de senha e registra.
- O endereço de retorno do link é fixo no código (`https://planejamento.gestaoimpacto.com`); qualquer endereço vindo
  do pedido é ignorado.
- CORS só para as origens do app (o domínio de produção, as prévias `plan-*-gestao-de-impactos-projects.vercel.app` e
  `localhost:5173`).
- A chave secreta só existe no ambiente da função, fornecida pelo próprio Supabase; nenhum segredo novo é cadastrado
  e nada vai para `src/` (`src/seguranca.test.ts` continua valendo).
- A validação fica num módulo puro, sem dependência do Deno, testável com vitest.

## 3. Regras com exemplos (cada um vira teste)

*Adicionar cliente*
- `" Ana@X.com "` é gravado como `ana@x.com`.
- `ana@` ou vazio é recusado e nada é criado; nome vazio ou com mais de 120 caracteres também.
- E-mail existente pendente, liberado ou bloqueado: "já existe" com o status, nada muda. Removido: a tela oferece
  "Reativar". De admin: "já existe (administrador)".
- E-mail falhou depois de criar: a conta fica liberada, o Registro tem "adicionou" e "e-mail não saiu", e Reenviar
  manda o e-mail.
- O cliente adicionado entra depois pelo Google com o mesmo e-mail e cai na mesma conta, com o mesmo plano
  (teste no Supabase local).

*Status*
- Remover ou bloquear a si mesmo: recusado.
- Remover ou bloquear um admin: recusado com "rebaixe antes".
- Removido não lê nem grava o próprio plano e vê "conta desativada".
- Reativar devolve liberado, com o plano igual ao de antes.

*Admins*
- Promover e-mail sem conta: recusado. Promover removido: recusado. Promover admin: nada muda.
- Rebaixar a si mesmo: recusado; por isso o último admin nunca fica sem acesso.
- Dois admins se rebaixando ao mesmo tempo: um consegue, o outro é recusado.

*Plano de cliente*
- Ano 2025 ou 9999: recusado. Mais de 1 MB: recusado.
- Plano de cliente pendente, bloqueado ou removido: o admin abre e edita.
- Três gravações em 10 minutos: uma linha "alterou plano". Uma gravação 31 minutos depois da linha: a segunda.
- Depois de voltar à Administração, nenhuma chave do cliente fica no `localStorage`.

*Permissões*
- Não admin chamando cada função nova: erro de permissão (42501).
- Ninguém altera ou apaga `registro_admin`, nem um admin; o cliente lê zero linhas.
- Pedido à Edge Function com outro `redirectTo`: o e-mail sai com o endereço fixo.

## 4. Testes

- Banco, RLS e funções: `tests/db/` (`npm run test:db`, Supabase local).
- Edge Function: módulo de validação com vitest; fluxo inteiro contra o Supabase local (`supabase functions serve`),
  com o e-mail conferido no Mailpit (`http://127.0.0.1:54324`).
- Tela e serviços: vitest (abas, confirmações, faixa do plano, `telaDoApp` com `removido`, sem cache do cliente).
- Como usuário: celular (390 px) e desktop com o login falso local (`npm run db:local:semear`, `npm run dev:local`),
  pelo agent-browser.

## 5. Condições de parada

O implementador para e reporta, sem contornar, se:
- algum fluxo atual (o cliente salvar o plano, o login, a liberação) precisar de mudança nas políticas de `planos`;
- o Supabase local não rodar a Edge Function (nunca testar em produção);
- o login pelo Google não cair na conta criada pelo admin;
- algo exigir a chave secreta em `src/` ou no navegador;
- algum passo pedir um comando contra produção.

## 6. Passos humanos (com o "sim" do usuário na hora)

1. Merge em `main`.
2. `supabase db push` no PLAN26 (a migração).
3. `supabase functions deploy admin-usuarios` no PLAN26.
4. Deploy do app na Vercel (projeto `plan`), a partir de `main`.

A ordem importa: a migração e a função antes do app, porque a tela nova chama as duas.

## Fora do escopo

- Apagar contas ou planos de verdade.
- Papéis diferentes entre admins.
- Edição simultânea com aviso em tempo real ou mesclagem.
- Exportar o Registro.
