import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./planos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./planos')>()),
  listarPlanos: vi.fn(),
  carregarPlano: vi.fn(),
  salvarPlano: vi.fn(),
}));
vi.mock('./planoDoCliente', () => ({
  anosDoCliente: vi.fn(),
  planoDoCliente: vi.fn(),
  salvarPlanoDoCliente: vi.fn(),
}));

import { carregarPlano, listarPlanos, salvarPlano, type DadosDoPlano } from './planos';
import { anosDoCliente, planoDoCliente, salvarPlanoDoCliente } from './planoDoCliente';
import { repositorioDoCliente, repositorioProprio } from './repositorioDoPlano';

const CLIENTE = { nome: 'supabase falso' } as any;
const DADOS = { pricingItems: [] } as unknown as DadosDoPlano;

beforeEach(() => vi.clearAllMocks());

describe('repositorioProprio: o plano de quem entrou, pelas tabelas', () => {
  it('anos, carregar e salvar chamam planos.ts com o uid', async () => {
    vi.mocked(listarPlanos).mockResolvedValue([2026, 2027]);
    vi.mocked(carregarPlano).mockResolvedValue({ taxes: {} } as any);
    vi.mocked(salvarPlano).mockResolvedValue(undefined);
    const r = repositorioProprio(CLIENTE, 'u1');

    expect(await r.anos()).toEqual([2026, 2027]);
    expect(listarPlanos).toHaveBeenCalledWith(CLIENTE, 'u1');
    expect(await r.carregar(2027)).toEqual({ dados: { taxes: {} }, atualizadoEm: null });
    expect(carregarPlano).toHaveBeenCalledWith(CLIENTE, 'u1', 2027);
    expect(await r.salvar(2027, DADOS)).toBeNull();
    expect(salvarPlano).toHaveBeenCalledWith(CLIENTE, 'u1', 2027, DADOS);
    expect(anosDoCliente).not.toHaveBeenCalled();
    expect(salvarPlanoDoCliente).not.toHaveBeenCalled();
  });

  it('sem plano salvo, carregar devolve null', async () => {
    vi.mocked(carregarPlano).mockResolvedValue(null);
    expect(await repositorioProprio(CLIENTE, 'u1').carregar(2027)).toBeNull();
  });
});

describe('repositorioDoCliente: o plano de um cliente, pelas funções do admin', () => {
  it('anos, carregar e salvar chamam planoDoCliente.ts com o alvo', async () => {
    const quando = new Date('2026-11-13T12:00:00Z');
    const gravado = new Date('2026-11-13T12:05:00Z');
    vi.mocked(anosDoCliente).mockResolvedValue([2027]);
    vi.mocked(planoDoCliente).mockResolvedValue({ dados: { taxes: {} } as any, atualizadoEm: quando });
    vi.mocked(salvarPlanoDoCliente).mockResolvedValue(gravado);
    const r = repositorioDoCliente(CLIENTE, 'c1');

    expect(await r.anos()).toEqual([2027]);
    expect(anosDoCliente).toHaveBeenCalledWith(CLIENTE, 'c1');
    expect(await r.carregar(2027)).toEqual({ dados: { taxes: {} }, atualizadoEm: quando });
    expect(planoDoCliente).toHaveBeenCalledWith(CLIENTE, 'c1', 2027);
    expect(await r.salvar(2027, DADOS)).toEqual(gravado);
    expect(salvarPlanoDoCliente).toHaveBeenCalledWith(CLIENTE, 'c1', 2027, DADOS);
    expect(listarPlanos).not.toHaveBeenCalled();
    expect(salvarPlano).not.toHaveBeenCalled();
  });
});
