import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const { authFalso, banco, doCliente } = vi.hoisted(() => ({
  authFalso: { signOut: vi.fn(), refreshSession: vi.fn(), onAuthStateChange: vi.fn(), resend: vi.fn() },
  banco: { listarPlanos: vi.fn(), carregarPlano: vi.fn(), salvarPlano: vi.fn(), criarPlanoSeNaoExistir: vi.fn() },
  doCliente: { anosDoCliente: vi.fn(), planoDoCliente: vi.fn(), salvarPlanoDoCliente: vi.fn() },
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: authFalso })) }));
vi.mock('../services/planos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/planos')>()),
  ...banco,
}));
vi.mock('../services/planoDoCliente', () => doCliente);
vi.mock('../services/acesso', () => ({
  ehAdministrador: vi.fn(),
  obterAcesso: vi.fn(),
  listarAcessos: vi.fn(),
  definirStatus: vi.fn(),
}));
vi.mock('../services/geminiService');

import { ehAdministrador, obterAcesso } from '../services/acesso';
import { chaveLocalDoPlano } from '../services/planos';
import { PlanProvider, usePlan } from './usePlanData';
import type { PlanoDeCliente } from '../types';

const ADMIN = { uid: 'adm', email: 'admin@gi.com', name: 'Admin', emailVerified: true } as any;
const CLIENTE: PlanoDeCliente = { uid: 'c1', email: 'cli@x.com', nome: 'Cliente' };
const ABERTO_EM = new Date('2026-11-10T09:00:00Z');
const GRAVADO_EM = new Date('2026-11-10T09:30:00Z');

const ehAdminMock = vi.mocked(ehAdministrador);
const acessoMock = vi.mocked(obterAcesso);

function documento(nome = 'Empresa do Cliente', geminiApiKey = '') {
  return { planData: { companyProfile: { name: nome, cnpj: '', industry: '', geminiApiKey } } } as any;
}

function comCliente({ children }: { children: React.ReactNode }) {
  return <PlanProvider user={ADMIN} planoDeCliente={CLIENTE}>{children}</PlanProvider>;
}

function normal({ children }: { children: React.ReactNode }) {
  return <PlanProvider user={ADMIN}>{children}</PlanProvider>;
}

async function montar(wrapper = comCliente) {
  const r = renderHook(() => usePlan(), { wrapper });
  await act(async () => {});
  return r;
}

const avancar = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  // 10/11/2026: o plano do ano seguinte é 2027.
  vi.setSystemTime(new Date(2026, 10, 10));
  vi.clearAllMocks();
  localStorage.clear();
  banco.listarPlanos.mockResolvedValue([]);
  banco.carregarPlano.mockResolvedValue(null);
  banco.salvarPlano.mockResolvedValue(undefined);
  banco.criarPlanoSeNaoExistir.mockResolvedValue(undefined);
  doCliente.anosDoCliente.mockResolvedValue([2026, 2027]);
  doCliente.planoDoCliente.mockResolvedValue({ dados: documento(), atualizadoEm: ABERTO_EM });
  doCliente.salvarPlanoDoCliente.mockResolvedValue(GRAVADO_EM);
  ehAdminMock.mockResolvedValue(true);
  acessoMock.mockResolvedValue({ status: 'liberado' } as any);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PlanProvider com o plano de um cliente', () => {
  it('não confere o acesso do admin: ativo, sem painel de admin', async () => {
    const { result } = await montar();
    expect(ehAdminMock).not.toHaveBeenCalled();
    expect(acessoMock).not.toHaveBeenCalled();
    expect(result.current.subscriptionStatus).toBe('active');
    expect(result.current.souAdmin).toBe(false);
    expect(result.current.planoDeCliente).toEqual(CLIENTE);
  });

  it('abre o ano do plano atual quando o cliente o tem, e mostra quando foi gravado', async () => {
    const { result } = await montar();
    expect(doCliente.anosDoCliente).toHaveBeenCalledWith(expect.anything(), 'c1');
    expect(doCliente.planoDoCliente).toHaveBeenCalledWith(expect.anything(), 'c1', 2027);
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.planData.companyProfile.name).toBe('Empresa do Cliente');
    expect(result.current.atualizadoEmNoBanco).toEqual(ABERTO_EM);
    expect(banco.listarPlanos).not.toHaveBeenCalled();
    expect(banco.carregarPlano).not.toHaveBeenCalled();
  });

  it('sem o ano atual, abre o maior ano salvo e não cria nada', async () => {
    doCliente.anosDoCliente.mockResolvedValue([2025, 2026]);
    const { result } = await montar();
    expect(doCliente.planoDoCliente).toHaveBeenCalledWith(expect.anything(), 'c1', 2026);
    expect(result.current.anoPlano).toBe(2026);
    expect(banco.criarPlanoSeNaoExistir).not.toHaveBeenCalled();
    expect(result.current.proximoAnoDisponivel).toBeNull();
    let criou = true;
    await act(async () => { criou = await result.current.comecarProximoAno(); });
    expect(criou).toBe(false);
    expect(banco.criarPlanoSeNaoExistir).not.toHaveBeenCalled();
  });

  it('cliente sem plano: abre o ano atual vazio e nada é gravado até a primeira edição', async () => {
    doCliente.anosDoCliente.mockResolvedValue([]);
    doCliente.planoDoCliente.mockResolvedValue(null);
    const { result } = await montar();
    expect(result.current.anoPlano).toBe(2027);
    expect(result.current.estadoDaCarga).toBe('carregado');
    expect(result.current.atualizadoEmNoBanco).toBeNull();
    await avancar(5000);
    expect(doCliente.salvarPlanoDoCliente).not.toHaveBeenCalled();
    expect(banco.salvarPlano).not.toHaveBeenCalled();
  });

  it('uma edição grava no plano do cliente depois do debounce, nunca no do admin', async () => {
    const { result } = await montar();
    act(() => result.current.updateCompanyProfile('name', 'Editado pelo admin'));
    await avancar(3500);
    expect(doCliente.salvarPlanoDoCliente).toHaveBeenCalledTimes(1);
    const [, alvo, ano, dados] = doCliente.salvarPlanoDoCliente.mock.calls[0];
    expect([alvo, ano]).toEqual(['c1', 2027]);
    expect(dados.planData.companyProfile.name).toBe('Editado pelo admin');
    expect(banco.salvarPlano).not.toHaveBeenCalled();
    expect(result.current.atualizadoEmNoBanco).toEqual(GRAVADO_EM);
  });

  it('desmontar com gravação pendente descarrega no plano do cliente', async () => {
    const { result, unmount } = await montar();
    act(() => result.current.updateCompanyProfile('name', 'Antes de fechar'));
    await avancar(500);
    expect(doCliente.salvarPlanoDoCliente).not.toHaveBeenCalled();
    await act(async () => { unmount(); });
    expect(doCliente.salvarPlanoDoCliente).toHaveBeenCalledTimes(1);
    const [, alvo, , dados] = doCliente.salvarPlanoDoCliente.mock.calls[0];
    expect(alvo).toBe('c1');
    expect(dados.planData.companyProfile.name).toBe('Antes de fechar');
    expect(banco.salvarPlano).not.toHaveBeenCalled();
  });

  it('não lê, grava nem remove nada no localStorage do admin', async () => {
    doCliente.planoDoCliente.mockResolvedValue({ dados: documento('Cliente', 'chave-do-cliente'), atualizadoEm: ABERTO_EM });
    localStorage.setItem('google_gemini_api_key', 'chave-do-admin');
    localStorage.setItem(chaveLocalDoPlano('adm', 2027), '{"do":"admin"}');
    const antes = { ...localStorage };
    const leitura = vi.spyOn(Storage.prototype, 'getItem');

    const { result, unmount } = await montar();
    act(() => result.current.updateCompanyProfile('name', 'Outra'));
    await avancar(3500);
    act(() => result.current.updateCompanyProfile('name', 'Mais uma'));
    await act(async () => { unmount(); });

    expect({ ...localStorage }).toEqual(antes);
    expect(leitura).not.toHaveBeenCalled();
    leitura.mockRestore();
  });

  it('resetAllData grava o plano vazio no cliente', async () => {
    const { result } = await montar();
    await act(async () => { await result.current.resetAllData(); });
    expect(doCliente.salvarPlanoDoCliente).toHaveBeenCalledWith(expect.anything(), 'c1', 2027, expect.objectContaining({ pricingItems: [] }));
    expect(banco.salvarPlano).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });
});

describe('PlanProvider no modo normal', () => {
  it('acesso removido: inativo, statusAcesso removido', async () => {
    ehAdminMock.mockResolvedValue(false);
    acessoMock.mockResolvedValue({ status: 'removido' } as any);
    const { result } = await montar(normal);
    expect(result.current.subscriptionStatus).toBe('inactive');
    expect(result.current.statusAcesso).toBe('removido');
    expect(result.current.planoDeCliente).toBeNull();
    expect(result.current.atualizadoEmNoBanco).toBeNull();
    expect(doCliente.anosDoCliente).not.toHaveBeenCalled();
  });

  it('gravação recusada com 42501 mostra a mensagem de acesso', async () => {
    ehAdminMock.mockResolvedValue(false);
    banco.salvarPlano.mockRejectedValue({ code: '42501', message: 'new row violates row-level security policy' });
    const { result } = await montar(normal);
    act(() => result.current.updateCompanyProfile('name', 'Nova'));
    await avancar(3500);
    expect(result.current.saveStatus).toBe('error');
    expect(result.current.motivoDoErroAoSalvar).toBe(
      'O banco recusou a gravação: seu acesso não está liberado. Fale com a Gestão de Impacto.',
    );
    expect(doCliente.salvarPlanoDoCliente).not.toHaveBeenCalled();
  });
});
