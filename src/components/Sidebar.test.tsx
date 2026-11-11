import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const { planoFalso } = vi.hoisted(() => ({ planoFalso: {} as Record<string, any> }));

vi.mock('../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));

import Sidebar from './Sidebar';

const USUARIO = { uid: 'u1', email: 'c@x.com', name: 'C' } as any;

function plano(extra: Record<string, any> = {}) {
  Object.keys(planoFalso).forEach(k => delete planoFalso[k]);
  Object.assign(planoFalso, {
    saveStatus: 'idle', saveDataNow: vi.fn(), souAdmin: false, motivoDoErroAoSalvar: '',
    anoPlano: 2026, anosDisponiveis: [2026], proximoAnoDisponivel: 2027,
    trocarAno: vi.fn(async () => true), comecarProximoAno: vi.fn(async () => true), criandoAno: false,
    ...extra,
  });
}

const montar = () => render(<Sidebar currentView="dashboard" setCurrentView={vi.fn()} user={USUARIO} onLogout={vi.fn()} />);
const seletor = () => screen.getByLabelText('Ano do plano') as HTMLSelectElement;

beforeEach(() => {
  vi.clearAllMocks();
  plano();
});
afterEach(cleanup);

describe('Sidebar — ano do plano', () => {
  it('o cabeçalho mostra PLAN 2026 e o seletor tem 2026 escolhido', () => {
    montar();
    expect(screen.getByText('PLAN 2026')).toBeTruthy();
    expect(seletor().value).toBe('2026');
    expect([...seletor().options].map(o => o.value)).toEqual(['2026']);
  });

  it('"Começar plano 2027" chama comecarProximoAno uma vez', async () => {
    montar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Começar plano 2027' })); });
    expect(planoFalso.comecarProximoAno).toHaveBeenCalledTimes(1);
  });

  it('com criandoAno o botão fica desabilitado', () => {
    plano({ criandoAno: true });
    montar();
    expect((screen.getByRole('button', { name: /Começar plano 2027|Criando/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('com criandoAno o seletor de ano fica desabilitado; sem criação, habilitado', () => {
    plano({ criandoAno: true });
    montar();
    expect((screen.getByLabelText('Ano do plano') as HTMLSelectElement).disabled).toBe(true);
    cleanup();
    plano({ criandoAno: false });
    montar();
    expect((screen.getByLabelText('Ano do plano') as HTMLSelectElement).disabled).toBe(false);
  });

  it('sem próximo ano disponível o botão não aparece', () => {
    plano({ proximoAnoDisponivel: null });
    montar();
    expect(screen.queryByRole('button', { name: /Começar plano/ })).toBeNull();
  });

  it('escolher 2027 chama trocarAno(2027)', async () => {
    plano({ anosDisponiveis: [2026, 2027] });
    montar();
    await act(async () => { fireEvent.change(seletor(), { target: { value: '2027' } }); });
    expect(planoFalso.trocarAno).toHaveBeenCalledWith(2027);
  });

  it('troca recusada: o seletor volta a 2026', async () => {
    plano({ anosDisponiveis: [2026, 2027], trocarAno: vi.fn(async () => false) });
    montar();
    await act(async () => { fireEvent.change(seletor(), { target: { value: '2027' } }); });
    expect(planoFalso.trocarAno).toHaveBeenCalledWith(2027);
    expect(seletor().value).toBe('2026');
  });

  it('começar recusado mostra o motivo', async () => {
    plano({ comecarProximoAno: vi.fn(async () => false), motivoDoErroAoSalvar: 'O banco recusou a gravação: seu acesso não está liberado.' });
    montar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Começar plano 2027' })); });
    expect(screen.getByText('O banco recusou a gravação: seu acesso não está liberado.')).toBeTruthy();
  });

  it('rótulos do menu seguem o ano: 2026 → Coleta de Dados 2025 e Planejamento 2026', () => {
    montar();
    expect(screen.getByText('Coleta de Dados 2025')).toBeTruthy();
    expect(screen.getByText('Planejamento 2026')).toBeTruthy();
  });

  it('rótulos do menu seguem o ano: 2027 → Coleta de Dados 2026 e Planejamento 2027', () => {
    plano({ anoPlano: 2027, anosDisponiveis: [2026, 2027], proximoAnoDisponivel: null });
    montar();
    expect(screen.getByText('Coleta de Dados 2026')).toBeTruthy();
    expect(screen.getByText('Planejamento 2027')).toBeTruthy();
    expect(screen.queryByText('Coleta de Dados 2025')).toBeNull();
  });
});

describe('Sidebar — gaveta no celular', () => {
  const botaoMenu = () => screen.getByRole('button', { name: 'Abrir menu' });
  const gaveta = () => screen.getByRole('navigation', { name: 'Menu do plano' }).closest('[data-gaveta]') as HTMLElement;

  it('começa fechada e o botão de menu abre', () => {
    montar();
    expect(botaoMenu().getAttribute('aria-expanded')).toBe('false');
    expect(gaveta().dataset.gaveta).toBe('fechada');
    fireEvent.click(botaoMenu());
    expect(botaoMenu().getAttribute('aria-expanded')).toBe('true');
    expect(gaveta().dataset.gaveta).toBe('aberta');
  });

  it('escolher uma tela troca a tela e fecha a gaveta', () => {
    const setCurrentView = vi.fn();
    render(<Sidebar currentView="dashboard" setCurrentView={setCurrentView} user={USUARIO} onLogout={vi.fn()} />);
    fireEvent.click(botaoMenu());
    fireEvent.click(screen.getByText('Impostos'));
    expect(setCurrentView).toHaveBeenCalledWith('taxes');
    expect(gaveta().dataset.gaveta).toBe('fechada');
  });

  it('o fundo escuro e a tecla Esc fecham a gaveta', () => {
    montar();
    fireEvent.click(botaoMenu());
    fireEvent.click(screen.getByTestId('fundo-da-gaveta'));
    expect(gaveta().dataset.gaveta).toBe('fechada');
    fireEvent.click(botaoMenu());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(gaveta().dataset.gaveta).toBe('fechada');
  });
});

describe('Sidebar — foco na gaveta', () => {
  const botaoMenu = () => screen.getByRole('button', { name: 'Abrir menu' });
  const fechar = () => screen.getByRole('button', { name: 'Fechar menu' });
  const sair = () => screen.getByTitle('Sair');

  it('abrir leva o foco ao X; Esc devolve ao botão do menu', () => {
    montar();
    botaoMenu().focus();
    fireEvent.click(botaoMenu());
    expect(document.activeElement).toBe(fechar());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(botaoMenu());
  });

  it('Tab no último controle volta ao primeiro, e Shift+Tab no primeiro vai ao último', () => {
    montar();
    fireEvent.click(botaoMenu());
    sair().focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(fechar());
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(sair());
  });

  it('fechada, o Tab não é interceptado e o foco não é mexido', () => {
    montar();
    sair().focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(sair());
  });
});
