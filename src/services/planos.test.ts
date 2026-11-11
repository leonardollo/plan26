import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...p: string[]) => p.join('/')),
  collection: vi.fn((_db: unknown, ...p: string[]) => p.join('/')),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
}));

import { getDoc, getDocs, runTransaction } from 'firebase/firestore';
import {
  ANO_DO_PLANO_LEGADO,
  anoDoPrimeiroPlano,
  anosDoPlano,
  caminhoDoPlano,
  chaveLocalDoPlano,
  criarPlanoSeNaoExistir,
  listarPlanos,
  listarPlanosLocais,
  montarPlanoDoAnoSeguinte,
  proximoAnoDoPlano,
  type DadosDoPlano,
} from './planos';

const getDocMock = vi.mocked(getDoc);
const getDocsMock = vi.mocked(getDocs);
const runTransactionMock = vi.mocked(runTransaction);
const db = {} as any;

const existe = (data: unknown = {}) => ({ exists: () => true, data: () => data }) as any;
const ausente = () => ({ exists: () => false, data: () => undefined }) as any;

function iniciais(): DadosDoPlano {
  return {
    planData: {
      companyProfile: { name: '', cnpj: '', industry: '', geminiApiKey: '' },
      financialSheet: { receitaBruta: { values2025: {} } },
      commercial: { clientes: {} },
      people: { headcount: {} },
      marketing: { investimentos: {} },
      investment: { capex: {} },
      investment2026: { investimentos: [], emprestimos: [], aportes: [] },
      productPortfolio: [],
      marketAnalysis: {
        marketCompetition: { tamanhoMercado: 0 },
        swot: { strengths: '', strengthsImpact: 1 },
        blueOcean: { factors: [], fourActions: {} },
        bowmanClockProducts: [],
      },
      okrsAndKpis: { okrs: [], kpis: {} },
      commercialPlanning: { demandPlanning: { channels: [], analysis: '' } },
      hiringProjection: [],
      actionPlan: [],
      financialPlan2026: { dre: {}, dfc: {}, bp: {} },
      scenarioRelatedData: {},
      scenariosInputMode: { Otimista: 'percentage' },
      analysis: { benchmarkAnalysis: '' },
    } as any,
    goals2026: { inflacaoPrevista: 4.5, financeiras: { metaReceita: {} } } as any,
    scenarios2026: { Otimista: { growthPercentage: 20 } } as any,
    tracking2026: {},
    taxes: {
      regimeTributario: 'Simples Nacional', anexoSimples: '', aliquotaEfetiva: 0, simplesNacional: 0,
      iss: 0, icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, inssPatronal: 0, fgts: 0, ratTerceiros: 0,
      totalEncargosFolha: 0, totalImpostos2024: 0, totalImpostos2025: 0,
    },
    pricingItems: [],
  };
}

const CAMPOS_DE_IMPOSTO = [
  'regimeTributario', 'anexoSimples', 'aliquotaEfetiva', 'simplesNacional', 'iss', 'icms', 'pis', 'cofins',
  'irpj', 'csll', 'inssPatronal', 'fgts', 'ratTerceiros', 'totalEncargosFolha',
] as const;

function origemCheia(): DadosDoPlano {
  const base = iniciais();
  return {
    planData: {
      ...base.planData,
      companyProfile: { name: 'Padaria Sol', cnpj: '12.345.678/0001-90', industry: 'Alimentos', geminiApiKey: 'k-123' },
      financialSheet: { receitaBruta: { values2025: { jan: 100 } } } as any,
      productPortfolio: [{ id: 'p1', name: 'Pão', revenue2025: 1000, cost2025: 400, quantitySold2025: 50 }],
      marketAnalysis: {
        marketCompetition: { tamanhoMercado: 99 } as any,
        swot: { strengths: 'Forno', strengthsImpact: 3 } as any,
        blueOcean: { factors: [{ id: 'f', name: 'F', yourCompanyScore: 4, competitorScore: 2 }], fourActions: {} as any },
        bowmanClockProducts: [{ id: 'b', name: 'B', priceLevel: 2, perceivedValue: 3 }],
      },
      actionPlan: [{ id: 'a1' }] as any,
      analysis: { benchmarkAnalysis: 'texto' } as any,
    },
    goals2026: { inflacaoPrevista: 7, financeiras: { metaReceita: { jan: 500 } } } as any,
    scenarios2026: { Otimista: { growthPercentage: 50 } } as any,
    tracking2026: { jan: { receitaRealizada: 1 } } as any,
    taxes: {
      regimeTributario: 'Lucro Presumido', anexoSimples: 'III', aliquotaEfetiva: 6, simplesNacional: 1,
      iss: 5, icms: 2, pis: 0.65, cofins: 3, irpj: 4.8, csll: 2.88, inssPatronal: 20, fgts: 8, ratTerceiros: 5.8,
      totalEncargosFolha: 33.8, totalImpostos2024: 10, totalImpostos2025: 20,
    },
    pricingItems: [{ id: 'x' }] as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('caminho e chave de cada ano', () => {
  it('o ano legado usa o documento do usuário', () => {
    expect(ANO_DO_PLANO_LEGADO).toBe(2026);
    expect(caminhoDoPlano('u1', 2026)).toEqual(['users', 'u1']);
  });

  it('outro ano usa a subcoleção planos', () => {
    expect(caminhoDoPlano('u1', 2027)).toEqual(['users', 'u1', 'planos', '2027']);
  });

  it('chave local do legado e de outro ano', () => {
    expect(chaveLocalDoPlano('u1', 2026)).toBe('plan_data_u1');
    expect(chaveLocalDoPlano('u1', 2027)).toBe('plan_data_u1_2027');
  });

  it('anos do plano: o ano base é o anterior', () => {
    expect(anosDoPlano(2027)).toEqual({ anoPlano: 2027, anoBase: 2026 });
  });
});

describe('anoDoPrimeiroPlano', () => {
  it.each([
    [new Date(2026, 10, 10), 2027],
    [new Date(2026, 8, 30), 2026],
    [new Date(2027, 2, 15), 2027],
    [new Date(2027, 8, 30), 2027],
    [new Date(2027, 9, 1), 2028],
    [new Date(2027, 11, 31), 2028],
  ])('em %s vale %i', (hoje, ano) => {
    expect(anoDoPrimeiroPlano(hoje)).toBe(ano);
  });
});

describe('proximoAnoDoPlano', () => {
  it.each([
    [[2026], new Date(2026, 10, 10), 2027],
    [[2026, 2027], new Date(2026, 10, 10), null],
    [[], new Date(2026, 10, 10), null],
    [[2026, 2027], new Date(2027, 0, 15), 2028],
    [[2027], new Date(2026, 10, 10), null],
  ])('com %j em %s oferece %s', (anos, hoje, esperado) => {
    expect(proximoAnoDoPlano(anos as number[], hoje)).toBe(esperado);
  });
});

describe('listarPlanos', () => {
  function responder(legado: boolean, ids: string[]) {
    getDocMock.mockImplementation(async (ref: any) => {
      expect(ref).toBe('users/u1');
      return legado ? existe() : ausente();
    });
    getDocsMock.mockImplementation(async (ref: any) => {
      expect(ref).toBe('users/u1/planos');
      return { docs: ids.map(id => ({ id })) } as any;
    });
  }

  it('legado sem planos devolve só o legado', async () => {
    responder(true, []);
    expect(await listarPlanos(db, 'u1')).toEqual([2026]);
  });

  it('legado com 2027 devolve os dois em ordem', async () => {
    responder(true, ['2027']);
    expect(await listarPlanos(db, 'u1')).toEqual([2026, 2027]);
  });

  it('sem legado e sem planos devolve vazio', async () => {
    responder(false, []);
    expect(await listarPlanos(db, 'u1')).toEqual([]);
  });

  it('ignora IDs que não são ano', async () => {
    responder(false, ['2027', 'abc']);
    expect(await listarPlanos(db, 'u1')).toEqual([2027]);
  });

  it('não repete o legado quando planos traz 2026', async () => {
    responder(true, ['2026']);
    expect(await listarPlanos(db, 'u1')).toEqual([2026]);
  });
});

describe('listarPlanosLocais', () => {
  it('lê só as chaves do usuário', () => {
    localStorage.setItem('plan_data_u1_2027', '{}');
    localStorage.setItem('plan_data_u1', '{}');
    localStorage.setItem('plan_data_u1_x', '{}');
    localStorage.setItem('plan_data_u2_2028', '{}');
    expect(listarPlanosLocais(localStorage, 'u1')).toEqual([2026, 2027]);
  });
});

describe('montarPlanoDoAnoSeguinte', () => {
  it('copia o cadastro e deixa os números em branco', () => {
    const origem = origemCheia();
    const ini = iniciais();
    const novo = montarPlanoDoAnoSeguinte(origem, ini);

    expect(novo.planData.companyProfile).toEqual(origem.planData.companyProfile);
    expect(novo.planData.marketAnalysis).toEqual(origem.planData.marketAnalysis);
    expect(novo.planData.productPortfolio).toEqual([
      { id: 'p1', name: 'Pão', revenue2025: null, cost2025: null, quantitySold2025: null },
    ]);
    for (const campo of CAMPOS_DE_IMPOSTO) {
      expect(novo.taxes[campo]).toEqual(origem.taxes[campo]);
    }
    expect(novo.taxes.totalImpostos2024).toBe(20);
    expect(novo.taxes.totalImpostos2025).toBeNull();

    expect(novo.goals2026).toEqual(ini.goals2026);
    expect(novo.scenarios2026).toEqual(ini.scenarios2026);
    expect(novo.tracking2026).toEqual(ini.tracking2026);
    expect(novo.pricingItems).toEqual(ini.pricingItems);
    const copiadas = ['companyProfile', 'productPortfolio', 'marketAnalysis'];
    for (const chave of Object.keys(ini.planData)) {
      if (copiadas.includes(chave)) continue;
      expect((novo.planData as any)[chave]).toEqual((ini.planData as any)[chave]);
    }
    expect(Object.keys(novo.planData).sort()).toEqual(Object.keys(ini.planData).sort());
    expect(Object.keys(novo.taxes).sort()).toEqual(Object.keys(ini.taxes).sort());
  });

  it('campo ausente na origem fica com o valor inicial', () => {
    const origem = origemCheia();
    const { marketAnalysis: _m, ...semMercado } = origem.planData;
    const ini = iniciais();
    const novo = montarPlanoDoAnoSeguinte({ planData: semMercado as any }, ini);
    expect(novo.planData.marketAnalysis).toEqual(ini.planData.marketAnalysis);
    for (const campo of CAMPOS_DE_IMPOSTO) {
      expect(novo.taxes[campo]).toEqual(ini.taxes[campo]);
    }
    expect(novo.taxes.totalImpostos2024).toBe(ini.taxes.totalImpostos2024);
    expect(novo.taxes.totalImpostos2025).toBeNull();
    expect(novo.planData.companyProfile).toEqual(origem.planData.companyProfile);
  });
});

describe('criarPlanoSeNaoExistir', () => {
  function transacao(destinoExiste: boolean, origem: unknown) {
    const tx = {
      get: vi.fn(async (ref: string) => {
        if (ref === 'users/u1/planos/2027') return destinoExiste ? existe({}) : ausente();
        if (ref === 'users/u1') return existe(origem);
        throw new Error(`caminho inesperado ${ref}`);
      }),
      set: vi.fn(),
    };
    runTransactionMock.mockImplementation(async (_db: any, fn: any) => fn(tx));
    return tx;
  }

  it('cria o ano seguinte a partir da origem lida no banco', async () => {
    const origem = origemCheia();
    const tx = transacao(false, origem);
    await criarPlanoSeNaoExistir(db, 'u1', 2027, 2026, iniciais());
    expect(tx.set).toHaveBeenCalledTimes(1);
    expect(tx.set).toHaveBeenCalledWith('users/u1/planos/2027', montarPlanoDoAnoSeguinte(origem, iniciais()));
  });

  it('não sobrescreve um ano que outra aba já criou', async () => {
    const tx = transacao(true, origemCheia());
    await criarPlanoSeNaoExistir(db, 'u1', 2027, 2026, iniciais());
    expect(tx.set).not.toHaveBeenCalled();
  });
});
