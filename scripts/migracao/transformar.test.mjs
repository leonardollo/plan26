// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { paraJson, transformar } from './transformar.mjs';

function entrada(parcial = {}) {
  return {
    usuariosAuth: [{ uid: 'u1', email: 'ana@x.com', nome: 'Ana', provedores: ['password'] }],
    admins: [],
    acessos: [],
    documentosDeUsuario: [],
    planosPorAno: [],
    ...parcial,
  };
}

const temAviso = (m, trecho) => m.avisos.some((a) => a.includes(trecho));

describe('transformar', () => {
  it('users/u1 vira o plano de 2026 e planos/2027 o de 2027, os dois com o e-mail de u1', () => {
    const m = transformar(
      entrada({
        documentosDeUsuario: [{ uid: 'u1', campos: { planData: { a: 1 } }, subcolecoes: ['planos'] }],
        planosPorAno: [{ uid: 'u1', ano: '2027', campos: { goals2026: { b: 2 } } }],
      }),
    );
    expect(m.planos).toEqual([
      { email: 'ana@x.com', ano: 2026, dados: { planData: { a: 1 } } },
      { email: 'ana@x.com', ano: 2027, dados: { goals2026: { b: 2 } } },
    ]);
    expect(m.avisos).toEqual([]);
    expect(m.impedimentos).toEqual([]);
  });

  it('só os seis blocos do plano vão para dados; outro campo vira aviso com o nome', () => {
    const campos = {
      planData: 1, goals2026: 2, scenarios2026: 3, tracking2026: 4, taxes: 5, pricingItems: 6, apiKeyAntiga: 'x',
    };
    const m = transformar(entrada({ documentosDeUsuario: [{ uid: 'u1', campos, subcolecoes: [] }] }));
    expect(m.planos[0].dados).toEqual({ planData: 1, goals2026: 2, scenarios2026: 3, tracking2026: 4, taxes: 5, pricingItems: 6 });
    expect(temAviso(m, 'apiKeyAntiga')).toBe(true);
  });

  it('e-mail Ana@X.com vira ana@x.com em usuários, acessos e planos', () => {
    const m = transformar(
      entrada({
        usuariosAuth: [{ uid: 'u1', email: 'Ana@X.com', nome: null, provedores: ['password'] }],
        acessos: [{ uid: 'u1', status: 'liberado', liberadoEm: null, liberadoPor: null }],
        documentosDeUsuario: [{ uid: 'u1', campos: { planData: {} }, subcolecoes: [] }],
      }),
    );
    expect(m.usuarios[0].email).toBe('ana@x.com');
    expect(m.acessos[0].email).toBe('ana@x.com');
    expect(m.planos[0].email).toBe('ana@x.com');
  });

  it('plano de uid sem usuário no Auth vira aviso e fica fora', () => {
    const m = transformar(
      entrada({
        documentosDeUsuario: [{ uid: 'fantasma', campos: { planData: {} }, subcolecoes: [] }],
        planosPorAno: [{ uid: 'fantasma', ano: '2027', campos: { planData: {} } }],
      }),
    );
    expect(m.planos).toEqual([]);
    expect(temAviso(m, 'fantasma')).toBe(true);
  });

  it('usuário sem e-mail vira aviso e fica fora de usuários', () => {
    const m = transformar(
      entrada({ usuariosAuth: [{ uid: 'u9', email: null, nome: 'Sem', provedores: ['phone'] }] }),
    );
    expect(m.usuarios).toEqual([]);
    expect(temAviso(m, 'u9')).toBe(true);
  });

  it('ana@x.com e ANA@x.com em uids diferentes é impedimento', () => {
    const m = transformar(
      entrada({
        usuariosAuth: [
          { uid: 'u1', email: 'ana@x.com', nome: null, provedores: ['password'] },
          { uid: 'u2', email: 'ANA@x.com', nome: null, provedores: ['google.com'] },
        ],
      }),
    );
    expect(m.impedimentos).toHaveLength(1);
    expect(m.impedimentos[0]).toContain('u1');
    expect(m.impedimentos[0]).toContain('u2');
  });

  it('admin sem conta entra em admins com temConta false e gera aviso', () => {
    const m = transformar(entrada({ admins: ['Ana@X.com', 'chefe@x.com'] }));
    expect(m.admins).toEqual([
      { email: 'ana@x.com', temConta: true },
      { email: 'chefe@x.com', temConta: false },
    ]);
    expect(m.avisos).toHaveLength(1);
  });

  it('acesso sem usuário vira aviso e fica fora', () => {
    const m = transformar(entrada({ acessos: [{ uid: 'zz', status: 'liberado', liberadoEm: null, liberadoPor: null }] }));
    expect(m.acessos).toEqual([]);
    expect(temAviso(m, 'zz')).toBe(true);
  });

  it('acesso guarda status, liberadoEm em ISO e liberadoPor', () => {
    const m = transformar(
      entrada({
        acessos: [
          { uid: 'u1', status: 'liberado', liberadoEm: { toDate: () => new Date('2026-05-02T10:00:00Z') }, liberadoPor: 'chefe@x.com' },
        ],
      }),
    );
    expect(m.acessos).toEqual([
      { email: 'ana@x.com', status: 'liberado', liberadoEm: '2026-05-02T10:00:00.000Z', liberadoPor: 'chefe@x.com' },
    ]);
  });

  it('Timestamp dentro de planData vira texto ISO', () => {
    const m = transformar(
      entrada({
        documentosDeUsuario: [
          { uid: 'u1', campos: { planData: { quando: { toDate: () => new Date('2026-03-01T12:00:00Z') } } }, subcolecoes: [] },
        ],
      }),
    );
    expect(m.planos[0].dados).toEqual({ planData: { quando: '2026-03-01T12:00:00.000Z' } });
  });

  it('valor que não é JSON (Uint8Array) é impedimento com o caminho', () => {
    const m = transformar(
      entrada({ planosPorAno: [{ uid: 'u1', ano: '2027', campos: { planData: { lista: [1, new Uint8Array()] } } }] }),
    );
    expect(m.impedimentos).toHaveLength(1);
    expect(m.impedimentos[0]).toContain('users/u1/planos/2027.planData.lista[1]');
  });

  it('subcoleção desconhecida em users/u1 vira aviso', () => {
    const m = transformar(entrada({ documentosDeUsuario: [{ uid: 'u1', campos: {}, subcolecoes: ['planos', 'rascunhos'] }] }));
    expect(temAviso(m, 'rascunhos')).toBe(true);
    expect(m.avisos).toHaveLength(1);
  });

  it("ano '27' vira aviso e fica fora", () => {
    const m = transformar(entrada({ planosPorAno: [{ uid: 'u1', ano: '27', campos: { planData: {} } }] }));
    expect(m.planos).toEqual([]);
    expect(temAviso(m, "'27'")).toBe(true);
  });

  it("provedor google.com dá temSenha false; password, true", () => {
    const m = transformar(
      entrada({
        usuariosAuth: [
          { uid: 'u1', email: 'g@x.com', nome: 'G', provedores: ['google.com'] },
          { uid: 'u2', email: 's@x.com', nome: null, provedores: ['password'] },
        ],
      }),
    );
    expect(m.usuarios).toEqual([
      { email: 'g@x.com', nome: 'G', temSenha: false },
      { email: 's@x.com', nome: null, temSenha: true },
    ]);
  });

  it('status desconhecido no acesso vira pendente e aviso', () => {
    const m = transformar(entrada({ acessos: [{ uid: 'u1', status: 'aprovado', liberadoEm: null, liberadoPor: null }] }));
    expect(m.acessos[0].status).toBe('pendente');
    expect(temAviso(m, 'aprovado')).toBe(true);
  });

  it('o mesmo e-mail e ano vindo de dois documentos é impedimento', () => {
    // As regras do Firestore só aceitam planos/{ano} acima de 2026; se aparecer um 2026 lá, alguém decide qual vale.
    const m = transformar(
      entrada({
        documentosDeUsuario: [{ uid: 'u1', campos: { planData: { a: 1 } }, subcolecoes: ['planos'] }],
        planosPorAno: [{ uid: 'u1', ano: '2026', campos: { planData: { a: 2 } } }],
      }),
    );
    expect(m.impedimentos).toHaveLength(1);
  });

  it('documento sem nenhum bloco do plano não vira plano', () => {
    const m = transformar(entrada({ documentosDeUsuario: [{ uid: 'u1', campos: {}, subcolecoes: [] }] }));
    expect(m.planos).toEqual([]);
  });

  it('NaN e Infinito no plano viram vazio (null), com um aviso por plano e sem impedimento', () => {
    const campos = { goals2026: { okrs: [{ currentValue: Number.NaN }] }, planData: { bp: { caixa: Infinity, ok: 3 } } };
    const m = transformar(entrada({ documentosDeUsuario: [{ uid: 'u1', campos, subcolecoes: [] }] }));
    expect(m.impedimentos).toEqual([]);
    expect(m.planos[0].dados).toEqual({ goals2026: { okrs: [{ currentValue: null }] }, planData: { bp: { caixa: null, ok: 3 } } });
    expect(m.avisos).toHaveLength(1);
    expect(m.avisos[0]).toContain('2 números inválidos');
    expect(m.avisos[0]).toContain('users/u1.goals2026.okrs[0].currentValue');
  });
});

describe('paraJson', () => {
  it('mantém JSON, converte toDate() e Date, e recusa o resto com o caminho', () => {
    const impedimentos = [];
    expect(paraJson({ a: [1, 'b', null, true], d: new Date('2026-01-01T00:00:00Z') }, 'raiz', impedimentos)).toEqual({
      a: [1, 'b', null, true],
      d: '2026-01-01T00:00:00.000Z',
    });
    expect(impedimentos).toEqual([]);
    paraJson({ n: Number.NaN, u: undefined, b: 1n }, 'raiz', impedimentos);
    expect(impedimentos).toHaveLength(3);
    expect(impedimentos[0]).toContain('raiz.n');
  });

  it('com a lista de não finitos, NaN e Infinito viram null e entram nela; undefined e BigInt seguem impedimento', () => {
    const impedimentos = [];
    const naoFinitos = [];
    expect(paraJson({ n: Number.NaN, i: [-Infinity], u: undefined, b: 1n }, 'raiz', impedimentos, naoFinitos)).toEqual({
      n: null,
      i: [null],
      u: null,
      b: null,
    });
    expect(naoFinitos).toEqual(['raiz.n', 'raiz.i[0]']);
    expect(impedimentos).toHaveLength(2);
  });
});
