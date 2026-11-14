-- Prazo de acesso definido pelo admin: escolhe o último dia de acesso de um cliente liberado.
-- Spec: conversa de 13/11/2026 (PR #9). O pagamento da Hotmart continua estendendo a partir desse prazo.

create function public.admin_definir_prazo(alvo uuid, dia date)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- why: o dia escolhido é o de São Paulo, o mesmo fuso em que a tela mostra o prazo.
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_status text;
  v_antes timestamptz;
  v_depois timestamptz;
begin
  if not public.sou_admin() then
    raise exception 'só um administrador define o prazo de acesso' using errcode = '42501';
  end if;
  -- why: cortar o acesso é Bloquear (fica no Registro como bloqueio); prazo é sempre um dia futuro.
  if dia is null or dia <= v_hoje then
    raise exception 'Escolha uma data futura; para cortar o acesso, use Bloquear' using errcode = '22023';
  end if;
  if dia > (v_hoje + interval '5 years')::date then
    raise exception 'O prazo vai até 5 anos à frente' using errcode = '22023';
  end if;

  -- why: mesma ordem de travas do estorno em aplicar_pagamento_hotmart (pagamentos, depois acessos); a ordem
  -- inversa daria deadlock com um estorno simultâneo do mesmo cliente.
  perform 1 from public.pagamentos_hotmart p where p.user_id = alvo and p.mexeu_no_prazo for update;
  select a.status, a.acesso_ate into v_status, v_antes from public.acessos a where a.user_id = alvo for update;
  if not found then
    raise exception 'acesso não encontrado' using errcode = 'P0002';
  end if;
  if v_status <> 'liberado' then
    raise exception 'o prazo só vale para cliente liberado: libere antes' using errcode = '22023';
  end if;

  -- why: acesso_ate é exclusivo (posso_usar_o_espaco exige acesso_ate > now()); o último microssegundo do dia
  -- mantém o acesso o dia inteiro e faz a tela mostrar o próprio dia, não o seguinte.
  v_depois := ((dia + 1)::timestamp at time zone 'America/Sao_Paulo') - interval '1 microsecond';
  update public.acessos set acesso_ate = v_depois where user_id = alvo;
  -- why: o dia escolhido pelo admin substitui o efeito dos pagamentos anteriores; o estorno de um deles não
  -- desconta mais um ano do dia escolhido (como já acontece depois de "Sem prazo"). Pagamento novo segue estornável.
  update public.pagamentos_hotmart set mexeu_no_prazo = false, alterado_em = now()
   where user_id = alvo and mexeu_no_prazo;
  perform public._registrar('definiu prazo', alvo, jsonb_build_object('antes', v_antes, 'depois', v_depois));
  return v_depois;
end;
$$;

revoke execute on function public.admin_definir_prazo(uuid, date) from public, anon, authenticated;
grant execute on function public.admin_definir_prazo(uuid, date) to authenticated;
