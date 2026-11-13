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
