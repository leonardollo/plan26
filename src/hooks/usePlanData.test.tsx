import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const { authFalso } = vi.hoisted(() => ({ authFalso: { currentUser: null as any } }));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => authFalso),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
  sendEmailVerification: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((_db: unknown, ...p: string[]) => p.join('/')),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../services/acesso', () => ({
  ehAdministrador: vi.fn(),
  obterOuCriarAcesso: vi.fn(),
  listarAcessos: vi.fn(),
  definirStatus: vi.fn(),
}));

vi.mock('../services/geminiService');

import { getDoc, setDoc } from 'firebase/firestore';
import { ehAdministrador, obterOuCriarAcesso } from '../services/acesso';
import { signOut } from 'firebase/auth';
import { PlanProvider, authService, usePlan } from './usePlanData';
import { MONTHS } from '../types';
import { investimento2026Vazio } from '../utils/calculos/investimentos';

const getDocMock = vi.mocked(getDoc);
const setDocMock = vi.mocked(setDoc);
const ehAdminMock = vi.mocked(ehAdministrador);
const acessoMock = vi.mocked(obterOuCriarAcesso);

const USUARIO = { uid: 'u1', email: 'c@x.com', name: 'C', emailVerified: true } as any;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PlanProvider user={USUARIO}>{children}</PlanProvider>
);

function documento(perfil: Record<string, unknown> = {}) {
  return {
    exists: () => true,
    data: () => ({ planData: { companyProfile: { name: 'Empresa Real', cnpj: '', industry: '', geminiApiKey: '', ...perfil } } }),
  } as any;
}

const negado = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

async function montar() {
  const r = renderHook(() => usePlan(), { wrapper });
  await act(async () => {});
  return r;
}

const avancar = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  authFalso.currentUser = null;
  ehAdminMock.mockResolvedValue(false);
  acessoMock.mockResolvedValue({ status: 'liberado' } as any);
  setDocMock.mockResolvedValue(undefined as any);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePlanData — carga e salvamento', () => {
  it('carga negada não grava nada', async () => {
    getDocMock.mockRejectedValue(negado());
    const { result } = await montar();
    act(() => result.current.updateCompanyProfile('name', 'Nova'));
    await avancar(3500);
    expect(result.current.estadoDaCarga).toBe('falhou');
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('tentar de novo carrega e libera a gravação', async () => {
    getDocMock.mockRejectedValueOnce(negado()).mockResolvedValue(documento());
    const { result } = await montar();
    expect(result.current.estadoDaCarga).toBe('falhou');
    await act(() => result.current.tentarCarregarDeNovo());
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(result.current.planData.companyProfile.name).toBe('Empresa Real');
    act(() => result.current.updateCompanyProfile('name', 'Nova'));
    await avancar(3500);
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('nova falha ao tentar de novo continua bloqueado e sem laço', async () => {
    getDocMock.mockRejectedValue(negado());
    const { result } = await montar();
    await act(() => result.current.tentarCarregarDeNovo());
    await avancar(10000);
    expect(getDocMock).toHaveBeenCalledTimes(2);
    expect(setDocMock).not.toHaveBeenCalled();
    expect(result.current.estadoDaCarga).toBe('falhou');
  });

  it('conta nova carrega vazio e a primeira edição grava', async () => {
    getDocMock.mockResolvedValue({ exists: () => false } as any);
    const { result } = await montar();
    expect(result.current.estadoDaCarga).toBe('carregado');
    act(() => result.current.updateCompanyProfile('name', 'Nova'));
    await avancar(3500);
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('carga ok sem edição não regrava', async () => {
    getDocMock.mockResolvedValue(documento());
    const { result } = await montar();
    await avancar(10000);
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(setDocMock).not.toHaveBeenCalled();
    expect(result.current.saveStatus).not.toBe('unsaved');
  });

  it('salvar agora com carga falha mostra o motivo', async () => {
    getDocMock.mockRejectedValue(negado());
    const { result } = await montar();
    await act(async () => {
      await expect(result.current.saveDataNow()).rejects.toThrow('O plano ainda não foi carregado');
    });
    expect(result.current.saveStatus).toBe('error');
    expect(result.current.motivoDoErroAoSalvar).toBe('O plano ainda não foi carregado');
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('fechar a aba com edição pendente pede confirmação', async () => {
    getDocMock.mockResolvedValue(documento());
    const { result } = await montar();
    act(() => result.current.updateCompanyProfile('name', 'Nova'));
    await avancar(1000);
    const evento = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('fechar a aba com erro de gravação pede confirmação', async () => {
    getDocMock.mockResolvedValue(documento());
    setDocMock.mockRejectedValue(new Error('falha qualquer'));
    const { result } = await montar();
    act(() => result.current.updateCompanyProfile('name', 'Nova'));
    await avancar(3500);
    expect(result.current.saveStatus).toBe('error');
    const evento = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('liberado depois de pendente recarrega o plano', async () => {
    acessoMock.mockResolvedValueOnce({ status: 'pendente' } as any).mockResolvedValue({ status: 'liberado' } as any);
    getDocMock.mockRejectedValueOnce(negado()).mockResolvedValue(documento());
    const { result } = await montar();
    expect(result.current.subscriptionStatus).toBe('not_found');
    await act(() => result.current.checkSubscription());
    expect(getDocMock).toHaveBeenCalledTimes(2);
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(result.current.planData.companyProfile.name).toBe('Empresa Real');
  });
});

describe('usePlanData — chave do Gemini', () => {
  const CHAVE = 'google_gemini_api_key';

  it('logout apaga a chave', async () => {
    localStorage.setItem(CHAVE, 'kA');
    vi.mocked(signOut).mockResolvedValue(undefined);
    await authService.logout();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('logout apaga a chave mesmo se signOut falhar', async () => {
    localStorage.setItem(CHAVE, 'kA');
    vi.mocked(signOut).mockRejectedValue(new Error('rede'));
    await authService.logout().catch(() => {});
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('B sem chave no plano remove a chave de A', async () => {
    localStorage.setItem(CHAVE, 'kA');
    getDocMock.mockResolvedValue(documento());
    const { result } = await montar();
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('B com chave kB grava kB', async () => {
    localStorage.setItem(CHAVE, 'kA');
    getDocMock.mockResolvedValue(documento({ geminiApiKey: 'kB' }));
    await montar();
    expect(localStorage.getItem(CHAVE)).toBe('kB');
  });

  it('carga negada também remove a chave de A', async () => {
    localStorage.setItem(CHAVE, 'kA');
    getDocMock.mockRejectedValue(negado());
    const { result } = await montar();
    expect(result.current.estadoDaCarga).toBe('falhou');
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });
});

describe('usePlanData — e-mail do admin', () => {
  beforeEach(() => {
    getDocMock.mockResolvedValue(documento());
  });

  it('admin sem e-mail verificado vai para a verificação', async () => {
    ehAdminMock.mockResolvedValue(true);
    authFalso.currentUser = { emailVerified: false };
    const { result } = await montar();
    expect(result.current.subscriptionStatus).toBe('verificar_email');
    expect(result.current.souAdmin).toBe(false);
    expect(acessoMock).not.toHaveBeenCalled();
  });

  it('admin verificado entra direto', async () => {
    ehAdminMock.mockResolvedValue(true);
    authFalso.currentUser = { emailVerified: true };
    const { result } = await montar();
    expect(result.current.subscriptionStatus).toBe('active');
    expect(result.current.souAdmin).toBe(true);
  });

  it('Já verifiquei sem ter verificado continua na verificação', async () => {
    ehAdminMock.mockResolvedValue(true);
    authFalso.currentUser = { emailVerified: false };
    const { result } = await montar();
    await act(() => result.current.checkSubscription());
    expect(result.current.subscriptionStatus).toBe('verificar_email');
  });

  it('recarregarUsuario recarrega o usuário e só depois força um token novo', async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const getIdToken = vi.fn().mockResolvedValue('token');
    authFalso.currentUser = { emailVerified: false, reload, getIdToken };
    await authService.recarregarUsuario();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(reload.mock.invocationCallOrder[0]).toBeLessThan(getIdToken.mock.invocationCallOrder[0]);
  });

  it('cliente grava emailVerificado no pedido', async () => {
    ehAdminMock.mockResolvedValue(false);
    await montar();
    expect(acessoMock).toHaveBeenCalledWith(expect.anything(), 'u1', 'c@x.com', 'C', true);
  });
});

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesesIguais = (valor: number) => Object.fromEntries(MESES.map(m => [m, valor]));
const linha = (valor: number) => ({ values2025: mesesIguais(valor) });

// Base de exemplo da especificação (Parte 2): receita 100 mil, CMV 40 mil, aluguel 10 mil e folha 30 mil por mês.
const baseDeExemplo = () => ({
  receitaBruta: linha(100000),
  impostosSobreFaturamento: linha(6000),
  folhaPagamento: linha(30000),
  aluguel: linha(10000),
  despesasOperacionais: { values2025: {} },
  marketingFixo: { values2025: {} },
  administrativo: { values2025: {} },
  customCustosFixos: [],
  cmv: linha(40000),
  comissoes: { values2025: {} },
  fretes: { values2025: {} },
  customCustosVariaveis: [],
});

const projecaoVazia = () => ({
  receitaBruta: {}, impostosSobreFaturamento: {}, folhaPagamento: {}, aluguel: {}, despesasOperacionais: {},
  marketingFixo: {}, administrativo: {}, customCustosFixos: [], cmv: {}, comissoes: {}, fretes: {}, customCustosVariaveis: [],
});

function documentoCom(dados: Record<string, any>) {
  return { exists: () => true, data: () => dados } as any;
}

describe('usePlanData — cenários', () => {
  it('cenário em modo manual não é recalculado quando a inflação muda', async () => {
    getDocMock.mockResolvedValue(documentoCom({
      planData: {
        companyProfile: { name: 'Empresa', cnpj: '', industry: '', geminiApiKey: '' },
        financialSheet: baseDeExemplo(),
        scenariosInputMode: { Otimista: 'manual', Conservador: 'percentage', Disruptivo: 'percentage' },
      },
      taxes: { regimeTributario: 'Simples Nacional', simplesNacional: 6 },
      scenarios2026: {
        Otimista: { growthPercentage: 20, projection: { ...projecaoVazia(), receitaBruta: { ...mesesIguais(0), jan: 999 } } },
      },
    }));
    const { result } = await montar();
    act(() => result.current.updateInflation('10'));
    await act(async () => {});
    expect(result.current.scenarios2026.Otimista.projection.receitaBruta.jan).toBe(999);
    expect(result.current.scenarios2026.Conservador.projection.aluguel.jan).toBeCloseTo(11000);
    expect(result.current.scenarios2026.Conservador.projection.folhaPagamento.jan).toBeCloseTo(33000);
  });

  it('cenário em modo manual não é recalculado quando a base de 2025 muda', async () => {
    getDocMock.mockResolvedValue(documentoComOtimistaManual());
    const { result } = await montar();
    const aluguelAntes = result.current.scenarios2026.Conservador.projection.aluguel.jan;
    act(() => result.current.updateSheetValue('aluguel', 'jan', '20000'));
    await act(async () => {});
    expect(result.current.scenarios2026.Otimista.projection.receitaBruta.jan).toBe(999);
    // Controle: o cenário em percentual foi recalculado, então o efeito rodou.
    expect(result.current.scenarios2026.Conservador.projection.aluguel.jan).not.toBeCloseTo(aluguelAntes!);
  });

  it('cenário em modo manual não é recalculado quando os impostos mudam', async () => {
    getDocMock.mockResolvedValue(documentoComOtimistaManual());
    const { result } = await montar();
    const impostoAntes = result.current.scenarios2026.Conservador.projection.impostosSobreFaturamento.jan;
    act(() => result.current.updateTaxes('simplesNacional', '10'));
    await act(async () => {});
    expect(result.current.scenarios2026.Otimista.projection.receitaBruta.jan).toBe(999);
    // Controle: o cenário em percentual foi recalculado, então o efeito rodou.
    expect(result.current.scenarios2026.Conservador.projection.impostosSobreFaturamento.jan).not.toBeCloseTo(impostoAntes!);
  });
});

function documentoComOtimistaManual() {
  return documentoCom({
    planData: {
      companyProfile: { name: 'Empresa', cnpj: '', industry: '', geminiApiKey: '' },
      financialSheet: baseDeExemplo(),
      scenariosInputMode: { Otimista: 'manual', Conservador: 'percentage', Disruptivo: 'percentage' },
    },
    taxes: { regimeTributario: 'Simples Nacional', simplesNacional: 6 },
    scenarios2026: {
      Otimista: { growthPercentage: 20, projection: { ...projecaoVazia(), receitaBruta: { ...mesesIguais(0), jan: 999 } } },
    },
  });
}

// Plano salvo pela regra antiga: Conservador (10%) com tudo crescido pelo fator, inclusive aluguel e impostos.
function documentoDePlanoAntigo() {
  return documentoCom({
    planData: {
      companyProfile: { name: 'Empresa', cnpj: '', industry: '', geminiApiKey: '' },
      financialSheet: baseDeExemplo(),
    },
    taxes: { regimeTributario: 'Simples Nacional', simplesNacional: 6 },
    scenarios2026: {
      Conservador: {
        growthPercentage: 10,
        projection: {
          ...projecaoVazia(),
          receitaBruta: mesesIguais(110000), impostosSobreFaturamento: mesesIguais(6600),
          aluguel: mesesIguais(11000), folhaPagamento: mesesIguais(33000), cmv: mesesIguais(44000),
        },
      },
    },
  });
}

describe('usePlanData — DRE e plano antigo', () => {
  it('plano antigo aberto sem edição mostra os números novos e não grava', async () => {
    getDocMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    await avancar(10000);
    const conservador = result.current.scenarios2026.Conservador.projection;
    expect(conservador.aluguel.jan).toBeCloseTo(10450);
    // Mercado não preenchido vale −1,5 no score já na carga: 10% − 1,5 = 8,5% → 108.500 × 6% = 6.510.
    expect(conservador.impostosSobreFaturamento.jan).toBeCloseTo(6510);
    expect(result.current.planData.financialPlan2026.dre.irpjCsll.jan).toBe(0);
    expect(setDocMock).not.toHaveBeenCalled();

    act(() => result.current.updateCompanyProfile('name', 'X'));
    await avancar(3500);
    expect(setDocMock).toHaveBeenCalledTimes(1);
    const gravado = setDocMock.mock.calls[0][1] as any;
    expect(gravado.scenarios2026.Conservador.projection.aluguel.jan).toBeCloseTo(10450);
  });

  it('calcular a DRE já em dia (Liquidez, Indicadores) não muda estado nem grava', async () => {
    getDocMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    const antes = result.current.planData;
    act(() => result.current.calculateFinancialPlan2026());
    await avancar(10000);
    expect(result.current.planData).toBe(antes);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('trocar o cenário base faz a DRE refletir a projeção do novo cenário', async () => {
    getDocMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    act(() => result.current.setBaseScenario('Otimista'));
    await act(async () => {});
    // Otimista 20% − 1,5 do score (mercado não preenchido) = 18,5%.
    expect(result.current.planData.financialPlan2026.dre.receitaBruta.jan).toBeCloseTo(118500);
  });
});

describe('usePlanData — sensibilidade', () => {
  it('conta nova (Simples): a célula central tem EBIT 30 mil e lucro líquido 30 mil', async () => {
    getDocMock.mockResolvedValue(documento());
    const { result } = await montar();
    const matriz = result.current.calculateSensitivityAnalysis(100000, 40000, 30000, 20);
    const centro = matriz[2][2];
    expect(centro.ebit).toBeCloseTo(30000);
    expect(centro.netProfit).toBeCloseTo(30000);
  });
});

// Score e bônus gravados antes de uma mudança de regra (ou de dados) ficam desatualizados no documento.
const analiseDesatualizada = (score: number) => ({
  strategicSummary: 'resumo salvo',
  strategicScore: { total: score, components: [] },
  peopleAnalytics: { productivityGainFactor: 0, projectedRevenue: 0 },
});

function documentoComScoreDesatualizado() {
  return documentoCom({
    planData: {
      companyProfile: { name: 'Empresa', cnpj: '', industry: '', geminiApiKey: '' },
      financialSheet: baseDeExemplo(),
      // Mercado crescendo 12% vale +3 no score (2 × 1,5); SWOT e Oceano Azul padrão valem 0.
      marketAnalysis: { marketCompetition: { taxaCrescimentoMercado: 12 } },
      analysis: analiseDesatualizada(0),
    },
    taxes: { regimeTributario: 'Simples Nacional', simplesNacional: 6 },
    scenarios2026: { Conservador: { growthPercentage: 10, projection: projecaoVazia() } },
  });
}

function documentoComBonusDesatualizado() {
  return documentoCom({
    planData: {
      companyProfile: { name: 'Empresa', cnpj: '', industry: '', geminiApiKey: '' },
      financialSheet: baseDeExemplo(),
      // 10 pessoas e 2 desligamentos: turnover 20%, meta 0 → bônus de produtividade 3 (teto).
      people: {
        headcount: { totalColaboradores: { jan: 10 }, contratacoes: {}, desligamentosVoluntarios: { jan: 2 }, desligamentosInvoluntarios: {} },
        custos: { folhaTotalAnual: {} },
        treinamento: { investimentoTD: {}, horasTreinamento: {}, ganhoTreinamento: {} },
        clima: { taxaAbsenteismo: {}, eNPS: {} },
      },
      // Mercado não preenchido (crescimento 0) vale −1,5 no score: este já está certo.
      analysis: analiseDesatualizada(-1.5),
    },
    taxes: { regimeTributario: 'Simples Nacional', simplesNacional: 6 },
    scenarios2026: { Conservador: { growthPercentage: 10, projection: projecaoVazia() } },
  });
}

describe('usePlanData — score e produtividade na abertura', () => {
  it('score desatualizado: abrir mostra o score novo (3) no cenário e não grava; a próxima edição grava', async () => {
    getDocMock.mockResolvedValue(documentoComScoreDesatualizado());
    const { result } = await montar();
    await avancar(10000);
    expect(result.current.planData.analysis.strategicScore.total).toBeCloseTo(3);
    expect(result.current.planData.analysis.strategicSummary).toBe('resumo salvo');
    // Crescimento 10 + score 3 + bônus 0.
    expect(result.current.scenarios2026.Conservador.projection.receitaBruta.jan).toBeCloseTo(113000);
    expect(setDocMock).not.toHaveBeenCalled();

    act(() => result.current.updateCompanyProfile('name', 'X'));
    await avancar(3500);
    expect(setDocMock).toHaveBeenCalledTimes(1);
    const gravado = setDocMock.mock.calls[0][1] as any;
    expect(gravado.planData.analysis.strategicScore.total).toBeCloseTo(3);
  });

  it('bônus de produtividade desatualizado: abrir mostra o bônus novo (3) no cenário e não grava', async () => {
    getDocMock.mockResolvedValue(documentoComBonusDesatualizado());
    const { result } = await montar();
    await avancar(10000);
    const pessoas = result.current.planData.analysis.peopleAnalytics;
    expect(pessoas.productivityGainFactor).toBeCloseTo(3);
    // Receita por colaborador 120 mil × 1,03 × 10 pessoas.
    expect(pessoas.projectedRevenue).toBeCloseTo(1236000);
    // Crescimento 10 + score −1,5 + bônus 3.
    expect(result.current.scenarios2026.Conservador.projection.receitaBruta.jan).toBeCloseTo(111500);
    expect(setDocMock).not.toHaveBeenCalled();
  });
});

const emprestimo100mil = { id: 'e1', descricao: 'Banco', valor: 100000, mes: 'jan', jurosMensalPct: 2, parcelas: 24 };

const semNaNNoPlano = (plano: any) => ['dre', 'dfc', 'bp'].forEach(parte =>
  Object.values(plano[parte]).forEach((linha: any) =>
    MONTHS.forEach(m => expect(Number.isNaN(linha?.[m])).toBe(false))));

describe('usePlanData — investimentos, empréstimos e contratações de 2026', () => {
  it('plano antigo sem investment2026 abre com o bloco vazio e não grava', async () => {
    getDocMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    expect(result.current.planData.investment2026).toEqual(investimento2026Vazio());
    await avancar(5000);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('bloco parcial é completado na carga', async () => {
    const doc = documentoDePlanoAntigo();
    const dados = doc.data();
    dados.planData.investment2026 = { emprestimos: [emprestimo100mil] };
    getDocMock.mockResolvedValue(documentoCom(dados));
    const { result } = await montar();
    const bloco = result.current.planData.investment2026;
    expect(bloco.investimentos).toEqual([]);
    expect(bloco.aportes).toEqual([]);
    expect(bloco.emprestimos).toEqual([emprestimo100mil]);
    expect(bloco.jurosDividaAtualPct).toBeNull();
    expect(result.current.planData.financialPlan2026.dre.despesasFinanceiras.fev).toBeCloseTo(2000, 2);
    await avancar(5000);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('contratações salvas entram na folha na carga, sem gravar', async () => {
    const dados = documentoDePlanoAntigo().data();
    dados.planData.hiringProjection = [
      { id: 'h1', department: 'Vendas', currentHeadcount: 0, newHires: 2, avgAnnualCost: 60000, mesEntrada: 'jul' },
    ];
    getDocMock.mockResolvedValue(documentoCom(dados));
    const { result } = await montar();
    const folha = result.current.scenarios2026.Conservador.projection.folhaPagamento;
    expect(folha.jul! - folha.jun!).toBeCloseTo(10000);
    await avancar(5000);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('adicionar empréstimo recalcula a DRE, os indicadores e grava', async () => {
    getDocMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    act(() => result.current.addItemInvestimento2026('emprestimos'));
    const id = result.current.planData.investment2026.emprestimos[0].id;
    act(() => {
      result.current.updateItemInvestimento2026('emprestimos', id, 'valor', '100000');
      result.current.updateItemInvestimento2026('emprestimos', id, 'jurosMensalPct', '2');
      result.current.updateItemInvestimento2026('emprestimos', id, 'parcelas', '24');
    });
    await act(async () => {});
    const plano = result.current.planData.financialPlan2026;
    expect(plano.dre.despesasFinanceiras.fev).toBeCloseTo(2000, 2);
    expect(plano.bp.emprestimosCurtoPrazo.dez).toBeGreaterThan(0);
    expect(result.current.financialIndicators.ratios.solvency.debtToEquity).toBeGreaterThan(0);
    await avancar(3500);
    expect(setDocMock).toHaveBeenCalled();
  });

  it('mudar contratações recalcula cenários percentuais e não o manual', async () => {
    getDocMock.mockResolvedValue(documentoComOtimistaManual());
    const { result } = await montar();
    const folhaAntes = result.current.scenarios2026.Conservador.projection.folhaPagamento.jul!;
    const otimistaAntes = result.current.scenarios2026.Otimista.projection;
    act(() => result.current.addHiringProjectionItem());
    const id = result.current.planData.hiringProjection[0].id;
    act(() => {
      result.current.updateHiringProjectionItem(id, 'newHires', '2');
      result.current.updateHiringProjectionItem(id, 'avgAnnualCost', '60000');
      result.current.updateHiringProjectionItem(id, 'mesEntrada', 'jul');
    });
    await act(async () => {});
    const conservador = result.current.scenarios2026.Conservador.projection.folhaPagamento;
    expect(conservador.jul! - folhaAntes).toBeCloseTo(10000);
    expect(conservador.jun).toBeCloseTo(folhaAntes);
    expect(result.current.scenarios2026.Otimista.projection).toEqual(otimistaAntes);
  });

  it('mesEntrada: novo item vem jan; valor vazio vira null', async () => {
    getDocMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    act(() => result.current.addHiringProjectionItem());
    const item = result.current.planData.hiringProjection[0];
    expect(item.mesEntrada).toBe('jan');
    act(() => result.current.updateHiringProjectionItem(item.id, 'mesEntrada', 'jul'));
    expect(result.current.planData.hiringProjection[0].mesEntrada).toBe('jul');
    act(() => result.current.updateHiringProjectionItem(item.id, 'mesEntrada', ''));
    expect(result.current.planData.hiringProjection[0].mesEntrada).toBeNull();
  });

  it('campo de empréstimo apagado vira null e não gera NaN', async () => {
    getDocMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    act(() => result.current.addItemInvestimento2026('emprestimos'));
    const novo = result.current.planData.investment2026.emprestimos[0];
    expect(novo).toMatchObject({ descricao: '', mes: 'jan', valor: null, jurosMensalPct: null, parcelas: null });
    act(() => {
      result.current.updateItemInvestimento2026('emprestimos', novo.id, 'valor', '100000');
      result.current.updateItemInvestimento2026('emprestimos', novo.id, 'parcelas', '24');
      result.current.updateItemInvestimento2026('emprestimos', novo.id, 'descricao', 'Banco X');
    });
    act(() => {
      result.current.updateItemInvestimento2026('emprestimos', novo.id, 'parcelas', '');
      result.current.updateItemInvestimento2026('emprestimos', novo.id, 'mes', '');
      result.current.updateItemInvestimento2026('emprestimos', novo.id, 'jurosMensalPct', 'abc');
    });
    await act(async () => {});
    const item = result.current.planData.investment2026.emprestimos[0];
    expect(item).toMatchObject({ descricao: 'Banco X', valor: 100000, parcelas: null, mes: null, jurosMensalPct: null });
    semNaNNoPlano(result.current.planData.financialPlan2026);
  });

  it('juros da dívida atual e remoção de item', async () => {
    getDocMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    act(() => result.current.updateJurosDividaAtual('1.5'));
    expect(result.current.planData.investment2026.jurosDividaAtualPct).toBe(1.5);
    act(() => result.current.updateJurosDividaAtual(''));
    expect(result.current.planData.investment2026.jurosDividaAtualPct).toBeNull();
    act(() => result.current.addItemInvestimento2026('aportes'));
    const id = result.current.planData.investment2026.aportes[0].id;
    act(() => result.current.removeItemInvestimento2026('aportes', id));
    expect(result.current.planData.investment2026.aportes).toEqual([]);
  });
});
