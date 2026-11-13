import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ConfigDoCheckout } from '../utils/checkout';

const { checkout } = vi.hoisted(() => ({ checkout: { config: null as ConfigDoCheckout | null } }));

vi.mock('../hooks/usePlanData', () => ({
  usePlan: () => ({ checkSubscription: vi.fn(async () => {}) }),
  authService: { emailAtual: () => 'ana@x.com' },
}));
vi.mock('../utils/checkout', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/checkout')>()),
  get CHECKOUT() {
    return checkout.config;
  },
}));

import SubscriptionExpiredPage from './SubscriptionExpiredPage';

beforeEach(() => {
  checkout.config = null;
});
afterEach(cleanup);

describe('SubscriptionExpiredPage', () => {
  it('vencido com checkout: Renovar leva ao link da Hotmart com o e-mail da conta', () => {
    checkout.config = { url: 'https://pay.hotmart.com/X', preco: 'R$ 497' };
    render(<SubscriptionExpiredPage status="expired" onLogout={() => {}} />);
    const link = screen.getByRole('link', { name: 'Renovar Assinatura' }) as HTMLAnchorElement;
    expect(link.href).toBe('https://pay.hotmart.com/X?email=ana%40x.com');
    expect(screen.queryByText(/hotmart\.com"/)).toBeNull();
  });

  it('vencido sem checkout: Fale com a Gestão de Impacto, sem link', () => {
    render(<SubscriptionExpiredPage status="expired" onLogout={() => {}} />);
    expect(screen.getByText('Fale com a Gestão de Impacto')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
