import { describe, expect, it } from 'vitest';
import { configDoCheckout, linkDoCheckout } from './checkout';

describe('configDoCheckout', () => {
  it('link válido com preço', () => {
    expect(configDoCheckout({ VITE_HOTMART_CHECKOUT_URL: 'https://pay.hotmart.com/X', VITE_PRECO_ANUAL: 'R$ 497' })).toEqual({
      url: 'https://pay.hotmart.com/X',
      preco: 'R$ 497',
    });
  });

  it('sem link → null', () => {
    expect(configDoCheckout({})).toBeNull();
    expect(configDoCheckout({ VITE_HOTMART_CHECKOUT_URL: '', VITE_PRECO_ANUAL: 'R$ 497' })).toBeNull();
  });

  it('http://pay.hotmart.com/X → null', () => {
    expect(configDoCheckout({ VITE_HOTMART_CHECKOUT_URL: 'http://pay.hotmart.com/X' })).toBeNull();
  });

  it('https://evil.com/pay.hotmart.com → null', () => {
    expect(configDoCheckout({ VITE_HOTMART_CHECKOUT_URL: 'https://evil.com/pay.hotmart.com' })).toBeNull();
    expect(configDoCheckout({ VITE_HOTMART_CHECKOUT_URL: 'https://pay.hotmart.com.evil.com/X' })).toBeNull();
  });

  it('texto solto → null', () => {
    expect(configDoCheckout({ VITE_HOTMART_CHECKOUT_URL: 'compre aqui' })).toBeNull();
  });

  it('preço vazio → preco null', () => {
    expect(configDoCheckout({ VITE_HOTMART_CHECKOUT_URL: 'https://pay.hotmart.com/X', VITE_PRECO_ANUAL: '  ' })).toEqual({
      url: 'https://pay.hotmart.com/X',
      preco: null,
    });
  });
});

describe('linkDoCheckout', () => {
  const config = { url: 'https://pay.hotmart.com/X?off=abc', preco: null };

  it('linkDoCheckout acrescenta o e-mail codificado e mantém ?off=abc', () => {
    const link = linkDoCheckout(config, 'a+b@x.com');
    expect(link).toContain('off=abc');
    expect(link).toContain('email=a%2Bb%40x.com');
    expect(new URL(link).host).toBe('pay.hotmart.com');
  });

  it('sem e-mail → url inalterada', () => {
    expect(linkDoCheckout(config)).toBe(config.url);
    expect(linkDoCheckout(config, null)).toBe(config.url);
    expect(linkDoCheckout(config, '')).toBe(config.url);
  });
});
