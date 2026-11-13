-- ============================================================
--  PLAN — área de administração: limite de envios e Registro atômico
--  (achados da revisão de 2026-11-13; spec docs/superpowers/specs/2026-11-13-area-admin-design.md)
-- ============================================================

-- ---------- limite de envios do "Defina sua senha" ----------

-- Cada linha é um pedido ao Auth que a Edge Function admin-usuarios reservou (criar ou reenviar), mesmo que o
-- e-mail depois não saia. Fica fora do Registro porque precisa ser gravada ANTES de chamar o Auth, na mesma
-- transação que conta, para dois pedidos simultâneos não passarem os dois.
create table public.envios_de_senha (
  id bigint generated always as identity primary key,
  quando timestamptz not null default clock_timestamp(),
  admin_email text not null,
  destinatario text not null,
  tipo text not null check (tipo in ('criar', 'reenviar'))
);

create index envios_de_senha_admin_idx on public.envios_de_senha (admin_email, quando);
create index envios_de_senha_reenvio_idx on public.envios_de_senha (destinatario, quando) where tipo = 'reenviar';

alter table public.envios_de_senha enable row level security;
-- why: só a função abaixo (chamada pela Edge Function com a chave de serviço) lê e grava; nenhum usuário vê.
revoke all on public.envios_de_senha from anon, authenticated;

-- Trava por admin (e por destinatário, no reenvio), conta a última hora e, dentro do limite, grava a reserva.
-- Devolve null quando reservou; senão, a hora em que a janela libera (o Retry-After sai disso, em regras.ts).
-- Os limites vêm da Edge Function (regras.ts), a única que chama.
create function public.reservar_envio_de_senha(
  quem_envia text,
  para text,
  tipo_de_envio text,
  limite_admin int,
  limite_destinatario int
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_email_n text := lower(trim(quem_envia));
  destinatario_n text := lower(trim(para));
  janela constant interval := interval '1 hour';
  agora timestamptz;
  n int;
  libera_admin timestamptz;
  libera_destinatario timestamptz;
begin
  if tipo_de_envio is null or tipo_de_envio not in ('criar', 'reenviar') then
    raise exception 'tipo de envio inválido: %', tipo_de_envio using errcode = '22023';
  end if;
  if admin_email_n is null or admin_email_n = '' or destinatario_n is null or destinatario_n = ''
     or limite_admin is null or limite_admin < 1 or limite_destinatario is null or limite_destinatario < 1 then
    raise exception 'pedido de envio inválido' using errcode = '22023';
  end if;

  -- why: sempre admin antes de destinatário, em espaços de chave diferentes (1 e 2), para não haver espera cruzada.
  perform pg_advisory_xact_lock(1, hashtext(admin_email_n));
  if tipo_de_envio = 'reenviar' then
    perform pg_advisory_xact_lock(2, hashtext(destinatario_n));
  end if;
  -- clock_timestamp e não now(): now() é o início da transação, e esta pode ter esperado na trava.
  agora := clock_timestamp();

  -- Guarda só o necessário: as reservas deste admin com mais de um dia saem.
  delete from public.envios_de_senha e
   where e.admin_email = admin_email_n and e.quando < agora - interval '1 day';

  select count(*) into n from public.envios_de_senha e
   where e.admin_email = admin_email_n and e.quando > agora - janela;
  if n >= limite_admin then
    -- Libera quando sair da janela o envio que deixa o total abaixo do limite.
    select e.quando + janela into libera_admin from public.envios_de_senha e
     where e.admin_email = admin_email_n and e.quando > agora - janela
     order by e.quando asc
     offset n - limite_admin limit 1;
  end if;

  if tipo_de_envio = 'reenviar' then
    select count(*) into n from public.envios_de_senha e
     where e.destinatario = destinatario_n and e.tipo = 'reenviar' and e.quando > agora - janela;
    if n >= limite_destinatario then
      select e.quando + janela into libera_destinatario from public.envios_de_senha e
       where e.destinatario = destinatario_n and e.tipo = 'reenviar' and e.quando > agora - janela
       order by e.quando asc
       offset n - limite_destinatario limit 1;
    end if;
  end if;

  if libera_admin is not null or libera_destinatario is not null then
    return greatest(libera_admin, libera_destinatario);
  end if;

  insert into public.envios_de_senha (quando, admin_email, destinatario, tipo)
  values (agora, admin_email_n, destinatario_n, tipo_de_envio);
  return null;
end;
$$;

revoke execute on function public.reservar_envio_de_senha(text, text, text, int, int) from public, anon, authenticated;
grant execute on function public.reservar_envio_de_senha(text, text, text, int, int) to service_role;

-- ---------- agrupamento "alterou plano" atômico ----------

-- Igual à versão de 20261113000000_area_admin.sql, com a trava antes de olhar a última linha do grupo.
create or replace function public.salvar_plano_do_cliente(alvo uuid, ano int, dados jsonb)
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
  -- A trava do grupo vem antes da consulta: dois salvamentos simultâneos não gravam duas linhas.
  perform pg_advisory_xact_lock(
    hashtext(meu_email || '|' || salvar_plano_do_cliente.alvo::text || '|' || salvar_plano_do_cliente.ano::text));
  if not exists (
    select 1 from public.registro_admin r
     where r.acao = 'alterou plano'
       and r.admin_email = meu_email
       and r.alvo = salvar_plano_do_cliente.alvo
       and r.detalhe ->> 'ano' = salvar_plano_do_cliente.ano::text
       and r.quando > clock_timestamp() - interval '30 minutes'
  ) then
    perform public._registrar('alterou plano', salvar_plano_do_cliente.alvo,
      jsonb_build_object('ano', salvar_plano_do_cliente.ano));
  end if;
  return novo;
end;
$$;
