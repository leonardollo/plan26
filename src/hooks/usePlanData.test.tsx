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
import { PlanProvider, usePlan } from './usePlanData';

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
