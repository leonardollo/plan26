import { describe, expect, it, vi } from 'vitest';
import { anosDoCliente, planoDoCliente, salvarPlanoDoCliente } from './planoDoCliente';
import type { DadosDoPlano } from './planos';

// O banco de verdade está em tests/db/admin-plano.test.ts; aqui só a chamada e a conversão.
const rpc = (resposta: { data: unknown; error: unknown }) => ({ rpc: vi.fn(async () => resposta) }) as any;

describe('anosDoCliente', () => {
  it('chama anos_do_cliente e devolve números', async () => {
    const c = rpc({ data: [2026, 2027], error: null });
    expect(await anosDoCliente(c, 'u')).toEqual([2026, 2027]);
    expect(c.rpc).toHaveBeenCalledWith('anos_do_cliente', { alvo: 'u' });
  });

  it('erro do banco lança', async () => {
    await expect(anosDoCliente(rpc({ data: null, error: { code: '42501' } }), 'u')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('planoDoCliente', () => {
  it('converte dados e data; sem linha devolve null', async () => {
    const c = rpc({ data: [{ dados: { taxes: {} }, atualizado_em: '2026-11-13T12:00:00Z' }], error: null });
    expect(await planoDoCliente(c, 'u', 2027)).toEqual({ dados: { taxes: {} }, atualizadoEm: new Date('2026-11-13T12:00:00Z') });
    expect(c.rpc).toHaveBeenCalledWith('plano_do_cliente', { alvo: 'u', ano: 2027 });
    expect(await planoDoCliente(rpc({ data: [], error: null }), 'u', 2027)).toBeNull();
  });
});

describe('salvarPlanoDoCliente', () => {
  it('chama salvar_plano_do_cliente e devolve a data gravada', async () => {
    const c = rpc({ data: '2026-11-13T12:05:00Z', error: null });
    const dados = { pricingItems: [] } as unknown as DadosDoPlano;
    expect(await salvarPlanoDoCliente(c, 'u', 2027, dados)).toEqual(new Date('2026-11-13T12:05:00Z'));
    expect(c.rpc).toHaveBeenCalledWith('salvar_plano_do_cliente', { alvo: 'u', ano: 2027, dados });
  });

  it('erro do banco lança', async () => {
    const dados = {} as DadosDoPlano;
    await expect(salvarPlanoDoCliente(rpc({ data: null, error: { code: '22023' } }), 'u', 2040, dados)).rejects.toMatchObject({ code: '22023' });
  });
});
