-- ============================================================
--  PLAN — área de administração
--
--  As políticas de `planos` não mudam: cada cliente segue lendo e gravando só o
--  próprio plano. Todo poder novo do admin passa por funções `security definer`
--  que conferem sou_admin() antes de agir e gravam no Registro (registro_admin).
--  Spec: docs/superpowers/specs/2026-11-13-area-admin-design.md
-- ============================================================

-- ---------- status removido ----------

-- "Remover" desativa e guarda: a conta e o plano ficam, e o admin pode reativar.
-- posso_usar_o_espaco() só deixa passar liberado ou admin, então o removido fica barrado sem mudança nela.
alter table public.acessos drop constraint acessos_status_check;
alter table public.acessos add constraint acessos_status_check
  check (status in ('pendente', 'liberado', 'bloqueado', 'removido'));

-- ---------- Registro ----------

create table public.registro_admin (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  admin_email text not null,
  acao text not null,
  alvo uuid null,
  alvo_email text null,
  detalhe jsonb not null default '{}'
);

create index registro_admin_quando_idx on public.registro_admin (quando desc);
create index registro_admin_alvo_quando_idx on public.registro_admin (alvo, quando desc);

alter table public.registro_admin enable row level security;

-- why: só as funções (security definer) gravam o Registro; nenhum cliente, nem um admin, insere, altera ou apaga.
revoke all on public.registro_admin from anon, authenticated;
grant select on public.registro_admin to authenticated;

create policy registro_admin_select on public.registro_admin
  for select to authenticated
  using ((select public.sou_admin()));

-- Grava em nome de quem chamou: o e-mail do admin vem do token, o do cliente vem de `acessos`.
create function public._registrar(acao text, alvo uuid, detalhe jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.registro_admin (admin_email, acao, alvo, alvo_email, detalhe)
  values (
    lower(auth.jwt() ->> 'email'),
    acao,
    alvo,
    (select a.email from public.acessos a where a.user_id = alvo),
    coalesce(detalhe, '{}'::jsonb)
  );
end;
$$;

-- Para a Edge Function admin-usuarios, que age com a chave de serviço (sem o token do admin no banco).
create function public.registrar_acao_admin(admin_email text, acao text, alvo uuid, alvo_email text, detalhe jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.registro_admin (admin_email, acao, alvo, alvo_email, detalhe)
  values (lower(trim(admin_email)), acao, alvo, lower(trim(alvo_email)), coalesce(detalhe, '{}'::jsonb));
$$;

-- ---------- status de acesso ----------

create or replace function public.definir_status_de_acesso(alvo uuid, novo_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  anterior text;
  alvo_eh_admin boolean;
  acao text;
begin
  if not public.sou_admin() then
    raise exception 'só um administrador muda o status de acesso' using errcode = '42501';
  end if;
  if novo_status is null or novo_status not in ('pendente', 'liberado', 'bloqueado', 'removido') then
    raise exception 'status de acesso inválido: %', novo_status using errcode = '22023';
  end if;
  if alvo = auth.uid() then
    raise exception 'ninguém muda o status de si mesmo' using errcode = '42501';
  end if;

  select a.status, exists (select 1 from public.admins ad where ad.email = lower(a.email))
    into anterior, alvo_eh_admin
    from public.acessos a
   where a.user_id = alvo
     for update;
  if not found then
    raise exception 'acesso não encontrado' using errcode = 'P0002';
  end if;
  if alvo_eh_admin and novo_status in ('bloqueado', 'removido') then
    raise exception 'administrador não é bloqueado nem removido: rebaixe antes' using errcode = '42501';
  end if;

  update public.acessos
     set status = novo_status,
         liberado_em = now(),
         liberado_por = lower(auth.jwt() ->> 'email'),
         alterado_no_app_em = now()
   where user_id = alvo;

  acao := case
    when novo_status = 'liberado' and anterior = 'removido' then 'reativou'
    when novo_status = 'liberado' then 'liberou'
    when novo_status = 'bloqueado' then 'bloqueou'
    when novo_status = 'removido' then 'removeu'
    else 'devolveu à fila'
  end;
  perform public._registrar(acao, alvo, jsonb_build_object('de', anterior, 'para', novo_status));
end;
$$;

-- ---------- privilégios (Tarefa 1) ----------

revoke execute on function public._registrar(text, uuid, jsonb),
  public.registrar_acao_admin(text, text, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.registrar_acao_admin(text, text, uuid, text, jsonb) to service_role;

-- ---------- administradores ----------

-- Admins são todos iguais: qualquer um lista, promove e rebaixa. user_id e nome nulos: admin cadastrado sem conta.
create function public.listar_admins()
returns table (email text, user_id uuid, nome text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.sou_admin() then
    raise exception 'só um administrador lista os administradores' using errcode = '42501';
  end if;
  return query
    select ad.email, a.user_id, a.nome
      from public.admins ad
      left join public.acessos a on lower(a.email) = ad.email
     order by ad.email;
end;
$$;

create function public.promover_admin(email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo_email text := lower(trim(email));
  alvo_id uuid;
  alvo_status text;
begin
  if not public.sou_admin() then
    raise exception 'só um administrador promove outro' using errcode = '42501';
  end if;
  select a.user_id, a.status into alvo_id, alvo_status
    from public.acessos a
   where lower(a.email) = alvo_email
   limit 1;
  if alvo_id is null then
    raise exception 'esse e-mail não tem conta: adicione como cliente antes';
  end if;
  if alvo_status = 'removido' then
    raise exception 'cliente removido não vira administrador: reative antes' using errcode = '22023';
  end if;
  if exists (select 1 from public.admins ad where ad.email = alvo_email) then
    return;
  end if;
  insert into public.admins (email) values (alvo_email);
  perform public._registrar('promoveu admin', alvo_id, '{}'::jsonb);
end;
$$;

create function public.rebaixar_admin(email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo_email text := lower(trim(email));
  alvo_id uuid;
begin
  -- why: trava antes de conferir sou_admin() e de contar; dois admins se rebaixando ao mesmo tempo esperam um pelo
  -- outro, e o segundo, já rebaixado, é recusado aqui embaixo em vez de deixar a tabela sem admin.
  lock table public.admins in exclusive mode;
  if not public.sou_admin() then
    raise exception 'só um administrador rebaixa outro' using errcode = '42501';
  end if;
  if alvo_email = lower(auth.jwt() ->> 'email') then
    raise exception 'ninguém rebaixa a si mesmo' using errcode = '42501';
  end if;
  if not exists (select 1 from public.admins ad where ad.email = alvo_email) then
    raise exception 'esse e-mail não é administrador';
  end if;
  -- Defesa: sobra ao menos um admin com conta confirmada (quem chama já é um, então só falha com dados fora do comum).
  if not exists (
    select 1 from public.admins ad
      join auth.users u on lower(u.email) = ad.email
     where ad.email <> alvo_email and u.email_confirmed_at is not null
  ) then
    raise exception 'o último administrador não é rebaixado' using errcode = '42501';
  end if;
  select a.user_id into alvo_id from public.acessos a where lower(a.email) = alvo_email limit 1;
  delete from public.admins ad where ad.email = alvo_email;
  perform public._registrar('rebaixou admin', alvo_id, jsonb_build_object('email', alvo_email));
end;
$$;

revoke execute on function public.listar_admins(), public.promover_admin(text), public.rebaixar_admin(text)
  from public, anon, authenticated;
grant execute on function public.listar_admins(), public.promover_admin(text), public.rebaixar_admin(text)
  to authenticated;

-- ---------- plano do cliente pelo admin ----------

-- As políticas de `planos` seguem dando a cada um só o próprio plano; o admin chega ao plano de um cliente
-- só por estas três funções, que conferem sou_admin() e gravam no Registro. O próprio plano do admin
-- continua pelo caminho normal: alvo igual a si mesmo é recusado.
create function public._conferir_admin_e_alvo(alvo uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.sou_admin() then
    raise exception 'só um administrador abre o plano de um cliente' using errcode = '42501';
  end if;
  if alvo is null or alvo = auth.uid() then
    raise exception 'o próprio plano se abre pelo caminho normal, não como cliente' using errcode = '42501';
  end if;
end;
$$;

create function public.anos_do_cliente(alvo uuid)
returns setof int
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._conferir_admin_e_alvo(alvo);
  return query select p.ano from public.planos p where p.user_id = anos_do_cliente.alvo order by p.ano;
end;
$$;

create function public.plano_do_cliente(alvo uuid, ano int)
returns table (dados jsonb, atualizado_em timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._conferir_admin_e_alvo(plano_do_cliente.alvo);
  perform public._registrar('abriu plano', plano_do_cliente.alvo, jsonb_build_object('ano', plano_do_cliente.ano));
  return query
    select p.dados, p.atualizado_em
      from public.planos p
     where p.user_id = plano_do_cliente.alvo and p.ano = plano_do_cliente.ano;
end;
$$;

-- Mesmos limites do cliente (política de `planos` e check da tabela): ano de 2026 até o ano UTC atual + 1, até 1 MiB.
create function public.salvar_plano_do_cliente(alvo uuid, ano int, dados jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  meu_email text := lower(auth.jwt() ->> 'email');
  novo timestamptz;
begin
  perform public._conferir_admin_e_alvo(salvar_plano_do_cliente.alvo);
  if salvar_plano_do_cliente.ano is null
     or salvar_plano_do_cliente.ano not between 2026 and extract(year from (now() at time zone 'utc'))::int + 1 then
    raise exception 'Ano do plano fora do permitido' using errcode = '22023';
  end if;

  insert into public.planos (user_id, ano, dados)
  values (salvar_plano_do_cliente.alvo, salvar_plano_do_cliente.ano, salvar_plano_do_cliente.dados)
  on conflict on constraint planos_pkey do update set dados = excluded.dados
  returning public.planos.atualizado_em into novo;

  -- why: o salvamento automático grava a cada poucos segundos; uma linha por admin, cliente e ano a cada 30 minutos
  -- (contados da última linha do grupo) basta para o Registro. O detalhe guarda só o ano, nunca o conteúdo do plano.
  if not exists (
    select 1 from public.registro_admin r
     where r.acao = 'alterou plano'
       and r.admin_email = meu_email
       and r.alvo = salvar_plano_do_cliente.alvo
       and r.detalhe ->> 'ano' = salvar_plano_do_cliente.ano::text
       and r.quando > now() - interval '30 minutes'
  ) then
    perform public._registrar('alterou plano', salvar_plano_do_cliente.alvo,
      jsonb_build_object('ano', salvar_plano_do_cliente.ano));
  end if;
  return novo;
end;
$$;

revoke execute on function public._conferir_admin_e_alvo(uuid), public.anos_do_cliente(uuid),
  public.plano_do_cliente(uuid, int), public.salvar_plano_do_cliente(uuid, int, jsonb)
  from public, anon, authenticated;
grant execute on function public.anos_do_cliente(uuid), public.plano_do_cliente(uuid, int),
  public.salvar_plano_do_cliente(uuid, int, jsonb) to authenticated;
