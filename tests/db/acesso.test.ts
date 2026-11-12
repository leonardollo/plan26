import { describe, expect, it } from 'vitest';
import { clienteAnonimo, criarPessoa, emailUnico, SENHA } from './ambiente';
import { definirStatus, ehAdministrador, listarAcessos, obterAcesso } from '../../src/services/acesso';

describe('acessos no Supabase', () => {
  it('ehAdministrador: true para o admin confirmado, false para o cliente', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const cliente = await criarPessoa({ email: emailUnico('cliente'), status: 'liberado' });
    expect(await ehAdministrador(admin.cliente)).toBe(true);
    expect(await ehAdministrador(cliente.cliente)).toBe(false);
  });

  it('obterAcesso de um cadastro novo devolve pendente', async () => {
    const { id, cliente } = await criarPessoa({ email: emailUnico('novo'), nome: 'Ana' });
    const acesso = await obterAcesso(cliente, id);
    expect(acesso).toMatchObject({ uid: id, status: 'pendente', nome: 'Ana', emailVerificado: true });
  });

  it('listarAcessos pelo admin traz o cadastro mais novo primeiro', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const email = emailUnico('cadastro');
    const { error } = await clienteAnonimo().auth.signUp({ email, password: SENHA, options: { data: { name: 'Bia' } } });
    expect(error).toBeNull();
    const lista = await listarAcessos(admin.cliente);
    expect(lista[0]).toMatchObject({ email, nome: 'Bia', status: 'pendente', emailVerificado: false });
  });

  it('definirStatus: o admin muda o status; o cliente é recusado', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true });
    const alvo = await criarPessoa({ email: emailUnico('alvo') });
    await definirStatus(admin.cliente, alvo.id, 'liberado');
    expect((await obterAcesso(alvo.cliente, alvo.id))?.status).toBe('liberado');

    const outro = await criarPessoa({ email: emailUnico('outro'), status: 'liberado' });
    await expect(definirStatus(outro.cliente, alvo.id, 'bloqueado')).rejects.toBeTruthy();
    expect((await obterAcesso(alvo.cliente, alvo.id))?.status).toBe('liberado');
  });
});
