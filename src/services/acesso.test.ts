import { describe, expect, it, vi } from 'vitest';
import {
  ehAdministrador, listarAdmins, listarRegistro, obterAcesso, promoverAdmin, quando, rebaixarAdmin, rotuloEmailVerificado,
  definirPrazo, tirarPrazo,
} from './acesso';

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
      liberado_em: null, liberado_por: null, email_verificado: false, acesso_ate: '2027-11-13T10:00:00Z',
    };
    expect(await obterAcesso(cliente({ data: linha, error: null }), 'u')).toEqual({
      uid: 'u', email: 'a@x.com', nome: '', status: 'liberado', criadoEm: '2026-11-12T10:00:00Z',
      liberadoEm: null, liberadoPor: null, emailVerificado: false, acessoAte: '2027-11-13T10:00:00Z',
    });
  });

  it('linha sem acesso_ate → acessoAte null (sem prazo)', async () => {
    const linha = { user_id: 'u', email: 'a@x.com', nome: 'A', status: 'liberado', criado_em: null };
    expect((await obterAcesso(cliente({ data: linha, error: null }), 'u'))?.acessoAte).toBeNull();
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

describe('administradores e Registro', () => {
  it('listarAdmins converte as linhas', async () => {
    const cliente = {
      rpc: vi.fn(async () => ({ data: [{ email: 'a@gi.com', user_id: 'u1', nome: 'Ana' }, { email: 'b@gi.com', user_id: null, nome: null }], error: null })),
    } as any;
    expect(await listarAdmins(cliente)).toEqual([
      { email: 'a@gi.com', uid: 'u1', nome: 'Ana' },
      { email: 'b@gi.com', uid: null, nome: null },
    ]);
    expect(cliente.rpc).toHaveBeenCalledWith('listar_admins');
  });

  it('promoverAdmin e rebaixarAdmin chamam a RPC com o e-mail e lançam o erro do banco', async () => {
    const ok = { rpc: vi.fn(async () => ({ data: null, error: null })) } as any;
    await promoverAdmin(ok, 'a@gi.com');
    expect(ok.rpc).toHaveBeenCalledWith('promover_admin', { email: 'a@gi.com' });
    await rebaixarAdmin(ok, 'a@gi.com');
    expect(ok.rpc).toHaveBeenCalledWith('rebaixar_admin', { email: 'a@gi.com' });
    const recusa = { rpc: vi.fn(async () => ({ data: null, error: { code: '42501', message: 'o último administrador não é rebaixado' } })) } as any;
    await expect(rebaixarAdmin(recusa, 'a@gi.com')).rejects.toMatchObject({ code: '42501' });
  });

  function clienteDoRegistro(linhas: unknown[]) {
    const chamadas: Array<[string, ...unknown[]]> = [];
    const consulta: any = {
      select: (...a: unknown[]) => (chamadas.push(['select', ...a]), consulta),
      order: (...a: unknown[]) => (chamadas.push(['order', ...a]), consulta),
      limit: (...a: unknown[]) => (chamadas.push(['limit', ...a]), consulta),
      eq: (...a: unknown[]) => (chamadas.push(['eq', ...a]), consulta),
      then: (r: (v: unknown) => unknown) => r({ data: linhas, error: null }),
    };
    return { cliente: { from: vi.fn(() => consulta) } as any, chamadas };
  }

  const linha = {
    id: 7, quando: '2026-11-13T12:00:00Z', admin_email: 'a@gi.com', acao: 'liberou', alvo: 'u2', alvo_email: 'c@x.com',
    detalhe: { de: 'pendente', para: 'liberado' },
  };

  it('listarRegistro sem alvo: mais novas primeiro, limite 200, datas convertidas', async () => {
    const { cliente, chamadas } = clienteDoRegistro([linha]);
    expect(await listarRegistro(cliente)).toEqual([
      { id: 7, quando: new Date('2026-11-13T12:00:00Z'), adminEmail: 'a@gi.com', acao: 'liberou', alvo: 'u2', alvoEmail: 'c@x.com', detalhe: { de: 'pendente', para: 'liberado' } },
    ]);
    expect(cliente.from).toHaveBeenCalledWith('registro_admin');
    expect(chamadas).toContainEqual(['order', 'quando', { ascending: false }]);
    expect(chamadas).toContainEqual(['limit', 200]);
    expect(chamadas.some((c) => c[0] === 'eq')).toBe(false);
  });

  it('listarRegistro com alvo filtra por ele', async () => {
    const { cliente, chamadas } = clienteDoRegistro([{ ...linha, detalhe: null }]);
    const [acao] = await listarRegistro(cliente, 'u2');
    expect(acao.detalhe).toEqual({});
    expect(chamadas).toContainEqual(['eq', 'alvo', 'u2']);
  });
});

describe('definirPrazo', () => {
  it('chama admin_definir_prazo com alvo e dia; devolve o prazo gravado; erro do banco lança', async () => {
    const rpc = vi.fn(async () => ({ data: '2027-11-14T02:59:59.999999+00:00', error: null }));
    expect(await definirPrazo({ rpc } as any, 'u1', '2027-11-13')).toBe('2027-11-14T02:59:59.999999+00:00');
    expect(rpc).toHaveBeenCalledWith('admin_definir_prazo', { alvo: 'u1', dia: '2027-11-13' });
    const falha = vi.fn(async () => ({ data: null, error: { code: '22023' } }));
    await expect(definirPrazo({ rpc: falha } as any, 'u1', '2026-11-13')).rejects.toMatchObject({ code: '22023' });
  });
});

describe('tirarPrazo', () => {
  it('chama admin_tirar_prazo com o alvo; erro do banco lança', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    await tirarPrazo({ rpc } as any, 'u1');
    expect(rpc).toHaveBeenCalledWith('admin_tirar_prazo', { alvo: 'u1' });
    const falha = vi.fn(async () => ({ data: null, error: { code: '42501' } }));
    await expect(tirarPrazo({ rpc: falha } as any, 'u1')).rejects.toMatchObject({ code: '42501' });
  });
});
