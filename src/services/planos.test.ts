import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ANO_DO_PLANO_LEGADO,
  aberturaDoPlano,
  anoDoPlanoAtual,
  anosDoPlano,
  chaveLocalDoPlano,
  criarPlanoSeNaoExistir,
  listarPlanos,
  listarPlanosLocais,
  montarPlanoDoAnoSeguinte,
  proximoAnoDoPlano,
  type DadosDoPlano,
} from './planos';

// Cliente do Supabase de mentira: a leitura devolve a origem; o upsert é o que se confere.
function clienteFalso(origem: unknown, erroAoGravar: unknown = null) {
  const upsert = vi.fn(async () => ({ error: erroAoGravar }));
  const consulta: any = {
    select: () => consulta,
    eq: () => consulta,
    maybeSingle: async () => ({ data: origem === undefined ? null : { dados: origem }, error: null }),
    upsert,
  };
  return { cliente: { from: vi.fn(() => consulta) } as any, upsert };
}


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
      totalEncargosFolha: 0, totalImpostos2024: 0, totalImpostos2025: 0, cbsEfetiva: null,
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
      totalEncargosFolha: 33.8, totalImpostos2024: 10, totalImpostos2025: 20, cbsEfetiva: null,
    },
    pricingItems: [{ id: 'x' }] as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('chave local de cada ano', () => {
  it('chave local do legado e de outro ano', () => {
    expect(ANO_DO_PLANO_LEGADO).toBe(2026);
    expect(chaveLocalDoPlano('u1', 2026)).toBe('plan_data_u1');
    expect(chaveLocalDoPlano('u1', 2027)).toBe('plan_data_u1_2027');
  });

  it('anos do plano: o ano base é o anterior', () => {
    expect(anosDoPlano(2027)).toEqual({ anoPlano: 2027, anoBase: 2026 });
  });
});

describe('anoDoPlanoAtual', () => {
  it.each([
    [new Date(2026, 0, 1), 2027],
    [new Date(2026, 8, 30), 2027],
    [new Date(2026, 10, 10), 2027],
    [new Date(2026, 11, 31), 2027],
    [new Date(2027, 0, 1), 2028],
    [new Date(2027, 2, 15), 2028],
  ])('em %s vale %i', (hoje, ano) => {
    expect(anoDoPlanoAtual(hoje)).toBe(ano);
  });
});

describe('aberturaDoPlano', () => {
  const novembro2026 = new Date(2026, 10, 11);
  it.each([
    ['conta sem plano abre 2027 em branco', [], novembro2026, { abrir: 2027, copiarDe: null }],
    ['só o legado: cria 2027 a partir de 2026', [2026], novembro2026, { abrir: 2027, copiarDe: 2026 }],
    ['2027 já existe: abre sem criar', [2026, 2027], novembro2026, { abrir: 2027, copiarDe: null }],
    ['só 2027: abre sem criar', [2027], novembro2026, { abrir: 2027, copiarDe: null }],
    ['em 2027, com 2026 e 2027: cria 2028 a partir de 2027', [2026, 2027], new Date(2027, 0, 2), { abrir: 2028, copiarDe: 2027 }],
    ['em 2028, só com 2026: cria 2029 a partir de 2026', [2026], new Date(2028, 5, 1), { abrir: 2029, copiarDe: 2026 }],
    ['relógio atrasado, só 2028 salvo: abre 2028 sem criar', [2028], novembro2026, { abrir: 2028, copiarDe: null }],
  ])('%s', (_nome, anos, hoje, esperado) => {
    expect(aberturaDoPlano(anos as number[], hoje as Date)).toEqual(esperado);
  });
});

describe('proximoAnoDoPlano', () => {
  it.each([
    [[2026], new Date(2026, 10, 10), 2027],
    [[2026, 2027], new Date(2026, 10, 10), null],
    [[], new Date(2026, 10, 10), null],
    [[2026, 2027], new Date(2027, 0, 15), 2028],
    [[2027], new Date(2026, 10, 10), null],
    // Conta que pulou anos: o oferecido é sempre o ano seguinte ao atual, não o seguinte ao último salvo.
    [[2026], new Date(2028, 2, 1), 2029],
    [[2026, 2028], new Date(2028, 2, 1), 2029],
    [[2030], new Date(2026, 10, 10), null],
  ])('com %j em %s oferece %s', (anos, hoje, esperado) => {
    expect(proximoAnoDoPlano(anos as number[], hoje)).toBe(esperado);
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
    const novo = montarPlanoDoAnoSeguinte(origem, ini, 1);

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
    const novo = montarPlanoDoAnoSeguinte({ planData: semMercado as any }, ini, 1);
    expect(novo.planData.marketAnalysis).toEqual(ini.planData.marketAnalysis);
    for (const campo of CAMPOS_DE_IMPOSTO) {
      expect(novo.taxes[campo]).toEqual(ini.taxes[campo]);
    }
    expect(novo.taxes.totalImpostos2024).toBe(ini.taxes.totalImpostos2024);
    expect(novo.taxes.totalImpostos2025).toBeNull();
    expect(novo.planData.companyProfile).toEqual(origem.planData.companyProfile);
  });

  it('origem de mais de um ano antes: o imposto do ano base dela não vira o do ano anterior ao base', () => {
    const ini = iniciais();
    const novo = montarPlanoDoAnoSeguinte(origemCheia(), ini, 3);
    expect(novo.taxes.totalImpostos2024).toBe(ini.taxes.totalImpostos2024);
    expect(novo.taxes.totalImpostos2025).toBeNull();
    expect(novo.taxes.regimeTributario).toBe(origemCheia().taxes.regimeTributario);
  });

  it('não copia a CBS digitada; a alíquota efetiva segue', () => {
    const cheia = origemCheia();
    const origem = { ...cheia, taxes: { ...cheia.taxes, cbsEfetiva: 8, aliquotaEfetiva: 15 } };
    const novo = montarPlanoDoAnoSeguinte(origem, iniciais(), 1);
    expect(novo.taxes.cbsEfetiva).toBeNull();
    expect(novo.taxes.aliquotaEfetiva).toBe(15);
  });
});

describe('criarPlanoSeNaoExistir', () => {
  const CONFLITO = { onConflict: 'user_id,ano', ignoreDuplicates: true };

  it('cria o ano seguinte a partir da origem lida no banco, sem sobrescrever o que já existir', async () => {
    const origem = origemCheia();
    const { cliente, upsert } = clienteFalso(origem);
    await criarPlanoSeNaoExistir(cliente, 'u1', 2027, 2026, iniciais());
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'u1', ano: 2027, dados: montarPlanoDoAnoSeguinte(origem, iniciais(), 1) },
      CONFLITO,
    );
  });

  it('cria 2029 a partir do 2026 sem levar o imposto do ano base dele', async () => {
    const { cliente, upsert } = clienteFalso(origemCheia());
    await criarPlanoSeNaoExistir(cliente, 'u1', 2029, 2026, iniciais());
    const [linha] = upsert.mock.calls[0] as any[];
    expect(linha.ano).toBe(2029);
    expect(linha.dados.taxes.totalImpostos2024).toBe(iniciais().taxes.totalImpostos2024);
  });

  it('sem origem salva, cria com os valores iniciais', async () => {
    const { cliente, upsert } = clienteFalso(undefined);
    await criarPlanoSeNaoExistir(cliente, 'u1', 2027, 2026, iniciais());
    const [linha] = upsert.mock.calls[0] as any[];
    expect(linha.dados).toEqual(montarPlanoDoAnoSeguinte({}, iniciais(), 1));
  });

  it('gravação recusada pelo banco lança', async () => {
    const { cliente } = clienteFalso(origemCheia(), { code: '42501', message: 'row-level security' });
    await expect(criarPlanoSeNaoExistir(cliente, 'u1', 2027, 2026, iniciais())).rejects.toMatchObject({ code: '42501' });
  });
});
