import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const { authFalso, banco } = vi.hoisted(() => ({
  authFalso: { signOut: vi.fn(), refreshSession: vi.fn(), onAuthStateChange: vi.fn() },
  // Fora do vi.mock: o modo local reimporta o módulo e os testes continuam olhando os mesmos falsos.
  banco: { listarPlanos: vi.fn(), carregarPlano: vi.fn(), salvarPlano: vi.fn(), criarPlanoSeNaoExistir: vi.fn() },
}));

// O cliente do Supabase é trocado por este falso; usuarioDoSupabase continua o de verdade.
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: authFalso })) }));

// As consultas ao banco são falsas (o banco de verdade está em tests/db); as regras puras de planos.ts continuam as reais.
vi.mock('../services/planos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/planos')>()),
  ...banco,
}));

vi.mock('../services/acesso', () => ({
  ehAdministrador: vi.fn(),
  obterAcesso: vi.fn(),
  listarAcessos: vi.fn(),
  definirStatus: vi.fn(),
}));

vi.mock('../services/geminiService');

import { ehAdministrador, obterAcesso } from '../services/acesso';
import { montarPlanoDoAnoSeguinte } from '../services/planos';
import { PlanProvider, authService, usePlan } from './usePlanData';
import { MONTHS } from '../types';
import { investimento2026Vazio } from '../utils/calculos/investimentos';

// carregarPlano(cliente, uid, ano), salvarPlano(cliente, uid, ano, dados), listarPlanos(cliente, uid).
const lerMock = banco.carregarPlano;
const gravarMock = banco.salvarPlano;
const listarMock = banco.listarPlanos;
const criarMock = banco.criarPlanoSeNaoExistir;
const ehAdminMock = vi.mocked(ehAdministrador);
const acessoMock = vi.mocked(obterAcesso);

const USUARIO = { uid: 'u1', email: 'c@x.com', name: 'C', emailVerified: true } as any;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PlanProvider user={USUARIO}>{children}</PlanProvider>
);

// O que está na coluna `dados` do plano.
function documento(perfil: Record<string, unknown> = {}) {
  return { planData: { companyProfile: { name: 'Empresa Real', cnpj: '', industry: '', geminiApiKey: '', ...perfil } } } as any;
}

// Recusa do RLS como o PostgREST devolve: objeto com código, não Error.
const negado = () => ({ code: '42501', message: 'new row violates row-level security policy for table "planos"' });

async function montar() {
  const r = renderHook(() => usePlan(), { wrapper });
  await act(async () => {});
  return r;
}

const avancar = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

// Em 2025 o plano do ano seguinte é o próprio 2026: ele abre sem criar outro ano.
const emNovembroDe2025 = () => vi.setSystemTime(new Date(2025, 10, 10));

beforeEach(() => {
  vi.useFakeTimers();
  // O primeiro plano de quem não tem nenhum depende da data: fixa 10/11/2026 (vale 2027).
  vi.setSystemTime(new Date(2026, 10, 10));
  vi.clearAllMocks();
  listarMock.mockResolvedValue([]);
  lerMock.mockResolvedValue(null);
  criarMock.mockResolvedValue(undefined);
  localStorage.clear();
  ehAdminMock.mockResolvedValue(false);
  acessoMock.mockResolvedValue({ status: 'liberado' } as any);
  gravarMock.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePlanData — carga e salvamento', () => {
  it('carga negada não grava nada', async () => {
    lerMock.mockRejectedValue(negado());
    const { result } = await montar();
    act(() => result.current.updateCompanyProfile('name', 'Nova'));
    await avancar(3500);
    expect(result.current.estadoDaCarga).toBe('falhou');
    expect(gravarMock).not.toHaveBeenCalled();
  });

  it('tentar de novo carrega e libera a gravação', async () => {
    lerMock.mockRejectedValueOnce(negado()).mockResolvedValue(documento());
    const { result } = await montar();
    expect(result.current.estadoDaCarga).toBe('falhou');
    await act(() => result.current.tentarCarregarDeNovo());
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(result.current.planData.companyProfile.name).toBe('Empresa Real');
    act(() => result.current.updateCompanyProfile('name', 'Nova'));
    await avancar(3500);
    expect(gravarMock).toHaveBeenCalledTimes(1);
  });

  it('nova falha ao tentar de novo continua bloqueado e sem laço', async () => {
    lerMock.mockRejectedValue(negado());
    const { result } = await montar();
    await act(() => result.current.tentarCarregarDeNovo());
    await avancar(10000);
    expect(lerMock).toHaveBeenCalledTimes(2);
    expect(gravarMock).not.toHaveBeenCalled();
    expect(result.current.estadoDaCarga).toBe('falhou');
  });

  it('conta nova carrega vazio e a primeira edição grava', async () => {
    lerMock.mockResolvedValue({ exists: () => false } as any);
    const { result } = await montar();
    expect(result.current.estadoDaCarga).toBe('carregado');
    act(() => result.current.updateCompanyProfile('name', 'Nova'));
    await avancar(3500);
    expect(gravarMock).toHaveBeenCalledTimes(1);
  });

  it('carga ok sem edição não regrava', async () => {
    lerMock.mockResolvedValue(documento());
    const { result } = await montar();
    await avancar(10000);
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(gravarMock).not.toHaveBeenCalled();
    expect(result.current.saveStatus).not.toBe('unsaved');
  });

  it('salvar agora com carga falha mostra o motivo', async () => {
    lerMock.mockRejectedValue(negado());
    const { result } = await montar();
    await act(async () => {
      await expect(result.current.saveDataNow()).rejects.toThrow('O plano ainda não foi carregado');
    });
    expect(result.current.saveStatus).toBe('error');
    expect(result.current.motivoDoErroAoSalvar).toBe('O plano ainda não foi carregado');
    expect(gravarMock).not.toHaveBeenCalled();
  });

  it('fechar a aba com edição pendente pede confirmação', async () => {
    lerMock.mockResolvedValue(documento());
    const { result } = await montar();
    act(() => result.current.updateCompanyProfile('name', 'Nova'));
    await avancar(1000);
    const evento = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('fechar a aba com erro de gravação pede confirmação', async () => {
    lerMock.mockResolvedValue(documento());
    gravarMock.mockRejectedValue(new Error('falha qualquer'));
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
    listarMock.mockRejectedValueOnce(negado()).mockResolvedValue([2027]);
    lerMock.mockResolvedValue(documento());
    const { result } = await montar();
    expect(result.current.subscriptionStatus).toBe('not_found');
    await act(() => result.current.checkSubscription());
    // A listagem negada não chegou a escolher o ano: a liberação refaz a listagem e carrega 2027.
    expect(listarMock).toHaveBeenCalledTimes(2);
    expect(lerMock).toHaveBeenCalledTimes(1);
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(result.current.planData.companyProfile.name).toBe('Empresa Real');
  });
});

describe('usePlanData — chave do Gemini', () => {
  const CHAVE = 'google_gemini_api_key';

  it('logout apaga a chave', async () => {
    localStorage.setItem(CHAVE, 'kA');
    authFalso.signOut.mockResolvedValue({ error: null });
    await authService.logout();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('logout apaga a chave mesmo se signOut falhar', async () => {
    localStorage.setItem(CHAVE, 'kA');
    authFalso.signOut.mockResolvedValue({ error: new Error('rede') });
    await authService.logout().catch(() => {});
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('B sem chave no plano remove a chave de A', async () => {
    localStorage.setItem(CHAVE, 'kA');
    lerMock.mockResolvedValue(documento());
    const { result } = await montar();
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('B com chave kB grava kB', async () => {
    localStorage.setItem(CHAVE, 'kA');
    lerMock.mockResolvedValue(documento({ geminiApiKey: 'kB' }));
    await montar();
    expect(localStorage.getItem(CHAVE)).toBe('kB');
  });

  it('carga negada também remove a chave de A', async () => {
    localStorage.setItem(CHAVE, 'kA');
    lerMock.mockRejectedValue(negado());
    const { result } = await montar();
    expect(result.current.estadoDaCarga).toBe('falhou');
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });
});

describe('usePlanData — e-mail do admin', () => {
  // A sessão que o Supabase devolve ao renovar; é ela que diz se o e-mail já foi confirmado.
  const sessaoCom = (confirmado: boolean | null) =>
    authFalso.refreshSession.mockResolvedValue({
      data: confirmado === null ? { session: null, user: null } : {
        session: { user: { id: 'u1', email: 'c@x.com', email_confirmed_at: confirmado ? '2026-11-12T10:00:00Z' : null } },
        user: null,
      },
      error: null,
    });

  beforeEach(async () => {
    lerMock.mockResolvedValue(documento());
    sessaoCom(null);
    await authService.recarregarUsuario();
  });

  it('admin sem e-mail verificado vai para a verificação', async () => {
    ehAdminMock.mockResolvedValue(true);
    sessaoCom(false);
    await authService.recarregarUsuario();
    const { result } = await montar();
    expect(result.current.subscriptionStatus).toBe('verificar_email');
    expect(result.current.souAdmin).toBe(false);
    expect(acessoMock).not.toHaveBeenCalled();
  });

  it('admin verificado entra direto', async () => {
    ehAdminMock.mockResolvedValue(true);
    sessaoCom(true);
    await authService.recarregarUsuario();
    const { result } = await montar();
    expect(result.current.subscriptionStatus).toBe('active');
    expect(result.current.souAdmin).toBe(true);
  });

  it('Já verifiquei sem ter verificado continua na verificação', async () => {
    ehAdminMock.mockResolvedValue(true);
    sessaoCom(false);
    await authService.recarregarUsuario();
    const { result } = await montar();
    await act(() => result.current.checkSubscription());
    expect(result.current.subscriptionStatus).toBe('verificar_email');
  });

  it('Já verifiquei depois de confirmar: a sessão renovada libera o admin', async () => {
    ehAdminMock.mockResolvedValue(true);
    sessaoCom(false);
    await authService.recarregarUsuario();
    const { result } = await montar();
    expect(result.current.subscriptionStatus).toBe('verificar_email');
    sessaoCom(true);
    await act(async () => {
      await authService.recarregarUsuario();
      await result.current.checkSubscription();
    });
    expect(authFalso.refreshSession).toHaveBeenCalled();
    expect(result.current.subscriptionStatus).toBe('active');
  });

  it('recarregarUsuario lança o erro do Supabase', async () => {
    authFalso.refreshSession.mockResolvedValue({ data: { session: null, user: null }, error: new Error('sessão expirada') });
    await expect(authService.recarregarUsuario()).rejects.toThrow('sessão expirada');
  });

  // A linha de acesso nasce no banco, por gatilho; o cliente só lê. Sem linha, fica na fila.
  it('cliente sem linha de acesso fica como pendente', async () => {
    ehAdminMock.mockResolvedValue(false);
    acessoMock.mockResolvedValue(null);
    const { result } = await montar();
    expect(acessoMock).toHaveBeenCalledWith(expect.anything(), 'u1');
    expect(result.current.subscriptionStatus).toBe('not_found');
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

const documentoCom = (dados: Record<string, any>) => dados as any;

describe('usePlanData — cenários', () => {
  it('cenário em modo manual não é recalculado quando a inflação muda', async () => {
    lerMock.mockResolvedValue(documentoCom({
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
    lerMock.mockResolvedValue(documentoComOtimistaManual());
    const { result } = await montar();
    const aluguelAntes = result.current.scenarios2026.Conservador.projection.aluguel.jan;
    act(() => result.current.updateSheetValue('aluguel', 'jan', '20000'));
    await act(async () => {});
    expect(result.current.scenarios2026.Otimista.projection.receitaBruta.jan).toBe(999);
    // Controle: o cenário em percentual foi recalculado, então o efeito rodou.
    expect(result.current.scenarios2026.Conservador.projection.aluguel.jan).not.toBeCloseTo(aluguelAntes!);
  });

  it('cenário em modo manual não é recalculado quando os impostos mudam', async () => {
    lerMock.mockResolvedValue(documentoComOtimistaManual());
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
    lerMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    await avancar(10000);
    const conservador = result.current.scenarios2026.Conservador.projection;
    expect(conservador.aluguel.jan).toBeCloseTo(10450);
    // Mercado não preenchido vale −1,5 no score já na carga: 10% − 1,5 = 8,5% → 108.500 × 6% = 6.510.
    expect(conservador.impostosSobreFaturamento.jan).toBeCloseTo(6510);
    expect(result.current.planData.financialPlan2026.dre.irpjCsll.jan).toBe(0);
    expect(gravarMock).not.toHaveBeenCalled();

    act(() => result.current.updateCompanyProfile('name', 'X'));
    await avancar(3500);
    expect(gravarMock).toHaveBeenCalledTimes(1);
    const gravado = gravarMock.mock.calls[0][3] as any;
    expect(gravado.scenarios2026.Conservador.projection.aluguel.jan).toBeCloseTo(10450);
  });

  it('calcular a DRE já em dia (Liquidez, Indicadores) não muda estado nem grava', async () => {
    lerMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    const antes = result.current.planData;
    act(() => result.current.calculateFinancialPlan2026());
    await avancar(10000);
    expect(result.current.planData).toBe(antes);
    expect(gravarMock).not.toHaveBeenCalled();
  });

  it('trocar o cenário base faz a DRE refletir a projeção do novo cenário', async () => {
    lerMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    act(() => result.current.setBaseScenario('Otimista'));
    await act(async () => {});
    // Otimista 20% − 1,5 do score (mercado não preenchido) = 18,5%.
    expect(result.current.planData.financialPlan2026.dre.receitaBruta.jan).toBeCloseTo(118500);
  });
});

describe('usePlanData — sensibilidade', () => {
  it('conta nova (Simples): a célula central tem EBIT 30 mil e lucro líquido 30 mil', async () => {
    lerMock.mockResolvedValue(documento());
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
    lerMock.mockResolvedValue(documentoComScoreDesatualizado());
    const { result } = await montar();
    await avancar(10000);
    expect(result.current.planData.analysis.strategicScore.total).toBeCloseTo(3);
    expect(result.current.planData.analysis.strategicSummary).toBe('resumo salvo');
    // Crescimento 10 + score 3 + bônus 0.
    expect(result.current.scenarios2026.Conservador.projection.receitaBruta.jan).toBeCloseTo(113000);
    expect(gravarMock).not.toHaveBeenCalled();

    act(() => result.current.updateCompanyProfile('name', 'X'));
    await avancar(3500);
    expect(gravarMock).toHaveBeenCalledTimes(1);
    const gravado = gravarMock.mock.calls[0][3] as any;
    expect(gravado.planData.analysis.strategicScore.total).toBeCloseTo(3);
  });

  it('bônus de produtividade desatualizado: abrir mostra o bônus novo (3) no cenário e não grava', async () => {
    lerMock.mockResolvedValue(documentoComBonusDesatualizado());
    const { result } = await montar();
    await avancar(10000);
    const pessoas = result.current.planData.analysis.peopleAnalytics;
    expect(pessoas.productivityGainFactor).toBeCloseTo(3);
    // Receita por colaborador 120 mil × 1,03 × 10 pessoas.
    expect(pessoas.projectedRevenue).toBeCloseTo(1236000);
    // Crescimento 10 + score −1,5 + bônus 3.
    expect(result.current.scenarios2026.Conservador.projection.receitaBruta.jan).toBeCloseTo(111500);
    expect(gravarMock).not.toHaveBeenCalled();
  });
});

const emprestimo100mil = { id: 'e1', descricao: 'Banco', valor: 100000, mes: 'jan', jurosMensalPct: 2, parcelas: 24 };

const semNaNNoPlano = (plano: any) => ['dre', 'dfc', 'bp'].forEach(parte =>
  Object.values(plano[parte]).forEach((linha: any) =>
    MONTHS.forEach(m => expect(Number.isNaN(linha?.[m])).toBe(false))));

describe('usePlanData — investimentos, empréstimos e contratações de 2026', () => {
  it('plano antigo sem investment2026 abre com o bloco vazio e não grava', async () => {
    lerMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    expect(result.current.planData.investment2026).toEqual(investimento2026Vazio());
    await avancar(5000);
    expect(gravarMock).not.toHaveBeenCalled();
  });

  it('bloco parcial é completado na carga', async () => {
    const dados = documentoDePlanoAntigo();
    dados.planData.investment2026 = { emprestimos: [emprestimo100mil] };
    lerMock.mockResolvedValue(documentoCom(dados));
    const { result } = await montar();
    const bloco = result.current.planData.investment2026;
    expect(bloco.investimentos).toEqual([]);
    expect(bloco.aportes).toEqual([]);
    expect(bloco.emprestimos).toEqual([emprestimo100mil]);
    expect(bloco.jurosDividaAtualPct).toBeNull();
    expect(result.current.planData.financialPlan2026.dre.despesasFinanceiras.fev).toBeCloseTo(2000, 2);
    await avancar(5000);
    expect(gravarMock).not.toHaveBeenCalled();
  });

  it('contratações salvas entram na folha na carga, sem gravar', async () => {
    const dados = documentoDePlanoAntigo();
    dados.planData.hiringProjection = [
      { id: 'h1', department: 'Vendas', currentHeadcount: 0, newHires: 2, avgAnnualCost: 60000, mesEntrada: 'jul' },
    ];
    lerMock.mockResolvedValue(documentoCom(dados));
    const { result } = await montar();
    const folha = result.current.scenarios2026.Conservador.projection.folhaPagamento;
    expect(folha.jul! - folha.jun!).toBeCloseTo(10000);
    await avancar(5000);
    expect(gravarMock).not.toHaveBeenCalled();
  });

  it('adicionar empréstimo recalcula a DRE, os indicadores e grava', async () => {
    lerMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    const liquidezAntes = result.current.financialIndicators.ratios.liquidity.currentRatio;
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
    expect(liquidezAntes).toBeGreaterThan(0);
    expect(result.current.financialIndicators.ratios.liquidity.currentRatio).toBeLessThan(liquidezAntes);
    await avancar(3500);
    expect(gravarMock).toHaveBeenCalled();
  });

  it('mudar contratações recalcula cenários percentuais e não o manual', async () => {
    lerMock.mockResolvedValue(documentoComOtimistaManual());
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
    lerMock.mockResolvedValue(documentoDePlanoAntigo());
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
    lerMock.mockResolvedValue(documentoDePlanoAntigo());
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

  it('valor de empréstimo e valor/vida útil de investimento apagados viram null e não geram NaN', async () => {
    lerMock.mockResolvedValue(documentoDePlanoAntigo());
    const { result } = await montar();
    act(() => {
      result.current.addItemInvestimento2026('emprestimos');
      result.current.addItemInvestimento2026('investimentos');
      result.current.addItemInvestimento2026('investimentos');
    });
    const emp = result.current.planData.investment2026.emprestimos[0].id;
    const [inv1, inv2] = result.current.planData.investment2026.investimentos.map((i: any) => i.id);
    act(() => {
      result.current.updateItemInvestimento2026('emprestimos', emp, 'valor', '100000');
      result.current.updateItemInvestimento2026('emprestimos', emp, 'jurosMensalPct', '2');
      result.current.updateItemInvestimento2026('emprestimos', emp, 'parcelas', '24');
      result.current.updateItemInvestimento2026('investimentos', inv1, 'valor', '60000');
      result.current.updateItemInvestimento2026('investimentos', inv1, 'vidaUtilAnos', '10');
      result.current.updateItemInvestimento2026('investimentos', inv2, 'valor', '30000');
      result.current.updateItemInvestimento2026('investimentos', inv2, 'vidaUtilAnos', '3');
    });
    act(() => {
      result.current.updateItemInvestimento2026('emprestimos', emp, 'valor', '');
      // Sem vida útil o investimento 1 continua valendo, com o padrão de 5 anos.
      result.current.updateItemInvestimento2026('investimentos', inv1, 'vidaUtilAnos', '');
      result.current.updateItemInvestimento2026('investimentos', inv2, 'valor', '');
      result.current.updateItemInvestimento2026('investimentos', inv2, 'vidaUtilAnos', '');
    });
    await act(async () => {});
    const bloco = result.current.planData.investment2026;
    expect(bloco.emprestimos[0]).toMatchObject({ valor: null, jurosMensalPct: 2, parcelas: 24 });
    expect(bloco.investimentos[0]).toMatchObject({ valor: 60000, vidaUtilAnos: null });
    expect(bloco.investimentos[1]).toMatchObject({ valor: null, vidaUtilAnos: null });
    const plano = result.current.planData.financialPlan2026;
    semNaNNoPlano(plano);
    // Empréstimo sem valor não gera juros; investimento de 60 mil em 5 anos deprecia 1 mil por mês.
    expect(plano.dre.despesasFinanceiras.fev).toBeCloseTo(0, 2);
    expect(plano.dre.depreciacao.fev).toBeCloseTo(1000, 2);
  });

  it('juros da dívida atual e remoção de item', async () => {
    lerMock.mockResolvedValue(documentoDePlanoAntigo());
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

const perfil = (name: string, extra: Record<string, any> = {}) => ({
  ...extra,
  planData: { companyProfile: { name, cnpj: '', industry: '', geminiApiKey: '' }, ...(extra.planData ?? {}) },
});

// A tabela `planos` de faz de conta: uma linha por ano, lida e listada na hora da consulta.
function bancoCom(docs: Record<number, any>) {
  lerMock.mockImplementation(async (_c: unknown, _uid: string, ano: number) => docs[ano] ?? null);
  listarMock.mockImplementation(async () => Object.keys(docs).map(Number).sort((a, b) => a - b));
}
const anosGravados = () => gravarMock.mock.calls.map(c => c[2]);

describe('usePlanData — um plano por ano', () => {
  it('abre o ano mais recente da lista', async () => {
    bancoCom({ 2026: perfil('A'), 2027: perfil('B') });
    const { result } = await montar();
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.anoBase).toBe(2026);
    expect(result.current.planData.companyProfile.name).toBe('B');
    expect(result.current.anosDisponiveis).toEqual([2026, 2027]);
  });

  it('em 2025, só com o 2026 abre 2026', async () => {
    emNovembroDe2025();
    bancoCom({ 2026: perfil('A') });
    const { result } = await montar();
    expect(result.current.anoPlano).toBe(2026);
    expect(result.current.anoBase).toBe(2025);
    expect(result.current.planData.companyProfile.name).toBe('A');
    expect(result.current.anosDisponiveis).toEqual([2026]);
    expect(criarMock).not.toHaveBeenCalled();
  });

  it('em 10/11/2026, só com o 2026 cria 2027 a partir do 2026 e abre, sem gravar mais nada', async () => {
    const docs: Record<number, any> = { 2026: perfil('A') };
    bancoCom(docs);
    const criados = criacaoSobre(docs);
    const { result } = await montar();
    expect(criados).toHaveBeenCalledTimes(1);
    expect(criados.mock.calls[0][0]).toBe(2027);
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.anoBase).toBe(2026);
    expect(result.current.planData.companyProfile.name).toBe('A');
    expect(result.current.anosDisponiveis).toEqual([2026, 2027]);
    expect(result.current.proximoAnoDisponivel).toBeNull();
    await avancar(10000);
    expect(gravarMock).not.toHaveBeenCalled();
  });

  it('em 02/01/2027, com 2026 e 2027 salvos, cria 2028 a partir do 2027', async () => {
    vi.setSystemTime(new Date(2027, 0, 2));
    const docs: Record<number, any> = { 2026: perfil('A'), 2027: perfil('B') };
    bancoCom(docs);
    const criados = criacaoSobre(docs);
    const { result } = await montar();
    expect(criados.mock.calls.map(c => c[0])).toEqual([2028]);
    expect(result.current.anoPlano).toBe(2028);
    expect(result.current.planData.companyProfile.name).toBe('B');
    expect(result.current.anosDisponiveis).toEqual([2026, 2027, 2028]);
  });

  it('criação do ano seguinte negada abre o último salvo e continua oferecendo o ano seguinte', async () => {
    const docs: Record<number, any> = { 2026: perfil('A') };
    bancoCom(docs);
    criacaoSobre(docs);
    criarMock.mockRejectedValueOnce(negado());
    const { result } = await montar();
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(result.current.anoPlano).toBe(2026);
    expect(result.current.planData.companyProfile.name).toBe('A');
    expect(result.current.anosDisponiveis).toEqual([2026]);
    expect(result.current.proximoAnoDisponivel).toBe(2027);
    await avancar(10000);
    expect(gravarMock).not.toHaveBeenCalled();
  });

  it('volta em 2028 só com o 2026 e a criação falha: oferece 2029, não 2027', async () => {
    vi.setSystemTime(new Date(2028, 2, 1));
    const docs: Record<number, any> = { 2026: perfil('A') };
    bancoCom(docs);
    const criados = criacaoSobre(docs);
    criarMock.mockRejectedValueOnce(negado());
    const { result } = await montar();
    expect(result.current.anoPlano).toBe(2026);
    expect(result.current.proximoAnoDisponivel).toBe(2029);
    await act(async () => { await result.current.comecarProximoAno(); });
    expect(criados.mock.calls.map(c => c[0])).toEqual([2029]);
    expect(result.current.anoPlano).toBe(2029);
  });

  it('cliente sem plano abre o ano do primeiro plano sem gravar', async () => {
    bancoCom({});
    const { result } = await montar();
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(result.current.anosDisponiveis).toEqual([2027]);
    await avancar(10000);
    expect(gravarMock).not.toHaveBeenCalled();
    act(() => result.current.updateCompanyProfile('name', 'Nova'));
    await avancar(3500);
    expect(anosGravados()).toEqual([2027]);
  });

  it('carga monta do valor inicial, não do estado anterior', async () => {
    bancoCom({ 2026: perfil('A') });
    const { result } = await montar();
    const r = result.current;
    expect(r.goals2026.inflacaoPrevista).toBe(4.5);
    expect(r.goals2026.financeiras.metaReceita).toEqual({});
    expect(r.scenarios2026.Otimista.growthPercentage).toBe(20);
    expect(r.scenarios2026.Conservador.growthPercentage).toBe(10);
    expect(r.scenarios2026.Disruptivo.growthPercentage).toBe(-5);
    expect(r.tracking2026).toEqual({});
    expect(r.taxes.regimeTributario).toBe('Simples Nacional');
    expect(r.taxes.iss).toBe(0);
    expect(r.pricingItems).toEqual([]);
  });

  it('"Apagar tudo" no 2027 não toca o 2026', async () => {
    bancoCom({ 2026: perfil('A'), 2027: perfil('B') });
    const { result } = await montar();
    await act(() => result.current.resetAllData());
    await avancar(5000);
    expect(gravarMock).toHaveBeenCalled();
    expect(new Set(anosGravados())).toEqual(new Set([2027]));
  });

  it('carga negada e acesso liberado recarrega o mesmo ano', async () => {
    acessoMock.mockResolvedValueOnce({ status: 'pendente' } as any).mockResolvedValue({ status: 'liberado' } as any);
    bancoCom({ 2026: perfil('A'), 2027: perfil('B') });
    const respostaDoBanco = lerMock.getMockImplementation()!;
    let liberado = false;
    lerMock.mockImplementation(async (c: unknown, uid: string, ano: number) => {
      if (ano === 2027 && !liberado) throw negado();
      return respostaDoBanco(c, uid, ano);
    });
    const { result } = await montar();
    expect(result.current.estadoDaCarga).toBe('falhou');
    liberado = true;
    await act(() => result.current.checkSubscription());
    expect(leiturasDe(2027)).toHaveLength(2);
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.planData.companyProfile.name).toBe('B');
  });

  it('listagem negada e acesso liberado refaz a listagem', async () => {
    acessoMock.mockResolvedValueOnce({ status: 'pendente' } as any).mockResolvedValue({ status: 'liberado' } as any);
    bancoCom({ 2026: perfil('A'), 2027: perfil('B') });
    const listar = listarMock.getMockImplementation()!;
    listarMock.mockRejectedValueOnce(negado()).mockImplementation(listar);
    const { result } = await montar();
    expect(result.current.estadoDaCarga).toBe('falhou');
    await act(() => result.current.checkSubscription());
    expect(listarMock).toHaveBeenCalledTimes(2);
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(result.current.anoPlano).toBe(2027);
  });
});

function adiado<T = void>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>(r => { resolver = r; });
  return { promessa, resolver };
}

const ordemDaGravacao = (ano: number, n = 0) =>
  gravarMock.mock.invocationCallOrder.filter((_, i) => gravarMock.mock.calls[i][2] === ano)[n];
// A última leitura do ano: a da troca, não a da abertura.
const ordemDaLeitura = (ano: number) =>
  lerMock.mock.invocationCallOrder.filter((_, i) => lerMock.mock.calls[i][2] === ano).slice(-1)[0];
const leiturasDe = (ano: number) => lerMock.mock.calls.filter(c => c[2] === ano);
// O `dados` de cada gravação do ano, em ordem.
const gravacoesDe = (ano: number) => gravarMock.mock.calls.filter(c => c[2] === ano).map(c => c[3] as any);

// Criação de faz de conta sobre o mesmo banco do bancoCom: como o insert que ignora a linha existente,
// só grava (e registra em `criados`) o ano que ainda não existe.
function criacaoSobre(docs: Record<number, any>) {
  const criados = vi.fn((ano: number, dados: any) => { docs[ano] = dados; });
  criarMock.mockImplementation(async (_c: unknown, _uid: string, ano: number, anoOrigem: number, iniciais: any) => {
    if (ano in docs) return;
    criados(ano, montarPlanoDoAnoSeguinte(docs[anoOrigem] ?? {}, iniciais, ano - anoOrigem));
  });
  return criados;
}

describe('usePlanData — trocar de ano e começar o seguinte', () => {
  it('trocar com edição pendente grava o 2026 e só então carrega 2027', async () => {
    bancoCom({ 2026: perfil('A'), 2027: perfil('B') });
    const { result } = await montar();
    await act(() => result.current.trocarAno(2026));
    act(() => result.current.updateCompanyProfile('name', 'A2'));
    let trocou: boolean | undefined;
    await act(async () => { trocou = await result.current.trocarAno(2027); });
    expect(trocou).toBe(true);
    expect(ordemDaGravacao(2026)).toBeLessThan(ordemDaLeitura(2027)!);
    expect(gravacoesDe(2026)[0].planData.companyProfile.name).toBe('A2');
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.planData.companyProfile.name).toBe('B');
    await avancar(10000);
    expect(gravacoesDe(2027).filter(d => d.planData.companyProfile.name === 'A2')).toEqual([]);
  });

  it('trocar com gravação falhando continua no ano aberto', async () => {
    emNovembroDe2025();
    bancoCom({ 2026: perfil('A') });
    const { result } = await montar();
    gravarMock.mockRejectedValue(negado());
    act(() => result.current.updateCompanyProfile('name', 'A2'));
    let trocou: boolean | undefined;
    await act(async () => { trocou = await result.current.trocarAno(2027); });
    expect(trocou).toBe(false);
    expect(result.current.anoPlano).toBe(2026);
    expect(result.current.planData.companyProfile.name).toBe('A2');
    expect(leiturasDe(2027)).toEqual([]);
    expect(result.current.motivoDoErroAoSalvar).toContain('acesso');
  });

  it('troca espera a gravação em andamento', async () => {
    emNovembroDe2025();
    bancoCom({ 2026: perfil('A') });
    const { result } = await montar();
    const primeira = adiado();
    gravarMock.mockImplementationOnce(() => primeira.promessa as any);
    act(() => result.current.updateCompanyProfile('name', 'A2'));
    await avancar(3500);
    expect(result.current.saveStatus).toBe('saving');
    act(() => result.current.updateCompanyProfile('name', 'A3'));
    let troca!: Promise<boolean>;
    act(() => { troca = result.current.trocarAno(2027); });
    await act(async () => {});
    expect(leiturasDe(2027)).toEqual([]);
    await act(async () => { primeira.resolver(); await troca; });
    const gravacoes = gravacoesDe(2026);
    expect(gravacoes).toHaveLength(2);
    expect(gravacoes[1].planData.companyProfile.name).toBe('A3');
    expect(ordemDaGravacao(2026, 1)).toBeLessThan(ordemDaLeitura(2027)!);
    expect(result.current.anoPlano).toBe(2027);
  });

  it('ano sem documento começa dos valores iniciais em todos os blocos e a primeira gravação não leva nada do 2026', async () => {
    emNovembroDe2025();
    bancoCom({ 2026: perfil('A', {
      goals2026: { inflacaoPrevista: 9 },
      taxes: { iss: 5 },
      scenarios2026: { Otimista: { growthPercentage: 37 } },
      tracking2026: { jan: { receitaRealizada: 777 } },
      pricingItems: [{ id: 'p2026', name: 'Produto de 2026' }],
    }) });
    const { result } = await montar();
    expect(result.current.goals2026.inflacaoPrevista).toBe(9);
    expect(result.current.taxes.iss).toBe(5);
    expect(result.current.scenarios2026.Otimista.growthPercentage).toBe(37);
    expect(result.current.tracking2026).toEqual({ jan: { receitaRealizada: 777 } });
    expect(result.current.pricingItems).toHaveLength(1);
    await act(() => result.current.trocarAno(2027));
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.planData.companyProfile.name).toBe('');
    expect(result.current.goals2026.inflacaoPrevista).toBe(4.5);
    expect(result.current.goals2026.financeiras.metaReceita).toEqual({});
    expect(result.current.taxes.iss).toBe(0);
    expect(result.current.scenarios2026.Otimista.growthPercentage).toBe(20);
    expect(result.current.tracking2026).toEqual({});
    expect(result.current.pricingItems).toEqual([]);
    await avancar(10000);
    expect(gravarMock).not.toHaveBeenCalled();
    act(() => result.current.updateCompanyProfile('name', 'B'));
    await avancar(10000);
    const gravacoes = gravacoesDe(2027);
    expect(gravacoes.length).toBeGreaterThan(0);
    const gravado = gravacoes.slice(-1)[0];
    expect(gravado.planData.companyProfile.name).toBe('B');
    expect(gravado.goals2026.inflacaoPrevista).toBe(4.5);
    expect(gravado.taxes.iss).toBe(0);
    expect(gravado.scenarios2026.Otimista.growthPercentage).toBe(20);
    expect(gravado.tracking2026).toEqual({});
    expect(gravado.pricingItems).toEqual([]);
    expect(JSON.stringify(gravado)).not.toMatch(/Produto de 2026|receitaRealizada/);
    expect(gravacoesDe(2026)).toEqual([]);
  });

  it('troca rápida: só a última carga entra', async () => {
    bancoCom({ 2026: perfil('A'), 2027: perfil('B') });
    const { result } = await montar();
    const respostaDoBanco = lerMock.getMockImplementation()!;
    const de2027 = adiado();
    lerMock.mockImplementation(async (c: unknown, uid: string, ano: number) => {
      if (ano === 2027) await de2027.promessa;
      return respostaDoBanco(c, uid, ano);
    });
    let primeira!: Promise<boolean>;
    await act(async () => {
      primeira = result.current.trocarAno(2027);
      await result.current.trocarAno(2026);
    });
    expect(result.current.planData.companyProfile.name).toBe('A');
    await act(async () => { de2027.resolver(); await primeira; });
    expect(result.current.anoPlano).toBe(2026);
    expect(result.current.planData.companyProfile.name).toBe('A');
    expect(result.current.estadoDaCarga).toBe('carregado');
  });

  it('começar 2027 depois da criação automática falhar cria a cópia e abre', async () => {
    const docs: Record<number, any> = { 2026: perfil('A') };
    bancoCom(docs);
    const criados = criacaoSobre(docs);
    criarMock.mockRejectedValueOnce(negado());
    const { result } = await montar();
    expect(result.current.anoPlano).toBe(2026);
    let comecou: boolean | undefined;
    await act(async () => { comecou = await result.current.comecarProximoAno(); });
    expect(comecou).toBe(true);
    expect(criados).toHaveBeenCalledTimes(1);
    expect(criados.mock.calls[0][0]).toBe(2027);
    expect(criados.mock.calls[0][1].planData.companyProfile.name).toBe('A');
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.planData.companyProfile.name).toBe('A');
    expect(result.current.anosDisponiveis).toEqual([2026, 2027]);
    expect(result.current.criandoAno).toBe(false);
  });

  it('começar 2027 quando outra aba já criou abre o existente', async () => {
    const docs: Record<number, any> = { 2026: perfil('A') };
    bancoCom(docs);
    const criados = criacaoSobre(docs);
    criarMock.mockRejectedValueOnce(negado());
    const { result } = await montar();
    docs[2027] = perfil('B');
    await act(async () => { await result.current.comecarProximoAno(); });
    expect(criados).not.toHaveBeenCalled();
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.planData.companyProfile.name).toBe('B');
  });

  it('começar duas vezes seguidas cria uma vez só', async () => {
    const docs: Record<number, any> = { 2026: perfil('A') };
    bancoCom(docs);
    criacaoSobre(docs);
    criarMock.mockRejectedValueOnce(negado());
    const { result } = await montar();
    await act(async () => {
      await Promise.all([result.current.comecarProximoAno(), result.current.comecarProximoAno()]);
    });
    // Uma da abertura (negada) e uma só do botão.
    expect(criarMock).toHaveBeenCalledTimes(2);
    expect(result.current.anoPlano).toBe(2027);
  });

  it('trocar para 2026 enquanto 2027 é criado: a criação termina, 2027 entra na lista e o 2026 continua aberto', async () => {
    const docs: Record<number, any> = { 2026: perfil('A') };
    bancoCom(docs);
    const criados = criacaoSobre(docs);
    const transacao = adiado();
    const criar = criarMock.getMockImplementation()!;
    criarMock.mockImplementation(async (...args: any[]) => { await transacao.promessa; return criar(...args); });
    criarMock.mockRejectedValueOnce(negado());
    const { result } = await montar();
    let criacao!: Promise<boolean>;
    act(() => { criacao = result.current.comecarProximoAno(); });
    await act(async () => {});
    expect(result.current.criandoAno).toBe(true);
    await act(() => result.current.trocarAno(2026));
    await act(async () => { transacao.resolver(); await criacao; });
    expect(criados.mock.calls[0][0]).toBe(2027);
    expect(result.current.anoPlano).toBe(2026);
    expect(result.current.planData.companyProfile.name).toBe('A');
    expect(result.current.anosDisponiveis).toEqual([2026, 2027]);
    expect(result.current.criandoAno).toBe(false);
  });

  it('proximoAnoDisponivel em 10/11/2026: [2026] dá 2027; depois de começar 2027, nenhum', async () => {
    const docs: Record<number, any> = { 2026: perfil('A') };
    bancoCom(docs);
    criacaoSobre(docs);
    criarMock.mockRejectedValueOnce(negado());
    const { result } = await montar();
    expect(result.current.proximoAnoDisponivel).toBe(2027);
    await act(async () => { await result.current.comecarProximoAno(); });
    expect(result.current.proximoAnoDisponivel).toBeNull();
  });
});

// Sem servidor configurado, o plano mora no navegador (uma chave por ano).
async function importarSemServidor() {
  vi.doMock('../services/supabase', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../services/supabase')>()),
    semServidor: true,
  }));
  vi.resetModules();
  return import('./usePlanData');
}

describe('usePlanData — modo offline, uma chave por ano', () => {
  afterEach(() => {
    vi.doUnmock('../services/supabase');
    vi.resetModules();
  });

  it('abre 2027 e grava só na chave de 2027', async () => {
    const offline = await importarSemServidor();
    const legado = JSON.stringify(perfil('A'));
    localStorage.setItem('plan_data_u1', legado);
    localStorage.setItem('plan_data_u1_2027', JSON.stringify(perfil('B')));
    const envolver = ({ children }: { children: React.ReactNode }) => (
      <offline.PlanProvider user={USUARIO}>{children}</offline.PlanProvider>
    );
    const { result } = renderHook(() => offline.usePlan(), { wrapper: envolver });
    await act(async () => {});
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.planData.companyProfile.name).toBe('B');
    act(() => result.current.updateCompanyProfile('name', 'B2'));
    await avancar(3500);
    expect(JSON.parse(localStorage.getItem('plan_data_u1_2027')!).planData.companyProfile.name).toBe('B2');
    expect(localStorage.getItem('plan_data_u1')).toBe(legado);
    expect(lerMock).not.toHaveBeenCalled();
  });
});

describe('usePlanData — modo offline, ano seguinte', () => {
  afterEach(() => {
    vi.doUnmock('../services/supabase');
    vi.resetModules();
  });

  it('só com o legado local cria a chave de 2027 a partir dele e abre', async () => {
    const offline = await importarSemServidor();
    const legado = JSON.stringify(perfil('A'));
    localStorage.setItem('plan_data_u1', legado);
    const envolver = ({ children }: { children: React.ReactNode }) => (
      <offline.PlanProvider user={USUARIO}>{children}</offline.PlanProvider>
    );
    const { result } = renderHook(() => offline.usePlan(), { wrapper: envolver });
    await act(async () => {});
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.planData.companyProfile.name).toBe('A');
    expect(JSON.parse(localStorage.getItem('plan_data_u1_2027')!).planData.companyProfile.name).toBe('A');
    expect(localStorage.getItem('plan_data_u1')).toBe(legado);
  });
});

describe('usePlanData — CBS no plano 2027', () => {
  // Base: R 1,2 mi e V 480 mil → CBS 6,78. Score de mercado vazio (−1,5): crescimento 8,5% → janeiro 108.500.
  const doc = () => perfil('B', {
    planData: { financialSheet: baseDeExemplo() },
    taxes: { regimeTributario: 'Lucro Presumido', iss: 5, pis: 0.65, cofins: 3, irpj: 4.8, csll: 2.88 },
    scenarios2026: { Conservador: { growthPercentage: 10, projection: projecaoVazia() } },
  });

  it('plano 2027 abre com a CBS no cenário e não grava', async () => {
    bancoCom({ 2027: doc() });
    const { result } = await montar();
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.scenarios2026.Conservador.projection.impostosSobreFaturamento.jan).toBeCloseTo(12781.3);
    await avancar(10000);
    expect(gravarMock).not.toHaveBeenCalled();
  });

  it('o mesmo plano em 2026 continua com PIS e COFINS', async () => {
    emNovembroDe2025();
    bancoCom({ 2026: doc() });
    const { result } = await montar();
    expect(result.current.anoPlano).toBe(2026);
    expect(result.current.scenarios2026.Conservador.projection.impostosSobreFaturamento.jan).toBeCloseTo(9385.25);
    await avancar(10000);
    expect(gravarMock).not.toHaveBeenCalled();
  });

  it('CBS digitada no 2027 recalcula o cenário', async () => {
    bancoCom({ 2027: doc() });
    const { result } = await montar();
    act(() => result.current.updateTaxes('cbsEfetiva', '8'));
    await act(async () => {});
    expect(result.current.scenarios2026.Conservador.projection.impostosSobreFaturamento.jan).toBeCloseTo(14105);
  });

  it('sensibilidade no 2027 reconstrói a receita bruta com a CBS', async () => {
    bancoCom({ 2027: doc() });
    const { result } = await montar();
    // 30.000 − 7,68% × 100.000 ÷ (1 − 11,78%)
    expect(result.current.calculateSensitivityAnalysis(100000, 40000, 30000, 20)[2][2].netProfit).toBeCloseTo(21294.49);
  });

  it('sensibilidade no mesmo documento em 2026 usa PIS e COFINS', async () => {
    emNovembroDe2025();
    bancoCom({ 2026: doc() });
    const { result } = await montar();
    // 30.000 − 7,68% × 100.000 ÷ (1 − 8,65%)
    expect(result.current.calculateSensitivityAnalysis(100000, 40000, 30000, 20)[2][2].netProfit).toBeCloseTo(21592.775);
  });
});
