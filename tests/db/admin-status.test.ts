import { describe, expect, it } from 'vitest';
import { clienteServico, criarPessoa, emailUnico } from './ambiente';

const DADOS = { planData: { companyName: 'Plano do cliente' } };

async function acessoNoBanco(userId: string) {
  const { data, error } = await clienteServico().from('acessos').select('*').eq('user_id', userId).single();
  if (error) throw error;
  return data;
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

async function contarRegistro(): Promise<number> {
  const { count, error } = await clienteServico().from('registro_admin').select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

describe('status removido e Registro', () => {
  it('admin remove cliente: status removido, plano intacto, Registro com "removeu"', async () => {
    const adminEmail = emailUnico('admin');
    const admin = await criarPessoa({ email: adminEmail, admin: true });
    const alvoEmail = emailUnico('alvo');
    const alvo = await criarPessoa({ email: alvoEmail, status: 'liberado' });
    const ins = await alvo.cliente.from('planos').insert({ user_id: alvo.id, ano: 2027, dados: DADOS });
    expect(ins.error).toBeNull();

    const r = await admin.cliente.rpc('definir_status_de_acesso', { alvo: alvo.id, novo_status: 'removido' });
    expect(r.error).toBeNull();

    expect((await acessoNoBanco(alvo.id)).status).toBe('removido');
    const plano = await clienteServico().from('planos').select('dados').eq('user_id', alvo.id).eq('ano', 2027).single();
    expect(plano.data!.dados).toEqual(DADOS);
    const registro = await registroDo(alvo.id);
    expect(registro).toHaveLength(1);
    expect(registro[0]).toMatchObject({ acao: 'removeu', admin_email: adminEmail, alvo: alvo.id, alvo_email: alvoEmail });
  });

  it('reativar devolve liberado e grava "reativou"', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const alvo = await criarPessoa({ email: emailUnico('alvo'), status: 'removido' });

    const r = await admin.cliente.rpc('definir_status_de_acesso', { alvo: alvo.id, novo_status: 'liberado' });
    expect(r.error).toBeNull();
    expect((await acessoNoBanco(alvo.id)).status).toBe('liberado');
    expect((await registroDo(alvo.id)).map((l) => l.acao)).toEqual(['reativou']);
  });

  it('liberar e bloquear gravam "liberou" e "bloqueou"', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const alvo = await criarPessoa({ email: emailUnico('alvo') });
    await admin.cliente.rpc('definir_status_de_acesso', { alvo: alvo.id, novo_status: 'liberado' });
    await admin.cliente.rpc('definir_status_de_acesso', { alvo: alvo.id, novo_status: 'bloqueado' });
    expect((await registroDo(alvo.id)).map((l) => l.acao)).toEqual(['liberou', 'bloqueou']);
  });

  it('cliente removido não lê nem grava o próprio plano', async () => {
    const alvo = await criarPessoa({ email: emailUnico('removido'), status: 'removido' });
    await clienteServico().from('planos').insert({ user_id: alvo.id, ano: 2026, dados: DADOS });

    const lido = await alvo.cliente.from('planos').select('*').eq('user_id', alvo.id);
    expect(lido.data ?? []).toHaveLength(0);
    const ups = await alvo.cliente.from('planos').upsert({ user_id: alvo.id, ano: 2027, dados: DADOS });
    expect(ups.error?.code).toBe('42501');
  });

  it('remover ou bloquear a si mesmo é recusado', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true, status: 'liberado' });
    for (const status of ['removido', 'bloqueado']) {
      const r = await admin.cliente.rpc('definir_status_de_acesso', { alvo: admin.id, novo_status: status });
      expect(r.error?.code, status).toBe('42501');
      expect(r.error?.message, status).toContain('si mesmo');
    }
    expect((await acessoNoBanco(admin.id)).status).toBe('liberado');
  });

  it('remover ou bloquear um admin é recusado com "rebaixe antes"', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const outro = await criarPessoa({ email: emailUnico('outro-admin'), admin: true, status: 'liberado' });
    for (const status of ['removido', 'bloqueado']) {
      const r = await admin.cliente.rpc('definir_status_de_acesso', { alvo: outro.id, novo_status: status });
      expect(r.error?.code, status).toBe('42501');
      expect(r.error?.message, status).toContain('rebaixe antes');
    }
    expect((await acessoNoBanco(outro.id)).status).toBe('liberado');
  });

  it('status fora da lista é recusado', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const alvo = await criarPessoa({ email: emailUnico('alvo'), status: 'liberado' });
    const r = await admin.cliente.rpc('definir_status_de_acesso', { alvo: alvo.id, novo_status: 'apagado' });
    expect(r.error?.code).toBe('22023');
    expect((await acessoNoBanco(alvo.id)).status).toBe('liberado');
    expect(await registroDo(alvo.id)).toHaveLength(0);
  });

  it('não admin chamando definir_status_de_acesso: 42501', async () => {
    const cliente = await criarPessoa({ email: emailUnico('cliente'), status: 'liberado' });
    const alvo = await criarPessoa({ email: emailUnico('alvo') });
    const r = await cliente.cliente.rpc('definir_status_de_acesso', { alvo: alvo.id, novo_status: 'liberado' });
    expect(r.error?.code).toBe('42501');
    expect((await acessoNoBanco(alvo.id)).status).toBe('pendente');
  });

  it('registro_admin: admin lê; cliente lê zero linhas; ninguém (nem admin) insere, altera ou apaga', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const alvo = await criarPessoa({ email: emailUnico('alvo') });
    await admin.cliente.rpc('definir_status_de_acesso', { alvo: alvo.id, novo_status: 'liberado' });
    const cliente = await criarPessoa({ email: emailUnico('cliente'), status: 'liberado' });

    const lidoAdmin = await admin.cliente.from('registro_admin').select('*').eq('alvo', alvo.id);
    expect(lidoAdmin.error).toBeNull();
    expect(lidoAdmin.data).toHaveLength(1);
    const lidoCliente = await cliente.cliente.from('registro_admin').select('*');
    expect(lidoCliente.data ?? []).toHaveLength(0);

    const antes = await contarRegistro();
    for (const quem of [admin.cliente, cliente.cliente]) {
      const ins = await quem.from('registro_admin').insert({ admin_email: 'x@x.com', acao: 'forjada' });
      expect(ins.error).not.toBeNull();
      const upd = await quem.from('registro_admin').update({ acao: 'alterada' }).eq('alvo', alvo.id).select();
      expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
      const del = await quem.from('registro_admin').delete().eq('alvo', alvo.id).select();
      expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
    }
    expect(await contarRegistro()).toBe(antes);
    expect((await registroDo(alvo.id)).map((l) => l.acao)).toEqual(['liberou']);
  });

  it('registrar_acao_admin não pode ser chamada por authenticated', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const antes = await contarRegistro();
    const r = await admin.cliente.rpc('registrar_acao_admin', {
      admin_email: 'x@x.com',
      acao: 'forjada',
      alvo: null,
      alvo_email: null,
      detalhe: {},
    });
    expect(r.error).not.toBeNull();
    expect(await contarRegistro()).toBe(antes);
  });
});
