import { describe, expect, it, vi } from 'vitest';
import { ehAdministrador, obterAcesso, quando, rotuloEmailVerificado } from './acesso';

// O banco de verdade está em tests/db/acesso.test.ts; aqui só o que o cliente faz com a resposta.
describe('ehAdministrador', () => {
  it('erro na consulta conta como não admin', async () => {
    const cliente = { rpc: vi.fn(async () => ({ data: null, error: { message: 'rede' } })) } as any;
    expect(await ehAdministrador(cliente)).toBe(false);
    expect(cliente.rpc).toHaveBeenCalledWith('sou_admin');
  });
});

describe('obterAcesso', () => {
  function cliente(resposta: { data: unknown; error: unknown }) {
    const consulta: any = { select: () => consulta, eq: () => consulta, maybeSingle: async () => resposta };
    return { from: () => consulta } as any;
  }

  it('converte a linha do banco', async () => {
    const linha = {
      user_id: 'u', email: 'a@x.com', nome: null, status: 'liberado', criado_em: '2026-11-12T10:00:00Z',
      liberado_em: null, liberado_por: null, email_verificado: false,
    };
    expect(await obterAcesso(cliente({ data: linha, error: null }), 'u')).toEqual({
      uid: 'u', email: 'a@x.com', nome: '', status: 'liberado', criadoEm: '2026-11-12T10:00:00Z',
      liberadoEm: null, liberadoPor: null, emailVerificado: false,
    });
  });

  it('sem linha devolve null; erro do banco lança', async () => {
    expect(await obterAcesso(cliente({ data: null, error: null }), 'u')).toBeNull();
    await expect(obterAcesso(cliente({ data: null, error: { code: '42501' } }), 'u')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('quando', () => {
  it('texto ISO, carimbo antigo do Firestore e vazio', () => {
    const esperado = (d: Date) =>
      d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const d = new Date('2026-11-12T10:00:00Z');
    expect(quando('2026-11-12T10:00:00Z')).toBe(esperado(d));
    expect(quando({ seconds: d.getTime() / 1000 })).toBe(esperado(d));
    expect(quando(null)).toBe('—');
    expect(quando('não é data')).toBe('—');
  });
});

describe('rotuloEmailVerificado', () => {
  it('sim, não e pedido antigo sem o campo', () => {
    expect(rotuloEmailVerificado(true)).toBe('Sim');
    expect(rotuloEmailVerificado(false)).toBe('Não');
    expect(rotuloEmailVerificado(undefined)).toBe('—');
  });
});
