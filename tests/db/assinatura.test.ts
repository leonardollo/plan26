// Assinatura pela Hotmart: a regra de prazo em aplicar_pagamento_hotmart, o prazo em posso_usar_o_espaco
// e as permissões. Spec: docs/superpowers/specs/2026-11-13-assinatura-hotmart-design.md (exemplos numerados).
// O banco não deixa fixar "hoje": cada caso grava acesso_ate relativo ao relógio e compara com tolerância.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { clienteAnonimo, clienteServico, criarPessoa, emailUnico, type StatusAcesso } from './ambiente';

const DIA = 24 * 60 * 60 * 1000;
const TOLERANCIA = 60 * 1000;
const DADOS = { planData: { companyName: 'Plano do cliente' } };

type Resultado = { resultado: string; user_id: string | null; antes: string | null; depois: string | null };

function transacaoNova(): string {
  return `HP${randomUUID().slice(0, 12)}`;
}

function maisAnos(base: Date, anos: number): Date {
  const d = new Date(base);
  d.setUTCFullYear(d.getUTCFullYear() + anos);
  return d;
}

function perto(recebido: string | null, esperado: Date) {
  expect(recebido).not.toBeNull();
  expect(Math.abs(new Date(recebido!).getTime() - esperado.getTime())).toBeLessThan(TOLERANCIA);
}

async function aplicar(transacao: string, email: string, tipo: string, evento = 'PURCHASE_APPROVED'): Promise<Resultado> {
  const { data, error } = await clienteServico().rpc('aplicar_pagamento_hotmart', {
    p_transacao: transacao,
    p_email: email,
    p_tipo: tipo,
    p_evento: evento,
  });
  if (error) throw error;
  return data as Resultado;
}

async function acesso(userId: string) {
  const { data, error } = await clienteServico().from('acessos').select('*').eq('user_id', userId).single();
  if (error) throw error;
  return data as { status: StatusAcesso; acesso_ate: string | null; liberado_por: string | null };
}

async function definirPrazo(userId: string, quando: Date | null) {
  const { error } = await clienteServico()
    .from('acessos')
    .update({ acesso_ate: quando?.toISOString() ?? null })
    .eq('user_id', userId);
  if (error) throw error;
}

async function pagamento(transacao: string) {
  const { data, error } = await clienteServico().from('pagamentos_hotmart').select('*').eq('transacao', transacao);
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

describe('aplicar_pagamento_hotmart: aprova', () => {
  it('ex1/ex4: aprova estende a partir do maior entre agora e o prazo', async () => {
    const email = emailUnico('renova');
    const pessoa = await criarPessoa({ email, status: 'liberado' });
    await definirPrazo(pessoa.id, new Date(Date.now() + 30 * DIA));

    const r = await aplicar(transacaoNova(), email, 'aprova');
    expect(r.resultado).toBe('estendeu');
    expect(r.user_id).toBe(pessoa.id);
    expect(new Date(r.depois!).getTime()).toBe(maisAnos(new Date(r.antes!), 1).getTime());
    expect((await acesso(pessoa.id)).acesso_ate).not.toBeNull();
    expect(new Date((await acesso(pessoa.id)).acesso_ate!).getTime()).toBe(new Date(r.depois!).getTime());

    // ex5: prazo vencido há 60 dias conta a partir de agora.
    const emailVencido = emailUnico('vencido');
    const vencida = await criarPessoa({ email: emailVencido, status: 'liberado' });
    await definirPrazo(vencida.id, new Date(Date.now() - 60 * DIA));
    const r2 = await aplicar(transacaoNova(), emailVencido, 'aprova');
    expect(r2.resultado).toBe('estendeu');
    perto(r2.depois, maisAnos(new Date(), 1));

    const registro = await registroDo(pessoa.id);
    expect(registro.map((l) => l.acao)).toEqual(['pagamento estendeu']);
    expect(registro[0]).toMatchObject({ admin_email: 'hotmart', alvo_email: email });
    expect(registro[0].detalhe).toMatchObject({ evento: 'PURCHASE_APPROVED' });
    expect(registro[0].detalhe.antes).not.toBeNull();
    expect(registro[0].detalhe.depois).not.toBeNull();
  });

  it('ex2/ex3: mesma transação conta uma vez', async () => {
    const email = emailUnico('repete');
    const pessoa = await criarPessoa({ email });
    const transacao = transacaoNova();

    const r1 = await aplicar(transacao, email, 'aprova', 'PURCHASE_APPROVED');
    expect(r1.resultado).toBe('liberou');
    const prazo = (await acesso(pessoa.id)).acesso_ate;

    const r2 = await aplicar(transacao, email, 'aprova', 'PURCHASE_COMPLETE');
    expect(r2.resultado).toBe('repetido');
    const r3 = await aplicar(transacao, email, 'aprova', 'PURCHASE_APPROVED');
    expect(r3.resultado).toBe('repetido');
    expect((await acesso(pessoa.id)).acesso_ate).toBe(prazo);
    expect(await pagamento(transacao)).toHaveLength(1);
  });

  it('pendente vira liberado por um ano', async () => {
    const email = emailUnico('pendente');
    const pessoa = await criarPessoa({ email });
    const transacao = transacaoNova();

    const r = await aplicar(transacao, email, 'aprova');
    expect(r.resultado).toBe('liberou');
    expect(r.antes).toBeNull();
    const linha = await acesso(pessoa.id);
    expect(linha.status).toBe('liberado');
    expect(linha.liberado_por).toBe('hotmart');
    perto(linha.acesso_ate, maisAnos(new Date(), 1));

    const [pag] = await pagamento(transacao);
    expect(pag).toMatchObject({ situacao: 'aprovada', user_id: pessoa.id, mexeu_no_prazo: true, email });
    expect((await registroDo(pessoa.id)).map((l) => l.acao)).toEqual(['pagamento liberou']);
  });

  it('e-mail com caixa e espaços acha a conta', async () => {
    const email = emailUnico('caixa');
    const pessoa = await criarPessoa({ email });
    const transacao = transacaoNova();
    const r = await aplicar(transacao, `  ${email.toUpperCase()} `, 'aprova');
    expect(r.user_id).toBe(pessoa.id);
    expect((await pagamento(transacao))[0].email).toBe(email);
  });

  it('ex8: sem prazo continua sem prazo, e o estorno dela não mexe', async () => {
    const email = emailUnico('antigo');
    const pessoa = await criarPessoa({ email, status: 'liberado' });
    const transacao = transacaoNova();

    const r = await aplicar(transacao, email, 'aprova');
    expect(r.resultado).toBe('sem_prazo');
    expect((await acesso(pessoa.id)).acesso_ate).toBeNull();
    expect((await pagamento(transacao))[0]).toMatchObject({ situacao: 'aprovada', mexeu_no_prazo: false });

    const e = await aplicar(transacao, email, 'estorna', 'PURCHASE_REFUNDED');
    expect(e.resultado).toBe('estorno_sem_efeito');
    expect((await acesso(pessoa.id)).acesso_ate).toBeNull();
    expect((await pagamento(transacao))[0].situacao).toBe('estornada');
  });

  it('ex9: conta bloqueada ou removida não reabre', async () => {
    for (const status of ['bloqueado', 'removido'] as const) {
      const email = emailUnico(status);
      const pessoa = await criarPessoa({ email, status });
      const transacao = transacaoNova();
      const r = await aplicar(transacao, email, 'aprova');
      expect(r.resultado, status).toBe('conta_barrada');
      const linha = await acesso(pessoa.id);
      expect(linha.status).toBe(status);
      expect(linha.acesso_ate).toBeNull();
      expect((await pagamento(transacao))[0]).toMatchObject({ situacao: 'aprovada', mexeu_no_prazo: false });
      const registro = await registroDo(pessoa.id);
      expect(registro).toHaveLength(1);
      expect(registro[0]).toMatchObject({ acao: 'pagamento de conta barrada', admin_email: 'hotmart' });
      expect(registro[0].detalhe).toMatchObject({ transacao });
    }
  });

  it('ex13: duas transações ao mesmo tempo contam dois anos', async () => {
    const email = emailUnico('duas');
    const pessoa = await criarPessoa({ email });
    const resultados = await Promise.all([
      aplicar(transacaoNova(), email, 'aprova'),
      aplicar(transacaoNova(), email, 'aprova'),
    ]);
    expect(resultados.map((r) => r.resultado).sort()).toEqual(['estendeu', 'liberou']);
    perto((await acesso(pessoa.id)).acesso_ate, maisAnos(new Date(), 2));
  });

  it('sem conta devolve sem_conta e não grava a transação', async () => {
    const transacao = transacaoNova();
    const r = await aplicar(transacao, emailUnico('ninguem'), 'aprova');
    expect(r).toMatchObject({ resultado: 'sem_conta', user_id: null });
    expect(await pagamento(transacao)).toHaveLength(0);
  });

  it('tipo inválido dá erro', async () => {
    const { error } = await clienteServico().rpc('aplicar_pagamento_hotmart', {
      p_transacao: transacaoNova(),
      p_email: emailUnico('tipo'),
      p_tipo: 'libera',
      p_evento: 'PURCHASE_APPROVED',
    });
    expect(error?.code).toBe('22023');
  });
});

describe('aplicar_pagamento_hotmart: estorna', () => {
  it('ex6: estorno da renovação devolve o prazo', async () => {
    const email = emailUnico('estorno');
    const pessoa = await criarPessoa({ email, status: 'liberado' });
    await definirPrazo(pessoa.id, new Date(Date.now() + 40 * DIA));
    const original = (await acesso(pessoa.id)).acesso_ate;
    const transacao = transacaoNova();
    await aplicar(transacao, email, 'aprova');

    const e = await aplicar(transacao, email, 'estorna', 'PURCHASE_REFUNDED');
    expect(e.resultado).toBe('estornou');
    expect(new Date((await acesso(pessoa.id)).acesso_ate!).getTime()).toBe(new Date(original!).getTime());
    expect((await pagamento(transacao))[0]).toMatchObject({ situacao: 'estornada', evento: 'PURCHASE_REFUNDED' });
    expect((await registroDo(pessoa.id)).map((l) => l.acao)).toEqual(['pagamento estendeu', 'estorno']);

    const de_novo = await aplicar(transacao, email, 'estorna', 'PURCHASE_CHARGEBACK');
    expect(de_novo.resultado).toBe('estorno_sem_efeito');
    expect(new Date((await acesso(pessoa.id)).acesso_ate!).getTime()).toBe(new Date(original!).getTime());
  });

  it('ex7: estorno que cai no passado vence na hora', async () => {
    const email = emailUnico('primeira');
    const pessoa = await criarPessoa({ email });
    const transacao = transacaoNova();
    await aplicar(transacao, email, 'aprova');
    // Dez dias depois da compra: o prazo cai para 10 dias atrás.
    await definirPrazo(pessoa.id, maisAnos(new Date(Date.now() - 10 * DIA), 1));

    const e = await aplicar(transacao, email, 'estorna', 'PURCHASE_REFUNDED');
    expect(e.resultado).toBe('estornou');
    expect(new Date((await acesso(pessoa.id)).acesso_ate!).getTime()).toBeLessThan(Date.now());
    const pode = await pessoa.cliente.rpc('posso_usar_o_espaco');
    expect(pode.data).toBe(false);
  });

  it('ex12: estorno antes da aprovação anula a aprovação', async () => {
    const email = emailUnico('antes');
    const pessoa = await criarPessoa({ email });
    const transacao = transacaoNova();

    const e = await aplicar(transacao, email, 'estorna', 'PURCHASE_CHARGEBACK');
    expect(e.resultado).toBe('estorno_sem_efeito');
    expect((await pagamento(transacao))[0]).toMatchObject({ situacao: 'estornada', user_id: null });

    const r = await aplicar(transacao, email, 'aprova');
    expect(r.resultado).toBe('repetido');
    const linha = await acesso(pessoa.id);
    expect(linha.status).toBe('pendente');
    expect(linha.acesso_ate).toBeNull();
  });

  it('estorno de conta que o admin deixou sem prazo continua sem prazo', async () => {
    const email = emailUnico('tirado');
    const pessoa = await criarPessoa({ email });
    const transacao = transacaoNova();
    await aplicar(transacao, email, 'aprova');
    await definirPrazo(pessoa.id, null);

    const e = await aplicar(transacao, email, 'estorna', 'PURCHASE_REFUNDED');
    expect(e.resultado).toBe('estorno_sem_efeito');
    expect((await acesso(pessoa.id)).acesso_ate).toBeNull();
  });
});

describe('prazo nas permissões', () => {
  it('posso_usar_o_espaco: vencido barra, futuro passa, admin vencido passa', async () => {
    const vencida = await criarPessoa({ email: emailUnico('vencida'), status: 'liberado' });
    await definirPrazo(vencida.id, new Date(Date.now() - 1000));
    expect((await vencida.cliente.rpc('posso_usar_o_espaco')).data).toBe(false);

    const futura = await criarPessoa({ email: emailUnico('futura'), status: 'liberado' });
    await definirPrazo(futura.id, new Date(Date.now() + DIA));
    expect((await futura.cliente.rpc('posso_usar_o_espaco')).data).toBe(true);

    const admin = await criarPessoa({ email: emailUnico('admin'), status: 'liberado', admin: true });
    await definirPrazo(admin.id, new Date(Date.now() - DIA));
    expect((await admin.cliente.rpc('posso_usar_o_espaco')).data).toBe(true);
  });

  it('planos: cliente vencido não lê nem grava o próprio plano', async () => {
    const vencida = await criarPessoa({ email: emailUnico('vencida'), status: 'liberado' });
    await clienteServico().from('planos').insert({ user_id: vencida.id, ano: 2026, dados: DADOS });
    await definirPrazo(vencida.id, new Date(Date.now() - 1000));

    const lido = await vencida.cliente.from('planos').select('*').eq('user_id', vencida.id);
    expect(lido.data ?? []).toHaveLength(0);
    const ups = await vencida.cliente.from('planos').upsert({ user_id: vencida.id, ano: 2027, dados: DADOS });
    expect(ups.error?.code).toBe('42501');
  });
});

describe('permissões da assinatura', () => {
  it('authenticated e anon não leem pagamentos_hotmart nem executam aplicar_pagamento_hotmart', async () => {
    const email = emailUnico('curioso');
    const pessoa = await criarPessoa({ email, status: 'liberado', admin: true });
    await aplicar(transacaoNova(), email, 'aprova');
    const args = { p_transacao: transacaoNova(), p_email: email, p_tipo: 'aprova', p_evento: 'PURCHASE_APPROVED' };

    for (const [nome, cliente] of [
      ['authenticated', pessoa.cliente],
      ['anon', clienteAnonimo()],
    ] as const) {
      const lido = await cliente.from('pagamentos_hotmart').select('*');
      expect(lido.data ?? [], nome).toHaveLength(0);
      const rpc = await cliente.rpc('aplicar_pagamento_hotmart', args);
      expect(rpc.error, nome).not.toBeNull();
    }
    expect(await pagamento(args.p_transacao)).toHaveLength(0);
  });

  it("admin_tirar_prazo: cliente recebe 42501; admin tira o prazo e o Registro mostra 'tirou prazo'", async () => {
    const adminEmail = emailUnico('admin');
    const admin = await criarPessoa({ email: adminEmail, admin: true });
    const alvo = await criarPessoa({ email: emailUnico('alvo'), status: 'liberado' });
    const prazo = new Date(Date.now() + 10 * DIA);
    await definirPrazo(alvo.id, prazo);

    const pelaCliente = await alvo.cliente.rpc('admin_tirar_prazo', { alvo: alvo.id });
    expect(pelaCliente.error?.code).toBe('42501');
    expect((await acesso(alvo.id)).acesso_ate).not.toBeNull();

    const pelaAdmin = await admin.cliente.rpc('admin_tirar_prazo', { alvo: alvo.id });
    expect(pelaAdmin.error).toBeNull();
    expect((await acesso(alvo.id)).acesso_ate).toBeNull();
    const registro = await registroDo(alvo.id);
    expect(registro).toHaveLength(1);
    expect(registro[0]).toMatchObject({ acao: 'tirou prazo', admin_email: adminEmail });
    expect(new Date(registro[0].detalhe.antes).getTime()).toBe(prazo.getTime());
  });
});
