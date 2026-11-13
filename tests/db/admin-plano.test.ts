import { describe, expect, it } from 'vitest';
import { anoUtc, clienteServico, criarPessoa, emailUnico } from './ambiente';

const DADOS = { planData: { companyName: 'Original' } };
const EDITADO = { planData: { companyName: 'Editado pelo admin' } };

async function planoNoBanco(userId: string, ano: number) {
  const { data, error } = await clienteServico().from('planos').select('*').eq('user_id', userId).eq('ano', ano).maybeSingle();
  if (error) throw error;
  return data;
}

async function registro(adminEmail: string, alvo: string, acao: string) {
  const { data, error } = await clienteServico()
    .from('registro_admin')
    .select('*')
    .eq('admin_email', adminEmail)
    .eq('alvo', alvo)
    .eq('acao', acao)
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
}

async function novoAdmin() {
  const email = emailUnico('admin');
  const admin = await criarPessoa({ email, admin: true });
  return { ...admin, email };
}

describe('plano do cliente pelo admin', () => {
  it('admin abre e edita plano de cliente pendente, bloqueado e removido; o cliente liberado vê a edição', async () => {
    const admin = await novoAdmin();
    for (const status of ['pendente', 'bloqueado', 'removido'] as const) {
      const alvo = await criarPessoa({ email: emailUnico(status), status });
      await clienteServico().from('planos').insert({ user_id: alvo.id, ano: 2026, dados: DADOS });

      const anos = await admin.cliente.rpc('anos_do_cliente', { alvo: alvo.id });
      expect(anos.error, status).toBeNull();
      expect(anos.data, status).toEqual([2026]);
      const aberto = await admin.cliente.rpc('plano_do_cliente', { alvo: alvo.id, ano: 2026 });
      expect(aberto.error, status).toBeNull();
      expect(aberto.data, status).toHaveLength(1);
      expect(aberto.data[0].dados, status).toEqual(DADOS);

      const salvo = await admin.cliente.rpc('salvar_plano_do_cliente', { alvo: alvo.id, ano: 2026, dados: EDITADO });
      expect(salvo.error, status).toBeNull();
      expect(new Date(salvo.data as string).getTime(), status).not.toBeNaN();
      expect((await planoNoBanco(alvo.id, 2026))!.dados, status).toEqual(EDITADO);
    }

    const liberado = await criarPessoa({ email: emailUnico('liberado'), status: 'liberado' });
    const s = await admin.cliente.rpc('salvar_plano_do_cliente', { alvo: liberado.id, ano: 2027, dados: EDITADO });
    expect(s.error).toBeNull();
    const visto = await liberado.cliente.from('planos').select('dados').eq('user_id', liberado.id).eq('ano', 2027).single();
    expect(visto.data!.dados).toEqual(EDITADO);
  });

  it('plano_do_cliente de um ano sem plano devolve zero linhas e não grava nada', async () => {
    const admin = await novoAdmin();
    const alvo = await criarPessoa({ email: emailUnico('vazio'), status: 'liberado' });
    const r = await admin.cliente.rpc('plano_do_cliente', { alvo: alvo.id, ano: 2027 });
    expect(r.error).toBeNull();
    expect(r.data).toEqual([]);
    expect(await planoNoBanco(alvo.id, 2027)).toBeNull();
  });

  it('ano 2025 e 9999 recusados; ano atual UTC + 1 aceito', async () => {
    const admin = await novoAdmin();
    const alvo = await criarPessoa({ email: emailUnico('alvo'), status: 'liberado' });
    for (const ano of [2025, 9999]) {
      const r = await admin.cliente.rpc('salvar_plano_do_cliente', { alvo: alvo.id, ano, dados: DADOS });
      expect(r.error?.code, `ano ${ano}`).toBe('22023');
      expect(r.error?.message, `ano ${ano}`).toContain('Ano do plano fora do permitido');
      expect(await planoNoBanco(alvo.id, ano)).toBeNull();
    }
    const ok = await admin.cliente.rpc('salvar_plano_do_cliente', { alvo: alvo.id, ano: anoUtc() + 1, dados: DADOS });
    expect(ok.error).toBeNull();
  });

  it('dados com mais de 1 MiB recusados (23514)', async () => {
    const admin = await novoAdmin();
    const alvo = await criarPessoa({ email: emailUnico('alvo'), status: 'liberado' });
    const grande = { planData: { texto: 'x'.repeat(1024 * 1024) } };
    const r = await admin.cliente.rpc('salvar_plano_do_cliente', { alvo: alvo.id, ano: 2026, dados: grande });
    expect(r.error?.code).toBe('23514');
    expect(await planoNoBanco(alvo.id, 2026)).toBeNull();
  });

  it('três gravações seguidas: uma linha "alterou plano", que guarda só {"ano": N}', async () => {
    const admin = await novoAdmin();
    const alvo = await criarPessoa({ email: emailUnico('alvo'), status: 'liberado' });
    for (let i = 0; i < 3; i++) {
      const r = await admin.cliente.rpc('salvar_plano_do_cliente', {
        alvo: alvo.id,
        ano: 2026,
        dados: { planData: { companyName: `v${i}` } },
      });
      expect(r.error).toBeNull();
    }
    const linhas = await registro(admin.email, alvo.id, 'alterou plano');
    expect(linhas).toHaveLength(1);
    expect(linhas[0].detalhe).toEqual({ ano: 2026 });
  });

  it('anos diferentes contam separado no agrupamento', async () => {
    const admin = await novoAdmin();
    const alvo = await criarPessoa({ email: emailUnico('alvo'), status: 'liberado' });
    await admin.cliente.rpc('salvar_plano_do_cliente', { alvo: alvo.id, ano: 2026, dados: DADOS });
    await admin.cliente.rpc('salvar_plano_do_cliente', { alvo: alvo.id, ano: 2027, dados: DADOS });
    const linhas = await registro(admin.email, alvo.id, 'alterou plano');
    expect(linhas.map((l) => l.detalhe)).toEqual([{ ano: 2026 }, { ano: 2027 }]);
  });

  it('gravação depois de 31 min da última linha: segunda linha', async () => {
    const admin = await novoAdmin();
    const alvo = await criarPessoa({ email: emailUnico('alvo'), status: 'liberado' });
    await admin.cliente.rpc('salvar_plano_do_cliente', { alvo: alvo.id, ano: 2026, dados: DADOS });
    const [primeira] = await registro(admin.email, alvo.id, 'alterou plano');
    const recuo = await clienteServico()
      .from('registro_admin')
      .update({ quando: new Date(Date.now() - 31 * 60 * 1000).toISOString() })
      .eq('id', primeira.id);
    expect(recuo.error).toBeNull();

    await admin.cliente.rpc('salvar_plano_do_cliente', { alvo: alvo.id, ano: 2026, dados: EDITADO });
    expect(await registro(admin.email, alvo.id, 'alterou plano')).toHaveLength(2);
  });

  it('abrir grava "abriu plano" uma vez por chamada', async () => {
    const admin = await novoAdmin();
    const alvo = await criarPessoa({ email: emailUnico('alvo'), status: 'liberado' });
    await clienteServico().from('planos').insert({ user_id: alvo.id, ano: 2026, dados: DADOS });
    await admin.cliente.rpc('plano_do_cliente', { alvo: alvo.id, ano: 2026 });
    await admin.cliente.rpc('plano_do_cliente', { alvo: alvo.id, ano: 2026 });
    const linhas = await registro(admin.email, alvo.id, 'abriu plano');
    expect(linhas).toHaveLength(2);
    expect(linhas[0].detalhe).toEqual({ ano: 2026 });
  });

  it('alvo igual a si mesmo: recusado nas três', async () => {
    const admin = await novoAdmin();
    expect((await admin.cliente.rpc('anos_do_cliente', { alvo: admin.id })).error?.code).toBe('42501');
    expect((await admin.cliente.rpc('plano_do_cliente', { alvo: admin.id, ano: 2026 })).error?.code).toBe('42501');
    const s = await admin.cliente.rpc('salvar_plano_do_cliente', { alvo: admin.id, ano: 2026, dados: DADOS });
    expect(s.error?.code).toBe('42501');
    expect(await planoNoBanco(admin.id, 2026)).toBeNull();
  });

  it('não admin nas três: 42501', async () => {
    const cliente = await criarPessoa({ email: emailUnico('cliente'), status: 'liberado' });
    const alvo = await criarPessoa({ email: emailUnico('alvo'), status: 'liberado' });
    await clienteServico().from('planos').insert({ user_id: alvo.id, ano: 2026, dados: DADOS });
    expect((await cliente.cliente.rpc('anos_do_cliente', { alvo: alvo.id })).error?.code).toBe('42501');
    expect((await cliente.cliente.rpc('plano_do_cliente', { alvo: alvo.id, ano: 2026 })).error?.code).toBe('42501');
    const s = await cliente.cliente.rpc('salvar_plano_do_cliente', { alvo: alvo.id, ano: 2026, dados: EDITADO });
    expect(s.error?.code).toBe('42501');
    expect((await planoNoBanco(alvo.id, 2026))!.dados).toEqual(DADOS);
  });

  it('cliente comum continua sem ler o plano de outro', async () => {
    const a = await criarPessoa({ email: emailUnico('a'), status: 'liberado' });
    const b = await criarPessoa({ email: emailUnico('b'), status: 'liberado' });
    await clienteServico().from('planos').insert({ user_id: b.id, ano: 2026, dados: DADOS });
    const lido = await a.cliente.from('planos').select('*').eq('user_id', b.id);
    expect(lido.data ?? []).toHaveLength(0);
  });
});
