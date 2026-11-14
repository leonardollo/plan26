// admin_definir_prazo: o admin escolhe o último dia de acesso de um cliente liberado.
// O acesso vale até o fim desse dia em São Paulo; hoje, passado e mais de 5 anos à frente são recusados.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { clienteServico, criarPessoa, emailUnico, type StatusAcesso } from './ambiente';

/** 'AAAA-MM-DD' de hoje em São Paulo, como o banco calcula. */
function hojeEmSP(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function somarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Soma anos como o Postgres: 29/02 vira 28/02 quando o ano de destino não é bissexto. */
function somarAnos(dia: string, anos: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a + anos, m, 0)).getUTCDate();
  return `${a + anos}-${String(m).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

/** Último instante do dia em São Paulo, na precisão do JS (ms). why: São Paulo não tem horário de verão desde 2019 (UTC-3). */
function fimDoDiaEmSP(dia: string): number {
  return Date.parse(`${somarDias(dia, 1)}T03:00:00Z`) - 1;
}

async function prazoDe(userId: string): Promise<string | null> {
  const { data, error } = await clienteServico().from('acessos').select('acesso_ate').eq('user_id', userId).single();
  if (error) throw error;
  return (data as { acesso_ate: string | null }).acesso_ate;
}

async function registroDo(alvo: string) {
  const { data, error } = await clienteServico()
    .from('registro_admin')
    .select('*')
    .eq('alvo', alvo)
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
}

async function novoAdmin() {
  const email = emailUnico('admin');
  return { email, ...(await criarPessoa({ email, admin: true })) };
}

async function novoCliente(status: StatusAcesso = 'liberado') {
  return criarPessoa({ email: emailUnico('cliente'), status });
}

describe('admin_definir_prazo', () => {
  it('cliente recebe 42501 e o prazo não muda', async () => {
    const alvo = await novoCliente();
    const r = await alvo.cliente.rpc('admin_definir_prazo', { alvo: alvo.id, dia: somarDias(hojeEmSP(), 30) });
    expect(r.error?.code).toBe('42501');
    expect(await prazoDe(alvo.id)).toBeNull();
  });

  it('admin grava o fim do dia em São Paulo, devolve o prazo e o Registro mostra antes e depois', async () => {
    const admin = await novoAdmin();
    const alvo = await novoCliente();
    const dia = somarDias(hojeEmSP(), 1);

    const r = await admin.cliente.rpc('admin_definir_prazo', { alvo: alvo.id, dia });
    expect(r.error).toBeNull();
    const gravado = await prazoDe(alvo.id);
    expect(new Date(gravado!).getTime()).toBe(fimDoDiaEmSP(dia));
    expect(new Date(r.data as string).getTime()).toBe(fimDoDiaEmSP(dia));

    const registro = await registroDo(alvo.id);
    expect(registro).toHaveLength(1);
    expect(registro[0]).toMatchObject({ acao: 'definiu prazo', admin_email: admin.email });
    expect(registro[0].detalhe.antes).toBeNull();
    expect(new Date(registro[0].detalhe.depois).getTime()).toBe(fimDoDiaEmSP(dia));
  });

  it('troca um prazo existente e o Registro guarda o anterior', async () => {
    const admin = await novoAdmin();
    const alvo = await novoCliente();
    const primeiro = somarDias(hojeEmSP(), 10);
    expect((await admin.cliente.rpc('admin_definir_prazo', { alvo: alvo.id, dia: primeiro })).error).toBeNull();
    const segundo = somarAnos(hojeEmSP(), 1);
    expect((await admin.cliente.rpc('admin_definir_prazo', { alvo: alvo.id, dia: segundo })).error).toBeNull();

    expect(new Date((await prazoDe(alvo.id))!).getTime()).toBe(fimDoDiaEmSP(segundo));
    const registro = await registroDo(alvo.id);
    expect(registro).toHaveLength(2);
    expect(new Date(registro[1].detalhe.antes).getTime()).toBe(fimDoDiaEmSP(primeiro));
  });

  it('recusa hoje, ontem e mais de 5 anos à frente com 22023; aceita exatamente 5 anos', async () => {
    const admin = await novoAdmin();
    const alvo = await novoCliente();
    const hoje = hojeEmSP();

    for (const dia of [hoje, somarDias(hoje, -1), somarDias(somarAnos(hoje, 5), 1)]) {
      const r = await admin.cliente.rpc('admin_definir_prazo', { alvo: alvo.id, dia });
      expect(r.error?.code, dia).toBe('22023');
    }
    expect(await prazoDe(alvo.id)).toBeNull();
    expect(await registroDo(alvo.id)).toHaveLength(0);

    const limite = somarAnos(hoje, 5);
    expect((await admin.cliente.rpc('admin_definir_prazo', { alvo: alvo.id, dia: limite })).error).toBeNull();
    expect(new Date((await prazoDe(alvo.id))!).getTime()).toBe(fimDoDiaEmSP(limite));
  });

  it('recusa dia vazio com 22023', async () => {
    const admin = await novoAdmin();
    const alvo = await novoCliente();
    const r = await admin.cliente.rpc('admin_definir_prazo', { alvo: alvo.id, dia: null });
    expect(r.error?.code).toBe('22023');
  });

  it('o dia escolhido pelo admin vale contra o estorno de um pagamento anterior; um pagamento novo ainda é estornável', async () => {
    const admin = await novoAdmin();
    const email = emailUnico('pago');
    const alvo = await criarPessoa({ email });
    const aplicar = async (transacao: string, tipo: 'aprova' | 'estorna') => {
      const { data, error } = await clienteServico().rpc('aplicar_pagamento_hotmart', {
        p_transacao: transacao, p_email: email, p_tipo: tipo, p_evento: tipo === 'aprova' ? 'PURCHASE_APPROVED' : 'PURCHASE_REFUNDED',
      });
      if (error) throw error;
      return data as { resultado: string };
    };
    const antiga = `prazo-${randomUUID()}`;
    expect((await aplicar(antiga, 'aprova')).resultado).toBe('liberou');

    const dia = somarDias(hojeEmSP(), 60);
    expect((await admin.cliente.rpc('admin_definir_prazo', { alvo: alvo.id, dia })).error).toBeNull();
    expect((await aplicar(antiga, 'estorna')).resultado).toBe('estorno_sem_efeito');
    expect(new Date((await prazoDe(alvo.id))!).getTime()).toBe(fimDoDiaEmSP(dia));

    const nova = `prazo-${randomUUID()}`;
    expect((await aplicar(nova, 'aprova')).resultado).toBe('estendeu');
    expect((await aplicar(nova, 'estorna')).resultado).toBe('estornou');
    expect(new Date((await prazoDe(alvo.id))!).getTime()).toBe(fimDoDiaEmSP(dia));
  });

  it('cliente inexistente é recusado; pendente, bloqueado e removido recebem 22023', async () => {
    const admin = await novoAdmin();
    const dia = somarDias(hojeEmSP(), 30);

    // why: o banco levanta P0002, mas o PostgREST local devolve 500 sem código (igual em admin_tirar_prazo).
    const alvoInexistente = randomUUID();
    const inexistente = await admin.cliente.rpc('admin_definir_prazo', { alvo: alvoInexistente, dia });
    expect(inexistente.error).not.toBeNull();
    expect(await registroDo(alvoInexistente)).toHaveLength(0);

    for (const status of ['pendente', 'bloqueado', 'removido'] as const) {
      const alvo = await novoCliente(status);
      const r = await admin.cliente.rpc('admin_definir_prazo', { alvo: alvo.id, dia });
      expect(r.error?.code, status).toBe('22023');
      expect(await prazoDe(alvo.id), status).toBeNull();
    }
  });
});
