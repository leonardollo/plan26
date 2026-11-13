import { describe, expect, it } from 'vitest';
import { clienteServico, criarPessoa, emailUnico } from './ambiente';

async function ehAdminNoBanco(email: string): Promise<boolean> {
  const { data, error } = await clienteServico().from('admins').select('email').eq('email', email).maybeSingle();
  if (error) throw error;
  return data !== null;
}

async function registroDoAdmin(adminEmail: string) {
  const { data, error } = await clienteServico()
    .from('registro_admin')
    .select('*')
    .eq('admin_email', adminEmail)
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
}

describe('administradores', () => {
  it('promover cliente liberado: aparece em listar_admins e sou_admin() vira true para ele', async () => {
    const adminEmail = emailUnico('admin');
    const admin = await criarPessoa({ email: adminEmail, admin: true });
    const email = emailUnico('cliente');
    const cliente = await criarPessoa({ email, status: 'liberado', nome: 'Carla' });

    const r = await admin.cliente.rpc('promover_admin', { email });
    expect(r.error).toBeNull();

    const lista = await admin.cliente.rpc('listar_admins');
    expect(lista.error).toBeNull();
    expect(lista.data).toContainEqual({ email, user_id: cliente.id, nome: 'Carla' });
    expect((await cliente.cliente.rpc('sou_admin')).data).toBe(true);
    expect(await registroDoAdmin(adminEmail)).toEqual([
      expect.objectContaining({ acao: 'promoveu admin', alvo: cliente.id, alvo_email: email }),
    ]);
  });

  it('listar_admins traz admin sem conta com user_id e nome nulos', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const semConta = emailUnico('sem-conta');
    await clienteServico().from('admins').insert({ email: semConta });
    const lista = await admin.cliente.rpc('listar_admins');
    expect(lista.data).toContainEqual({ email: semConta, user_id: null, nome: null });
  });

  it('promover com " Ana@X.com " acha a conta ana@x.com', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const email = emailUnico('ana');
    await criarPessoa({ email, status: 'liberado' });

    const r = await admin.cliente.rpc('promover_admin', { email: `  ${email.toUpperCase()} ` });
    expect(r.error).toBeNull();
    expect(await ehAdminNoBanco(email)).toBe(true);
  });

  it('promover e-mail sem conta: recusado com "adicione como cliente antes"', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const email = emailUnico('ninguem');
    const r = await admin.cliente.rpc('promover_admin', { email });
    expect(r.error?.message).toContain('adicione como cliente antes');
    expect(await ehAdminNoBanco(email)).toBe(false);
  });

  it('promover cliente removido: recusado', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const email = emailUnico('removido');
    await criarPessoa({ email, status: 'removido' });
    const r = await admin.cliente.rpc('promover_admin', { email });
    expect(r.error).not.toBeNull();
    expect(await ehAdminNoBanco(email)).toBe(false);
  });

  it('promover quem já é admin: nada muda e não grava no Registro', async () => {
    const adminEmail = emailUnico('admin');
    const admin = await criarPessoa({ email: adminEmail, admin: true });
    const outro = emailUnico('outro-admin');
    await criarPessoa({ email: outro, admin: true });
    const r = await admin.cliente.rpc('promover_admin', { email: outro });
    expect(r.error).toBeNull();
    expect(await ehAdminNoBanco(outro)).toBe(true);
    expect(await registroDoAdmin(adminEmail)).toHaveLength(0);
  });

  it('rebaixar outro admin: deixa de ser admin e grava "rebaixou admin"', async () => {
    const adminEmail = emailUnico('admin');
    const admin = await criarPessoa({ email: adminEmail, admin: true });
    const outro = emailUnico('outro-admin');
    const pessoa = await criarPessoa({ email: outro, admin: true });
    const r = await admin.cliente.rpc('rebaixar_admin', { email: ` ${outro.toUpperCase()}` });
    expect(r.error).toBeNull();
    expect(await ehAdminNoBanco(outro)).toBe(false);
    expect(await registroDoAdmin(adminEmail)).toEqual([
      expect.objectContaining({ acao: 'rebaixou admin', alvo: pessoa.id, alvo_email: outro }),
    ]);
  });

  it('rebaixar a si mesmo: recusado', async () => {
    const adminEmail = emailUnico('admin');
    const admin = await criarPessoa({ email: adminEmail, admin: true });
    const r = await admin.cliente.rpc('rebaixar_admin', { email: adminEmail });
    expect(r.error?.code).toBe('42501');
    expect(r.error?.message).toContain('si mesmo');
    expect(await ehAdminNoBanco(adminEmail)).toBe(true);
  });

  it('dois admins se rebaixando ao mesmo tempo: um consegue, o outro é recusado', async () => {
    const emailA = emailUnico('admin-a');
    const emailB = emailUnico('admin-b');
    const a = await criarPessoa({ email: emailA, admin: true });
    const b = await criarPessoa({ email: emailB, admin: true });

    const resultados = await Promise.all([
      a.cliente.rpc('rebaixar_admin', { email: emailB }),
      b.cliente.rpc('rebaixar_admin', { email: emailA }),
    ]);
    const semErro = resultados.filter((r) => r.error === null);
    expect(semErro).toHaveLength(1);
    const comErro = resultados.find((r) => r.error !== null)!;
    expect(comErro.error?.code).toBe('42501');
    const restantes = [await ehAdminNoBanco(emailA), await ehAdminNoBanco(emailB)].filter(Boolean);
    expect(restantes).toHaveLength(1);
  });

  it('não admin chamando cada uma: 42501', async () => {
    const cliente = await criarPessoa({ email: emailUnico('cliente'), status: 'liberado' });
    const alvo = emailUnico('alvo');
    await criarPessoa({ email: alvo, status: 'liberado' });
    const adminEmail = emailUnico('admin');
    await criarPessoa({ email: adminEmail, admin: true });

    expect((await cliente.cliente.rpc('listar_admins')).error?.code).toBe('42501');
    expect((await cliente.cliente.rpc('promover_admin', { email: alvo })).error?.code).toBe('42501');
    expect((await cliente.cliente.rpc('rebaixar_admin', { email: adminEmail })).error?.code).toBe('42501');
    expect(await ehAdminNoBanco(alvo)).toBe(false);
    expect(await ehAdminNoBanco(adminEmail)).toBe(true);
  });
});
