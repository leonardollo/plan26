import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ConfigDoCheckout } from '../utils/checkout';

const { falsos, checkout } = vi.hoisted(() => ({
  falsos: { checkSubscription: vi.fn(async () => {}), emailAtual: vi.fn(() => 'ana@x.com') },
  checkout: { config: null as ConfigDoCheckout | null },
}));

vi.mock('../hooks/usePlanData', () => ({
  usePlan: () => ({ checkSubscription: falsos.checkSubscription }),
  authService: { emailAtual: falsos.emailAtual },
}));
vi.mock('../utils/checkout', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/checkout')>()),
  get CHECKOUT() {
    return checkout.config;
  },
}));

import AguardandoLiberacao from './AguardandoLiberacao';

beforeEach(() => {
  vi.clearAllMocks();
  checkout.config = null;
});
afterEach(cleanup);

describe('AguardandoLiberacao', () => {
  it('removido: conta desativada, pede para falar com a GI e oferece Sair', () => {
    const sair = vi.fn();
    render(<AguardandoLiberacao onLogout={sair} removido />);
    expect(screen.getByText('Sua conta foi desativada')).toBeTruthy();
    expect(screen.getByText('Fale com a Gestão de Impacto para reativar.')).toBeTruthy();
    expect(screen.queryByText('Seu cadastro foi recebido')).toBeNull();
    expect(screen.queryByText('Já fui liberado, conferir')).toBeNull();
    fireEvent.click(screen.getByText('Sair'));
    expect(sair).toHaveBeenCalledTimes(1);
  });

  it('sem removido, o texto de hoje continua', () => {
    render(<AguardandoLiberacao onLogout={() => {}} />);
    expect(screen.getByText('Seu cadastro foi recebido')).toBeTruthy();
    expect(screen.getByText('Já fui liberado, conferir')).toBeTruthy();
    expect(screen.queryByText('Sua conta foi desativada')).toBeNull();
  });

  it('bloqueado continua com o aviso de suspensão', () => {
    render(<AguardandoLiberacao onLogout={() => {}} bloqueado />);
    expect(screen.getByText('Acesso suspenso')).toBeTruthy();
    expect(screen.queryByText('Sua conta foi desativada')).toBeNull();
  });

  it('pendente vê o cartão com o próprio e-mail e o aviso', () => {
    checkout.config = { url: 'https://pay.hotmart.com/X', preco: 'R$ 497' };
    render(<AguardandoLiberacao onLogout={() => {}} />);
    expect(screen.getByText('Seu cadastro foi recebido')).toBeTruthy();
    expect((screen.getByRole('link', { name: 'Assinar' }) as HTMLAnchorElement).href).toBe(
      'https://pay.hotmart.com/X?email=ana%40x.com',
    );
    expect(screen.getByText('Pague com este mesmo e-mail; o acesso libera em poucos minutos')).toBeTruthy();
  });

  it('o botão Já paguei, verificar chama checkSubscription', async () => {
    checkout.config = { url: 'https://pay.hotmart.com/X', preco: null };
    render(<AguardandoLiberacao onLogout={() => {}} />);
    expect(screen.queryByText('Já fui liberado, conferir')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Já paguei, verificar' }));
    });
    expect(falsos.checkSubscription).toHaveBeenCalledTimes(1);
  });

  it('bloqueado e removido não veem o cartão', () => {
    checkout.config = { url: 'https://pay.hotmart.com/X', preco: 'R$ 497' };
    render(<AguardandoLiberacao onLogout={() => {}} bloqueado />);
    expect(screen.queryByText(/Plano anual/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    cleanup();
    render(<AguardandoLiberacao onLogout={() => {}} removido />);
    expect(screen.queryByText(/Plano anual/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
