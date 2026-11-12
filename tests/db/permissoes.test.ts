import { describe, expect, it } from 'vitest';
import { anoUtc, clienteAnonimo, clienteServico, criarPessoa, emailUnico, SENHA } from './ambiente';

const DADOS = { planData: { companyName: 'Teste' } };

async function planoNoBanco(userId: string, ano: number) {
  const { data, error } = await clienteServico().from('planos').select('*').eq('user_id', userId).eq('ano', ano).maybeSingle();
  if (error) throw error;
  return data;
}

async function acessoNoBanco(userId: string) {
  const { data, error } = await clienteServico().from('acessos').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

describe('planos', () => {
  it('liberado lê e grava o próprio plano de 2027', async () => {
    const { id, cliente } = await criarPessoa({ email: emailUnico('liberado'), status: 'liberado' });
    const ins = await cliente.from('planos').insert({ user_id: id, ano: 2027, dados: DADOS });
    expect(ins.error).toBeNull();
    const upd = await cliente.from('planos').update({ dados: { planData: { companyName: 'Outra' } } }).eq('user_id', id).eq('ano', 2027).select();
    expect(upd.error).toBeNull();
    expect(upd.data).toHaveLength(1);
    const lido = await cliente.from('planos').select('dados').eq('user_id', id).eq('ano', 2027).single();
    expect(lido.error).toBeNull();
    expect(lido.data!.dados).toEqual({ planData: { companyName: 'Outra' } });
  });

  it('insert de 2025 e de (ano UTC atual + 2) é recusado', async () => {
    const { id, cliente } = await criarPessoa({ email: emailUnico('liberado'), status: 'liberado' });
    for (const ano of [2025, anoUtc() + 2]) {
      const r = await cliente.from('planos').insert({ user_id: id, ano, dados: DADOS });
      expect(r.error, `ano ${ano}`).not.toBeNull();
      expect(await planoNoBanco(id, ano)).toBeNull();
    }
  });

  it('pendente e bloqueado não leem nem gravam o próprio plano', async () => {
    for (const status of ['pendente', 'bloqueado'] as const) {
      const { id, cliente } = await criarPessoa({ email: emailUnico(status), status });
      const ins = await cliente.from('planos').insert({ user_id: id, ano: 2027, dados: DADOS });
      expect(ins.error, status).not.toBeNull();

      await clienteServico().from('planos').insert({ user_id: id, ano: 2026, dados: DADOS });
      const lido = await cliente.from('planos').select('*').eq('user_id', id);
      expect(lido.data ?? []).toHaveLength(0);
      const upd = await cliente.from('planos').update({ dados: {} }).eq('user_id', id).select();
      expect(upd.data ?? []).toHaveLength(0);
      expect((await planoNoBanco(id, 2026))!.dados).toEqual(DADOS);
    }
  });

  it('A não lê nem grava o plano de B', async () => {
    const a = await criarPessoa({ email: emailUnico('a'), status: 'liberado' });
    const b = await criarPessoa({ email: emailUnico('b'), status: 'liberado' });
    await clienteServico().from('planos').insert({ user_id: b.id, ano: 2026, dados: DADOS });

    const lido = await a.cliente.from('planos').select('*').eq('user_id', b.id);
    expect(lido.data ?? []).toHaveLength(0);
    const upd = await a.cliente.from('planos').update({ dados: {} }).eq('user_id', b.id).select();
    expect(upd.data ?? []).toHaveLength(0);
    const ins = await a.cliente.from('planos').insert({ user_id: b.id, ano: 2027, dados: DADOS });
    expect(ins.error).not.toBeNull();
    const ups = await a.cliente.from('planos').upsert({ user_id: b.id, ano: 2026, dados: {} });
    expect(ups.error).not.toBeNull();
    expect((await planoNoBanco(b.id, 2026))!.dados).toEqual(DADOS);
    expect(await planoNoBanco(b.id, 2027)).toBeNull();
  });

  it('admin grava o próprio plano sem acesso liberado e não lê o de um cliente', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const cliente = await criarPessoa({ email: emailUnico('cliente'), status: 'liberado' });
    await clienteServico().from('planos').insert({ user_id: cliente.id, ano: 2026, dados: DADOS });

    expect((await acessoNoBanco(admin.id))!.status).toBe('pendente');
    const ins = await admin.cliente.from('planos').insert({ user_id: admin.id, ano: 2027, dados: DADOS });
    expect(ins.error).toBeNull();
    const meu = await admin.cliente.from('planos').select('*').eq('user_id', admin.id);
    expect(meu.data).toHaveLength(1);

    const dele = await admin.cliente.from('planos').select('*').eq('user_id', cliente.id);
    expect(dele.data ?? []).toHaveLength(0);
  });

  it('importação: importado_em e atualizado_em ficam iguais; update do app deixa atualizado_em maior', async () => {
    const { id, cliente } = await criarPessoa({ email: emailUnico('importado'), status: 'liberado' });
    const imp = await clienteServico()
      .from('planos')
      .insert({ user_id: id, ano: 2026, dados: DADOS, importado_em: new Date('2020-01-01').toISOString() });
    expect(imp.error).toBeNull();
    const depoisDaImportacao = (await planoNoBanco(id, 2026))!;
    expect(depoisDaImportacao.importado_em).not.toBeNull();
    expect(depoisDaImportacao.importado_em).toBe(depoisDaImportacao.atualizado_em);

    const upd = await cliente.from('planos').update({ dados: { planData: { companyName: 'Editado' } } }).eq('user_id', id).eq('ano', 2026);
    expect(upd.error).toBeNull();
    const depoisDaEdicao = (await planoNoBanco(id, 2026))!;
    expect(depoisDaEdicao.importado_em).toBe(depoisDaImportacao.importado_em);
    expect(new Date(depoisDaEdicao.atualizado_em).getTime()).toBeGreaterThan(new Date(depoisDaEdicao.importado_em).getTime());
  });
});

describe('admins e sou_admin', () => {
  it('sou_admin é falso para admin com e-mail não confirmado', async () => {
    const naoConfirmado = await criarPessoa({ email: emailUnico('admin-nc'), admin: true, confirmado: false });
    const r = await naoConfirmado.cliente.rpc('sou_admin');
    expect(r.error).toBeNull();
    expect(r.data).toBe(false);

    const confirmado = await criarPessoa({ email: emailUnico('admin-ok'), admin: true });
    const r2 = await confirmado.cliente.rpc('sou_admin');
    expect(r2.data).toBe(true);

    // Sem acesso liberado e sem ser admin confirmado, também não grava plano.
    const ins = await naoConfirmado.cliente.from('planos').insert({ user_id: naoConfirmado.id, ano: 2027, dados: DADOS });
    expect(ins.error).not.toBeNull();
  });

  it('ninguém lê admins nem apaga plano ou acesso', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const cliente = await criarPessoa({ email: emailUnico('cliente'), status: 'liberado' });
    await clienteServico().from('planos').insert({ user_id: cliente.id, ano: 2026, dados: DADOS });
    await clienteServico().from('planos').insert({ user_id: admin.id, ano: 2026, dados: DADOS });

    for (const quem of [admin, cliente]) {
      const lido = await quem.cliente.from('admins').select('*');
      expect(lido.data ?? []).toHaveLength(0);
      await quem.cliente.from('planos').delete().eq('user_id', quem.id);
      await quem.cliente.from('acessos').delete().eq('user_id', quem.id);
      expect(await planoNoBanco(quem.id, 2026)).not.toBeNull();
      expect(await acessoNoBanco(quem.id)).not.toBeNull();
    }
    await admin.cliente.from('acessos').delete().eq('user_id', cliente.id);
    expect(await acessoNoBanco(cliente.id)).not.toBeNull();

    const anonimo = await clienteAnonimo().from('admins').select('*');
    expect(anonimo.data ?? []).toHaveLength(0);
  });
});

describe('acessos', () => {
  it('cliente lê só o próprio acesso; admin lista todos', async () => {
    const a = await criarPessoa({ email: emailUnico('a') });
    const b = await criarPessoa({ email: emailUnico('b') });
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });

    const deA = await a.cliente.from('acessos').select('user_id');
    expect(deA.error).toBeNull();
    expect(deA.data!.map((l) => l.user_id)).toEqual([a.id]);

    const todos = await admin.cliente.from('acessos').select('user_id');
    const ids = todos.data!.map((l) => l.user_id);
    expect(ids).toEqual(expect.arrayContaining([a.id, b.id, admin.id]));

    const anonimo = await clienteAnonimo().from('acessos').select('user_id');
    expect(anonimo.data ?? []).toHaveLength(0);
  });

  it('cliente não muda o próprio status, nem por update nem por definir_status_de_acesso; admin muda e grava liberado_por', async () => {
    const cliente = await criarPessoa({ email: emailUnico('cliente') });
    const emailAdmin = emailUnico('admin');
    const admin = await criarPessoa({ email: emailAdmin, admin: true });

    await cliente.cliente.from('acessos').update({ status: 'liberado' }).eq('user_id', cliente.id);
    expect((await acessoNoBanco(cliente.id))!.status).toBe('pendente');
    const rpc = await cliente.cliente.rpc('definir_status_de_acesso', { alvo: cliente.id, novo_status: 'liberado' });
    expect(rpc.error).not.toBeNull();
    expect((await acessoNoBanco(cliente.id))!.status).toBe('pendente');

    const pelaAdmin = await admin.cliente.rpc('definir_status_de_acesso', { alvo: cliente.id, novo_status: 'liberado' });
    expect(pelaAdmin.error).toBeNull();
    const depois = (await acessoNoBanco(cliente.id))!;
    expect(depois.status).toBe('liberado');
    expect(depois.liberado_por).toBe(emailAdmin);
    expect(depois.liberado_em).not.toBeNull();

    const invalido = await admin.cliente.rpc('definir_status_de_acesso', { alvo: cliente.id, novo_status: 'dono' });
    expect(invalido.error).not.toBeNull();
  });

  it('cadastro com E-mail@X.com gera acesso pendente com email minúsculo, mesmo com status liberado nos metadados', async () => {
    const sufixo = emailUnico('x').split('@')[0];
    const email = `E-mail-${sufixo}@Exemplo.com`;
    const r = await clienteAnonimo().auth.signUp({ email, password: SENHA, options: { data: { status: 'liberado', name: 'Ana' } } });
    expect(r.error).toBeNull();
    const acesso = (await acessoNoBanco(r.data.user!.id))!;
    expect(acesso.status).toBe('pendente');
    expect(acesso.email).toBe(email.toLowerCase());
    expect(acesso.nome).toBe('Ana');
    expect(acesso.email_verificado).toBe(false);
  });

  it('email_verificado acompanha a confirmação', async () => {
    const pessoa = await criarPessoa({ email: emailUnico('nc'), confirmado: false });
    expect((await acessoNoBanco(pessoa.id))!.email_verificado).toBe(false);
    const r = await clienteServico().auth.admin.updateUserById(pessoa.id, { email_confirm: true });
    expect(r.error).toBeNull();
    expect((await acessoNoBanco(pessoa.id))!.email_verificado).toBe(true);

    const confirmada = await criarPessoa({ email: emailUnico('ok') });
    expect((await acessoNoBanco(confirmada.id))!.email_verificado).toBe(true);
  });
});
