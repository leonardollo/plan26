-- ============================================================
--  PLAN — estrutura e permissões no Supabase
--
--  A ideia, a mesma das regras do Firestore: quem se cadastra fica PENDENTE e
--  não alcança dado nenhum. Um administrador libera. Só então a pessoa lê e
--  grava o próprio espaço, e nunca o dos outros.
--
--  Quem barra é o RLS daqui; a tela do app pode ser burlada.
--  O que não está liberado abaixo é negado.
-- ============================================================

-- ---------- tabelas ----------

-- Administrador é quem tem o e-mail aqui. Pelo e-mail e não pelo id: dá para
-- cadastrar alguém antes de a pessoa ter conta. Só se escreve pelo painel/serviço.
create table public.admins (
  email text primary key check (email = lower(email))
);

create table public.acessos (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nome text,
  status text not null default 'pendente' check (status in ('pendente', 'liberado', 'bloqueado')),
  -- Cópia de auth.users.email_confirmed_at, mantida por gatilho: o cliente não lê auth.users,
  -- e a Gestão de Acessos mostra a coluna "E-mail verificado".
  email_verificado boolean not null default false,
  criado_em timestamptz not null default now(),
  liberado_em timestamptz,
  liberado_por text
);

create index acessos_criado_em_idx on public.acessos (criado_em desc);

-- Um plano por pessoa e ano; o JSON é o mesmo formato que o app já usa.
create table public.planos (
  user_id uuid not null references auth.users (id) on delete cascade,
  ano int not null,
  -- Objeto de até 1 MiB: o mesmo limite por documento do Firestore, então nenhum plano legítimo passa dele;
  -- sem o limite, um cliente liberado podia encher o banco com um único plano.
  dados jsonb not null
    check (jsonb_typeof(dados) = 'object' and octet_length(dados::text) <= 1048576),
  atualizado_em timestamptz not null default now(),
  -- Só a importação do Firebase preenche. O script não sobrescreve uma linha com
  -- atualizado_em > importado_em: alguém já a editou no app novo.
  importado_em timestamptz,
  primary key (user_id, ano)
);

alter table public.admins enable row level security;
alter table public.acessos enable row level security;
alter table public.planos enable row level security;

-- ---------- funções de permissão ----------

-- E-mail confirmado é obrigatório: sem isso, quem criasse conta com o e-mail de
-- um admin que ainda não tem conta ganharia o poder.
create function public.sou_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins a
    join auth.users u on u.id = auth.uid()
    where a.email = lower(auth.jwt() ->> 'email')
      and u.email_confirmed_at is not null
  );
$$;

-- O admin não passa pela fila: sem o `or`, quem libera os outros não salvaria o
-- próprio plano. Dá acesso só ao PRÓPRIO espaço; as políticas conferem o dono.
create function public.posso_usar_o_espaco()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.acessos
    where user_id = auth.uid() and status = 'liberado'
  ) or public.sou_admin();
$$;

-- Mudar status é só do admin, e só por aqui: o cliente não tem update em acessos.
create function public.definir_status_de_acesso(alvo uuid, novo_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.sou_admin() then
    raise exception 'só um administrador muda o status de acesso' using errcode = '42501';
  end if;
  update public.acessos
     set status = novo_status,
         liberado_em = now(),
         liberado_por = lower(auth.jwt() ->> 'email')
   where user_id = alvo;
  if not found then
    raise exception 'acesso não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------- gatilhos ----------

-- A linha de acesso nasce aqui, sempre pendente: os metadados do cadastro vêm do
-- cliente e não decidem status.
create function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.acessos (user_id, email, nome, status, email_verificado)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    'pendente',
    new.email_confirmed_at is not null
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

create function public.ao_confirmar_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.acessos
     set email_verificado = new.email_confirmed_at is not null
   where user_id = new.id;
  return new;
end;
$$;

create trigger ao_confirmar_email
  after update of email_confirmed_at on auth.users
  for each row execute function public.ao_confirmar_email();

-- importado_em igual a atualizado_em marca "veio da importação e ninguém mexeu".
create function public.ao_gravar_plano()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' then
    if new.importado_em is not null then
      new.importado_em := now();
    end if;
  elsif new.importado_em is not null and new.importado_em is distinct from old.importado_em then
    new.importado_em := now();
  end if;
  return new;
end;
$$;

create trigger ao_gravar_plano
  before insert or update on public.planos
  for each row execute function public.ao_gravar_plano();

-- ---------- privilégios ----------

revoke all on public.admins, public.acessos, public.planos from anon, authenticated;
grant select on public.acessos to authenticated;
grant select on public.planos to authenticated;
-- Só as colunas do app: atualizado_em e importado_em são do gatilho e da importação.
grant insert (user_id, ano, dados), update (user_id, ano, dados) on public.planos to authenticated;

revoke execute on function public.sou_admin(), public.posso_usar_o_espaco(),
  public.definir_status_de_acesso(uuid, text), public.ao_criar_usuario(),
  public.ao_confirmar_email(), public.ao_gravar_plano()
  from public, anon, authenticated;
grant execute on function public.sou_admin(), public.posso_usar_o_espaco(),
  public.definir_status_de_acesso(uuid, text) to authenticated;

-- ---------- políticas ----------

-- admins: nenhuma política; o cliente só pergunta por sou_admin().

create policy acessos_select on public.acessos
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.sou_admin()));

create policy planos_select on public.planos
  for select to authenticated
  using (user_id = (select auth.uid()) and (select public.posso_usar_o_espaco()));

-- O ano vai de 2026 (o primeiro plano) ao seguinte ao atual em UTC: sem o teto, um
-- cliente gravaria 9999 e o seletor de ano passaria a oferecê-lo.
create policy planos_insert on public.planos
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.posso_usar_o_espaco())
    and ano between 2026 and extract(year from (now() at time zone 'utc'))::int + 1
  );

create policy planos_update on public.planos
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.posso_usar_o_espaco()))
  with check (
    user_id = (select auth.uid())
    and (select public.posso_usar_o_espaco())
    and ano between 2026 and extract(year from (now() at time zone 'utc'))::int + 1
  );

-- Sem políticas de delete: ninguém apaga plano nem acesso pelo cliente.
