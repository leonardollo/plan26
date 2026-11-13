import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CartaoAssinatura from './CartaoAssinatura';

afterEach(cleanup);

const CONFIG = { url: 'https://pay.hotmart.com/X?off=abc', preco: 'R$ 497' };

describe('CartaoAssinatura', () => {
  it('com link mostra preço e Assinar com o e-mail no href', () => {
    render(<CartaoAssinatura config={CONFIG} email="a+b@x.com" />);
    expect(screen.getByText('Plano anual — R$ 497/ano')).toBeTruthy();
    expect(screen.getByText('Planejamento estratégico, comercial e financeiro completo, por um ano.')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Assinar' }) as HTMLAnchorElement;
    expect(link.href).toContain('off=abc');
    expect(link.href).toContain('email=a%2Bb%40x.com');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
  });

  it('sem preço mostra só Plano anual', () => {
    render(<CartaoAssinatura config={{ url: CONFIG.url, preco: null }} />);
    expect(screen.getByText('Plano anual')).toBeTruthy();
    expect((screen.getByRole('link', { name: 'Assinar' }) as HTMLAnchorElement).href).toBe(CONFIG.url);
  });

  it('sem config mostra Assinaturas abrem em breve e nenhum link', () => {
    render(<CartaoAssinatura config={null} email="a@x.com" mostrarAvisoDoEmail />);
    expect(screen.getByText('Assinaturas abrem em breve')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(/Pague com este mesmo e-mail/)).toBeNull();
  });

  it('aviso do e-mail só com mostrarAvisoDoEmail', () => {
    render(<CartaoAssinatura config={CONFIG} email="a@x.com" />);
    expect(screen.queryByText(/Pague com este mesmo e-mail/)).toBeNull();
    cleanup();
    render(<CartaoAssinatura config={CONFIG} email="a@x.com" mostrarAvisoDoEmail />);
    expect(screen.getByText('Pague com este mesmo e-mail; o acesso libera em poucos minutos')).toBeTruthy();
  });
});
