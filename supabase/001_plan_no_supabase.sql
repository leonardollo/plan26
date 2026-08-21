-- ============================================================
--  PLAN 2026 no Supabase
--  Cole no SQL Editor do Supabase do FluxoGI e rode.
--  Pode rodar mais de uma vez sem problema (é idempotente).
--
--  Isto NÃO mexe em nada do FluxoGI nem do diagnóstico: tudo aqui
--  começa com `plan_`.
--
--  Tradução das regras do Firestore, que continuam valendo a mesma
--  ideia: quem se cadastra fica pendente e não alcança dado nenhum;
--  um administrador libera; ninguém enxerga o espaço de outro.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Quem administra
--    Pelo e-mail e não pelo id: dá para cadastrar alguém antes
--    dessa pessoa ter conta.
-- ------------------------------------------------------------
create table if not exists plan_admins (
  email     text primary key,
  nome      text,
  criado_em timestamptz not null default now()
);

insert into plan_admins (email, nome)
values ('leonardo@gestaoimpacto.com', 'Leonardo')
on conflict (email) do nothing;

-- ------------------------------------------------------------
-- 2) A fila de liberação
-- ------------------------------------------------------------
create table if not exists plan_acessos (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  nome         text,
  status       text not null default 'pendente'
               check (status in ('pendente', 'liberado', 'bloqueado')),
  criado_em    timestamptz not null default now(),
  liberado_em  timestamptz,
  liberado_por text
);

create index if not exists plan_acessos_status_idx on plan_acessos (status, criado_em desc);

-- ------------------------------------------------------------
-- 3) O plano de cada pessoa
--    Um registro por usuário. O conteúdo é o mesmo JSON que hoje
--    mora no Firestore — planData, goals2026, scenarios2026,
--    tracking2026, taxes e pricingItems, todos dentro de `dados`.
--
--    Guardar como jsonb e não em vinte tabelas é escolha: o app já
--    trabalha com esse objeto inteiro, e quebrar agora seria migração
--    dentro de migração. O que interessa para benchmark sai por
--    consulta no jsonb, sem precisar remodelar nada.
-- ------------------------------------------------------------
create table if not exists plan_planos (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  dados         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

create index if not exists plan_planos_email_idx on plan_planos (lower(email));

-- setor e empresa saem do JSON para consulta rápida de benchmark
create index if not exists plan_planos_setor_idx
  on plan_planos ((dados -> 'planData' -> 'companyProfile' ->> 'industry'));

-- ------------------------------------------------------------
-- 4) Quem sou eu
-- ------------------------------------------------------------
create or replace function plan_sou_admin() returns boolean as $$
  select exists (
    select 1 from plan_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$ language sql stable security definer set search_path = public;

create or replace function plan_meu_acesso_liberado() returns boolean as $$
  select exists (
    select 1 from plan_acessos
    where user_id = auth.uid() and status = 'liberado'
  );
$$ language sql stable security definer set search_path = public;

-- Administrador não entra na fila — é quem libera os outros. Sem este
-- "ou", quem administra ficaria sem poder salvar o próprio planejamento.
-- Foi exatamente esse o defeito que apareceu no Firestore.
create or replace function plan_posso_usar_o_espaco() returns boolean as $$
  select plan_meu_acesso_liberado() or plan_sou_admin();
$$ language sql stable security definer set search_path = public;

-- ------------------------------------------------------------
-- 5) Regras de acesso
-- ------------------------------------------------------------
alter table plan_admins  enable row level security;
alter table plan_acessos enable row level security;
alter table plan_planos  enable row level security;

-- ADMINS: qualquer pessoa logada precisa ler para saber se é admin.
-- Ninguém escreve pelo app — administrador se cadastra por aqui, no
-- SQL. É isso que impede alguém se promover sozinho.
drop policy if exists plan_admins_ler on plan_admins;
create policy plan_admins_ler on plan_admins
  for select to authenticated using (true);

-- ACESSOS
drop policy if exists plan_acessos_ler on plan_acessos;
create policy plan_acessos_ler on plan_acessos
  for select to authenticated
  using (user_id = auth.uid() or plan_sou_admin());

-- a pessoa cria o próprio pedido, e SÓ como pendente
drop policy if exists plan_acessos_criar on plan_acessos;
create policy plan_acessos_criar on plan_acessos
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pendente');

-- mudar status é só do administrador
drop policy if exists plan_acessos_mudar on plan_acessos;
create policy plan_acessos_mudar on plan_acessos
  for update to authenticated
  using (plan_sou_admin())
  with check (plan_sou_admin());

-- PLANOS: o próprio espaço, e só com o acesso em dia
drop policy if exists plan_planos_ler on plan_planos;
create policy plan_planos_ler on plan_planos
  for select to authenticated
  using (user_id = auth.uid() and plan_posso_usar_o_espaco());

drop policy if exists plan_planos_criar on plan_planos;
create policy plan_planos_criar on plan_planos
  for insert to authenticated
  with check (user_id = auth.uid() and plan_posso_usar_o_espaco());

drop policy if exists plan_planos_mudar on plan_planos;
create policy plan_planos_mudar on plan_planos
  for update to authenticated
  using (user_id = auth.uid() and plan_posso_usar_o_espaco())
  with check (user_id = auth.uid() and plan_posso_usar_o_espaco());

-- Não existe policy de DELETE em tabela nenhuma: sem policy, a
-- operação simplesmente não acontece. Plano de cliente não se apaga
-- pelo app.

-- ------------------------------------------------------------
-- 6) Quem chega novo entra na fila sozinho
--    Sem isto, a pessoa se cadastra e fica num limbo sem registro.
-- ------------------------------------------------------------
create or replace function plan_ao_criar_usuario() returns trigger as $$
begin
  insert into plan_acessos (user_id, email, nome, status)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''),
    -- quem já estava no Firebase é importado como liberado; quem chega
    -- depois espera. A migração marca os 40 antes de o gatilho valer.
    'pendente'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists plan_novo_usuario on auth.users;
create trigger plan_novo_usuario
  after insert on auth.users
  for each row execute function plan_ao_criar_usuario();

-- ------------------------------------------------------------
-- 7) Confirmação
-- ------------------------------------------------------------
do $$
begin
  raise notice 'PLAN 2026: tabelas, regras e gatilho criados. Nada do FluxoGI foi tocado.';
end $$;
