-- ============================================================
--  PLAN — assinatura anual pela Hotmart
--
--  why: a regra do prazo mora aqui, e não na Edge Function, porque a trava da linha de acesso e a chave
--  única da transação ficam no mesmo begin…commit: dois avisos simultâneos nunca contam duas vezes.
--  Spec: docs/superpowers/specs/2026-11-13-assinatura-hotmart-design.md
-- ============================================================

-- ---------- prazo de acesso ----------

-- null = sem prazo (clientes antigos, admins, quem o admin libera à mão). Data = vale até ela, exclusive.
alter table public.acessos add column acesso_ate timestamptz null;

-- Sem tarefa agendada: o vencimento acontece pela própria data. O admin nunca é barrado pelo prazo.
create or replace function public.posso_usar_o_espaco()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.acessos
    where user_id = auth.uid()
      and status = 'liberado'
      and (acesso_ate is null or acesso_ate > now())
  ) or public.sou_admin();
$$;

-- ---------- pagamentos ----------

-- Só o mínimo para a regra e o Registro: sem CPF, telefone, endereço nem valor.
-- Avisos ignorados (outro produto, evento sem efeito) não são gravados, só logados pela Edge Function.
create table public.pagamentos_hotmart (
  transacao text primary key,
  email text not null,
  situacao text not null check (situacao in ('aprovada', 'estornada')),
  evento text not null,
  user_id uuid null references auth.users (id) on delete set null,
  -- Só a aprovação que mexeu no prazo é desfeita pelo estorno.
  mexeu_no_prazo boolean not null default false,
  recebido_em timestamptz not null default now(),
  alterado_em timestamptz not null default now()
);

create index pagamentos_hotmart_user_idx on public.pagamentos_hotmart (user_id);

alter table public.pagamentos_hotmart enable row level security;
-- why: só a service role (Edge Function hotmart-webhook) lê e grava; o admin vê os pagamentos pelo Registro.
revoke all on public.pagamentos_hotmart from anon, authenticated;

-- ---------- regra do aviso ----------

create function public.aplicar_pagamento_hotmart(p_transacao text, p_email text, p_tipo text, p_evento text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transacao text := nullif(trim(p_transacao), '');
  v_email text := nullif(lower(trim(p_email)), '');
  v_evento text := coalesce(nullif(trim(p_evento), ''), '?');
  v_nova boolean := false;
  v_pag public.pagamentos_hotmart%rowtype;
  v_user uuid;
  v_status text;
  v_alvo_email text;
  v_antes timestamptz;
  v_depois timestamptz;
  v_resultado text;
  v_acao text;
begin
  if p_tipo is null or p_tipo not in ('aprova', 'estorna') then
    raise exception 'tipo de aviso inválido: %', p_tipo using errcode = '22023';
  end if;
  if v_transacao is null or v_email is null then
    raise exception 'aviso sem transação ou e-mail' using errcode = '22023';
  end if;

  -- A transação primeiro: um segundo aviso da mesma transação espera aqui até o primeiro terminar.
  insert into public.pagamentos_hotmart (transacao, email, situacao, evento)
  values (v_transacao, v_email, case p_tipo when 'aprova' then 'aprovada' else 'estornada' end, v_evento)
  on conflict (transacao) do nothing
  returning true into v_nova;
  v_nova := coalesce(v_nova, false);

  if not v_nova then
    select * into v_pag from public.pagamentos_hotmart where transacao = v_transacao for update;
  end if;

  -- ---------- aprova ----------
  if p_tipo = 'aprova' then
    -- Já aprovada (PURCHASE_COMPLETE depois do APPROVED, ou reenvio) ou estornada antes: não conta de novo.
    if not v_nova then
      return jsonb_build_object('resultado', 'repetido', 'user_id', v_pag.user_id, 'antes', null, 'depois', null);
    end if;

    -- auth.users.email é único; acessos.email não é.
    select u.id into v_user from auth.users u where lower(u.email) = v_email order by u.created_at limit 1;
    if v_user is not null then
      select a.status, a.acesso_ate, a.email into v_status, v_antes, v_alvo_email
        from public.acessos a where a.user_id = v_user for update;
    end if;
    if v_user is null or v_status is null then
      -- A Edge Function cria a conta e chama de novo: a transação não fica gravada sem dono.
      delete from public.pagamentos_hotmart where transacao = v_transacao;
      return jsonb_build_object('resultado', 'sem_conta', 'user_id', null, 'antes', null, 'depois', null);
    end if;

    if v_status = 'pendente' then
      v_resultado := 'liberou';
      v_depois := now() + interval '1 year';
      update public.acessos
         set status = 'liberado', acesso_ate = v_depois, liberado_em = now(), liberado_por = 'hotmart',
             alterado_no_app_em = now()
       where user_id = v_user;
      v_acao := 'pagamento liberou';
    elsif v_status = 'liberado' and v_antes is not null then
      v_resultado := 'estendeu';
      -- Renovação antes de vencer não perde os dias que faltavam; vencida conta a partir de agora.
      v_depois := greatest(now(), v_antes) + interval '1 year';
      update public.acessos set acesso_ate = v_depois where user_id = v_user;
      v_acao := 'pagamento estendeu';
    elsif v_status = 'liberado' then
      v_resultado := 'sem_prazo';
      v_depois := null;
    else
      -- Bloqueado ou removido: o pagamento fica gravado e o admin decide pelo Registro.
      v_resultado := 'conta_barrada';
      v_depois := v_antes;
      v_acao := 'pagamento de conta barrada';
    end if;

    update public.pagamentos_hotmart
       set user_id = v_user, mexeu_no_prazo = v_resultado in ('liberou', 'estendeu'), alterado_em = now()
     where transacao = v_transacao;

  -- ---------- estorna ----------
  else
    if v_nova then
      -- Estorno antes da aprovação: fica gravado como estornado e a aprovação que chegar depois não conta.
      return jsonb_build_object('resultado', 'estorno_sem_efeito', 'user_id', null, 'antes', null, 'depois', null);
    end if;

    v_user := v_pag.user_id;
    if v_pag.situacao = 'aprovada' and v_pag.mexeu_no_prazo and v_user is not null then
      select a.acesso_ate, a.email into v_antes, v_alvo_email
        from public.acessos a where a.user_id = v_user for update;
    end if;

    if v_antes is not null then
      v_resultado := 'estornou';
      -- Se cair no passado, o acesso vence na hora.
      v_depois := v_antes - interval '1 year';
      update public.acessos set acesso_ate = v_depois where user_id = v_user;
      v_acao := 'estorno';
    else
      -- Sem efeito: a aprovação não mexeu no prazo, o admin tirou o prazo depois, ou já estava estornada.
      v_resultado := 'estorno_sem_efeito';
    end if;

    if v_pag.situacao <> 'estornada' then
      update public.pagamentos_hotmart
         set situacao = 'estornada', evento = v_evento, alterado_em = now()
       where transacao = v_transacao;
    end if;
  end if;

  if v_acao is not null then
    insert into public.registro_admin (admin_email, acao, alvo, alvo_email, detalhe)
    values ('hotmart', v_acao, v_user, v_alvo_email,
      jsonb_build_object('transacao', v_transacao, 'evento', v_evento, 'antes', v_antes, 'depois', v_depois));
  end if;

  return jsonb_build_object('resultado', v_resultado, 'user_id', v_user, 'antes', v_antes, 'depois', v_depois);
end;
$$;

-- ---------- prazo pelo admin ----------

-- "Liberar sem prazo" na aba Clientes: o único ajuste de prazo que o admin faz.
create function public.admin_tirar_prazo(alvo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes timestamptz;
begin
  if not public.sou_admin() then
    raise exception 'só um administrador tira o prazo de acesso' using errcode = '42501';
  end if;
  select a.acesso_ate into v_antes from public.acessos a where a.user_id = alvo for update;
  if not found then
    raise exception 'acesso não encontrado' using errcode = 'P0002';
  end if;
  update public.acessos set acesso_ate = null where user_id = alvo;
  perform public._registrar('tirou prazo', alvo, jsonb_build_object('antes', v_antes));
end;
$$;

-- ---------- privilégios ----------

revoke execute on function public.aplicar_pagamento_hotmart(text, text, text, text), public.admin_tirar_prazo(uuid)
  from public, anon, authenticated;
grant execute on function public.aplicar_pagamento_hotmart(text, text, text, text) to service_role;
grant execute on function public.admin_tirar_prazo(uuid) to authenticated;
