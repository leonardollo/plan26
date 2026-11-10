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
});
