# Migração do Firebase para o Supabase e para a Vercel do GI

**Data:** 2026-11-12 · **Nível:** Estrutural + Sensível (login, permissões, dados de produção) · **Branch:** `feat/migracao-supabase`

## Objetivo

Tirar o PLAN do Firebase e da conta da Vercel do Leonardo, que não serão mais usados. Login e dados passam para o
projeto Supabase **PLAN26** (`aixjmxfkaziqlxnpudkk`, us-east-2, organização no plano Pro). O app passa a ser
hospedado no time da Vercel **"Gestao de Impacto's projects"** (`gestao-de-impactos-projects`), em
`plan.gestaoimpacto.com`, e o endereço antigo `plan2026.gestaoimpacto.com` redireciona para ele.

**Sucesso:**
- os ~40 clientes entram no app novo: quem usava Google entra com Google; quem usava senha cria uma senha nova
  pelo e-mail;
- cada cliente vê exatamente os planos que tinha, ano a ano, e o status de acesso que tinha;
- as permissões de hoje continuam valendo, cada uma com um teste;
- o Firebase não perde nada e serve de volta atrás durante a virada.

## Decisões tomadas (com o usuário, 2026-11-12)

| Tema | Escolha | Motivo |
|---|---|---|
| Projeto Supabase | PLAN26, próprio | Isola o PLAN do FluxoGI; muda o rascunho do Leo, que usava o FluxoGI para benchmarks com o DPE. |
| Senhas | Não migram; e-mail "crie sua senha" | O Supabase não importa os hashes scrypt do Firebase de forma confirmada. O Leo já tinha decidido o mesmo. |
| Google | Mantido | Os clientes que entram com Google seguem igual. |
| Formato dos dados | Uma linha por usuário e ano, plano em JSON | É o mesmo formato de hoje, sem reescrever cálculos. |
| Hospedagem | Time principal do GI na Vercel | A conta antiga não será mais usada. |
| Firebase no repositório | O SDK sai do app agora; `firestore.rules`, `firebase.json` e `.firebaserc` saem numa entrega posterior | O script de migração e o congelamento ainda precisam deles. |
| Endereço | `plan.gestaoimpacto.com` (sugestão aprovada) | Sem o ano, porque o app abre sempre o ano seguinte. |

## 1. Banco (PLAN26)

Estrutura versionada em `supabase/migrations/`, aplicada no PLAN26 com `supabase db push` (passo com o "sim" do usuário).

**Tabelas**
- `admins(email text primary key check (email = lower(email)))`. O cliente não lê a tabela; existe só a função `sou_admin()`.
- `acessos(user_id uuid primary key references auth.users on delete cascade, email text not null, nome text,
  status text not null default 'pendente' check (status in ('pendente','liberado','bloqueado')),
  criado_em timestamptz not null default now(), liberado_em timestamptz, liberado_por text)`.
- `planos(user_id uuid references auth.users on delete cascade, ano int not null, dados jsonb not null,
  atualizado_em timestamptz not null default now(), importado_em timestamptz, primary key (user_id, ano))`.
  Um gatilho atualiza `atualizado_em` a cada insert e update. `importado_em` só é preenchido pelo script de migração.

**Funções (security definer, `search_path` fixo)**
- `sou_admin() returns boolean`: o e-mail do token, em minúsculas, está em `admins` **e** o usuário tem
  `email_confirmed_at` preenchido.
- `posso_usar_o_espaco() returns boolean`: o acesso do usuário está `liberado`, ou `sou_admin()`.
- `definir_status_de_acesso(alvo uuid, novo_status text)`: só admin. Grava `status`, `liberado_em = now()` e
  `liberado_por` = e-mail do admin. Não altera outros campos.
- Gatilho `ao_criar_usuario` em `auth.users`: cria a linha em `acessos` com `status = 'pendente'`, o e-mail em
  minúsculas e o nome de `raw_user_meta_data` (`name` ou `full_name`).

**RLS (ligado nas três tabelas; o que não está listado é negado)**
- `admins`: nenhuma política.
- `acessos`: select da própria linha ou, para admin, de todas. Sem insert, sem update e sem delete pelo cliente: a
  linha nasce pelo gatilho e o status muda só pela função.
- `planos`:
  - select: a própria linha, quando `posso_usar_o_espaco()`;
  - insert e update: a própria linha, quando `posso_usar_o_espaco()` e `ano` entre 2026 e o ano atual (UTC) + 1;
  - sem delete.
- Ser admin dá acesso só ao **próprio** espaço, nunca aos planos dos outros (decisão do Leo no PR #4).

**Exemplos que viram testes (contra o Supabase local)**
- Cliente liberado lê e grava o próprio plano de 2027; o insert de 2028 em 2026 é recusado; o de 2025 é recusado.
- Cliente pendente ou bloqueado não lê nem grava nenhum plano, nem o próprio.
- Cliente A não lê nem grava o plano do cliente B, nem sabendo o `user_id`.
- Admin lê e grava o próprio plano mesmo sem acesso liberado; não lê o plano de um cliente.
- Admin com e-mail não confirmado: `sou_admin()` devolve falso.
- Cliente lê a própria linha de acesso e não a dos outros; admin lista todas.
- Cliente não muda o próprio status (nem por update, nem pela função); admin muda.
- Ninguém lê `admins` diretamente; ninguém apaga plano ou acesso pelo cliente.
- Cadastro novo gera acesso `pendente` com o e-mail em minúsculas, mesmo que o cadastro venha com outro status nos
  metadados.

**Painel do Supabase (passo do usuário, com os valores passados por mim)**
- Confirmação de e-mail ligada; SMTP próprio (sugestão: Resend, com o domínio verificado por DNS).
- Provedor Google com o cliente OAuth do Google Cloud; endereço de retorno
  `https://aixjmxfkaziqlxnpudkk.supabase.co/auth/v1/callback`.
- Site URL `https://plan.gestaoimpacto.com`; endereços permitidos: o novo, o antigo, as prévias da Vercel e
  `http://localhost:5173`.
- Textos dos e-mails em português. O de redefinição serve para "crie" e para "redefina" a senha.

## 2. App

**Princípio:** o resto do app não percebe a troca. `authService`, `planos.ts` e `acesso.ts` mantêm nomes e
formatos de retorno; muda só o que está por dentro.

- `src/services/supabase.ts` (novo): o cliente, com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Como hoje
  com o Firebase, a URL e a chave pública do PLAN26 ficam como valor padrão no código, porque são públicas e porque
  um build sem as variáveis não deve cair calado no modo local.
- **Usuário:** um adaptador converte o usuário do Supabase em `{ uid, email, displayName, emailVerified }`, o
  formato que as telas já usam.
- **`planos.ts`:**
  - `listarPlanos` consulta os anos em `planos`;
  - criar o ano seguinte vira um insert que não sobrescreve um plano existente, no lugar da transação;
  - `ANO_DO_PLANO_LEGADO` e `caminhoDoPlano` saem: 2026 é uma linha comum.
- **`acesso.ts`:** "sou admin?" chama `sou_admin()`; a fila de acessos é uma consulta ordenada por `criado_em`
  decrescente; liberar e bloquear chamam `definir_status_de_acesso`; o app não cria mais a linha de acesso.
- **`usePlanData.tsx`:** salvar grava `(user_id, ano, dados)`; carregar lê essa linha. O autosave e a proteção que
  impede gravar um plano vazio depois de uma carga que falhou continuam.
- **Login:**
  - e-mail e senha com `signInWithPassword`; cadastro com `signUp`, que exige confirmar o e-mail antes do primeiro
    acesso; a tela "confirme seu e-mail" ganha "reenviar";
  - Google por redirecionamento (`signInWithOAuth`), no lugar da janela pop-up;
  - "esqueci minha senha" com `resetPasswordForEmail`; o link abre a tela nova **"Defina sua senha"** (evento
    `PASSWORD_RECOVERY`, depois `updateUser({ password })`), com o mesmo mínimo de caracteres do cadastro;
  - todos os links de e-mail voltam para `window.location.origin` (o app não tem rotas).
- **Continua igual:** a chave do Gemini (do cadastro da empresa), o modo local, a regra do plano do ano seguinte,
  a importação do DPE (usa `fetch` próprio) e todos os cálculos.
- **Dependências:** entra `@supabase/supabase-js`; sai `firebase`. `firebase-tools` fica até a entrega de limpeza.

**Desenvolvimento e testes**
- Os emuladores do Firebase dão lugar ao Supabase local (`supabase start`, Docker). O semeador cria
  `cliente@exemplo.com` (liberado) e `admin@exemplo.com`, e `npm run dev:local` aponta para o Supabase local.
- `npm run test:rules` dá lugar a `npm run test:db`: os testes de permissão da seção 1 contra o Supabase local.
- O CI troca o Java e o emulador pelo CLI do Supabase.
- `AGENTS.md`: comandos novos; caminhos sensíveis ganham `supabase/**` e `scripts/migrar-*`; passos só humanos ganham
  `supabase db push` no PLAN26, rodar o script de migração na produção, enviar os e-mails, mexer no DNS e congelar
  o Firebase.

## 3. Migração dos dados

Script `scripts/migrar-firebase-para-supabase.mjs`, rodado no Mac do usuário. Ele **só lê** o Firebase
(`firebase-admin`, devDependency temporária) e escreve no Supabase.

**Credenciais:** no `.env.local`, colocadas pelo usuário e nunca lidas pelo agente:
- `GOOGLE_APPLICATION_CREDENTIALS`: chave de conta de serviço do Firebase, revogada depois da migração;
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do destino.

A chave `service_role` nunca tem prefixo `VITE_` e não é importada por nada em `src/`; um teste confere isso.

**Modos**
1. `--simular` (padrão): lê tudo e mostra contagens e casos estranhos; não grava nada.
2. `--aplicar` contra o Supabase local: ensaio com os dados reais.
3. `--aplicar` contra o PLAN26: importação final, na virada.

Rodar contra a produção do Firebase ou do PLAN26 exige o "sim" do usuário a cada vez.

**Como cada coisa é levada**
- **Usuário do Firebase Auth:** vira usuário do Supabase com o mesmo e-mail em minúsculas, confirmado, sem senha,
  com o nome em `user_metadata.name`.
- **Acesso:** o gatilho cria `pendente`; o script grava o status do Firebase (`liberado`, `bloqueado` ou `pendente`) e
  `liberado_em`/`liberado_por` quando existirem.
- **Planos:**
  - o documento `users/{uid}` vira `ano = 2026`;
  - `users/{uid}/planos/{ano}` vira o ano do documento;
  - os campos `planData`, `goals2026`, `scenarios2026`, `tracking2026`, `taxes` e `pricingItems` vão para `dados`;
  - o vínculo é Firebase uid → e-mail → id novo.
- **Admins:** copiados em minúsculas.
- **Google:** o Supabase liga a identidade Google ao usuário existente pelo e-mail confirmado no primeiro login.

**Casos estranhos (cada um vira teste da função de transformação, que é pura)**
- plano sem usuário no Auth: listado e não importado;
- usuário sem e-mail: listado e não importado;
- dois usuários com o mesmo e-mail a menos de maiúsculas: o script para antes de gravar qualquer coisa;
- admin sem conta: importado e marcado no relatório;
- acesso sem usuário: listado e não importado;
- `Timestamp` do Firestore dentro do plano: vira texto ISO; outro tipo que não seja JSON: listado e o script para;
- subcoleção desconhecida em `users/{uid}`: listada;
- ano fora de `^[0-9]{4}$`: listado e não importado.

**Repetir é seguro**
- usuário que já existe no Supabase com o mesmo e-mail: reaproveitado;
- plano: gravado com `importado_em = now()`; o script se recusa a sobrescrever uma linha com
  `atualizado_em > importado_em`, porque alguém já a editou no app novo.

**Conferência ao final:** contagens por tabela e comparação do JSON plano a plano (Firebase normalizado contra
Supabase). O relatório fica só no terminal; não vai para o log nem para o vault, porque tem e-mails de clientes.

**E-mails "crie sua senha":** `scripts/enviar-criar-senha.mjs`, só para quem tinha senha no Firebase (provedor
`password`), em lotes de 10 com pausa, pelo SMTP próprio. Tem simulação, que mostra só a contagem.

## 4. Hospedagem e virada

**Vercel:**
- projeto novo `plan` no time `gestao-de-impactos-projects`;
- variáveis: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, colocadas pelo agente; `VITE_API_KEY` (Gemini),
  colocada pelo usuário;
- deploy pelo CLI até o Leo autorizar o app da Vercel no repositório `leonardollo/plan26`.

**Domínio:**
- `plan.gestaoimpacto.com` no projeto novo, com um CNAME no provedor de DNS (`hanoon6070`);
- `plan2026.gestaoimpacto.com` passa para o projeto novo com a verificação TXT que a Vercel pede, e redireciona
  (308) para o novo.

**Ordem da virada**
1. **Antes, sem afetar ninguém:**
   - aplicar a estrutura no PLAN26;
   - configurar o painel do Supabase;
   - publicar uma prévia;
   - o usuário testa com uma conta nova: cadastro, confirmação, liberação pelo admin, Google, salvar, recarregar e
     "esqueci minha senha".
2. **Um dia antes:** aviso aos clientes (texto sugerido pelo agente, envio pelo GI).
3. **Num horário calmo:**
   1. Guardar uma cópia das regras do Firestore que estão no ar hoje (pela API de regras). Elas não são as do
      repositório, porque o Leo ainda não publicou as do PR #5.
   2. **Congelar o Firebase:** publicar `firestore.congelado.rules` (tudo só leitura), com
      `firebase.congelado.json`.
   3. Rodar a importação final no PLAN26 e a conferência.
   4. Ligar os dois endereços no projeto novo.
   5. Enviar os e-mails "crie sua senha".
   6. Teste final com o admin, um cliente com senha e um com Google.

**Volta atrás**
- até o passo 3.5: devolver o domínio ao projeto antigo (pelo Leo) e republicar a cópia das regras; nada se perde;
- depois que os clientes editam no app novo, voltar perde essas edições; a janela de volta é de algumas horas.

**Depois:**
- uma semana de observação;
- revogar a chave de conta de serviço do Firebase;
- entrega pequena que remove `firestore.rules`, `firebase.json`, `.firebaserc`, `firebase-tools`, `firebase-admin`
  e os scripts de migração;
- o Leo pausa (não apaga) o projeto antigo na Vercel. O Firebase não é apagado.

## Passos só humanos (cada um com "sim" na hora)

Aplicar a estrutura no PLAN26 · configurar o painel do Supabase, o SMTP e o OAuth do Google · colocar
`VITE_API_KEY` e as chaves do `.env.local` · rodar o script contra a produção · deploy de produção na Vercel ·
DNS · congelar e restaurar as regras do Firebase · enviar os e-mails aos clientes.

## Condições de parada

- Um fluxo legítimo depende de algo que o RLS desta especificação nega (por exemplo, um cliente pendente que
  precisa gravar): parar e relatar.
- A simulação mostra dados que o mapeamento não cobre (campo novo no documento, subcoleção com dados reais):
  parar e relatar.
- O Supabase não liga a identidade Google ao usuário existente: parar e relatar antes da virada.

## Fora do escopo

Mudar cálculos ou telas além do login; benchmarks com o DPE; apagar qualquer coisa do Firebase; automatizar a
liberação de quem compra.
