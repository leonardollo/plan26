import { describe, expect, it } from 'vitest';
import { lerAviso, tokenConfere } from './aviso';

function aviso(evento: string, status?: string, extra: Record<string, unknown> = {}) {
  return {
    event: evento,
    data: {
      purchase: { transaction: 'HP123', ...(status ? { status } : {}) },
      buyer: { email: 'ana@x.com' },
      product: { id: 900001 },
      ...extra,
    },
  };
}

describe('lerAviso', () => {
  it('aprova só com evento e status pagos', () => {
    expect(lerAviso(aviso('PURCHASE_APPROVED', 'APPROVED')).tipo).toBe('aprova');
    expect(lerAviso(aviso('PURCHASE_APPROVED', 'WAITING_PAYMENT')).tipo).toBe('ignora');
    expect(lerAviso(aviso('PURCHASE_APPROVED')).tipo).toBe('ignora');
    expect(lerAviso(aviso('PURCHASE_COMPLETE', 'COMPLETED')).tipo).toBe('aprova');
    expect(lerAviso(aviso('PURCHASE_COMPLETE', 'COMPLETE')).tipo).toBe('aprova');
  });

  it('estorno e chargeback estornam', () => {
    expect(lerAviso(aviso('PURCHASE_REFUNDED', 'REFUNDED')).tipo).toBe('estorna');
    expect(lerAviso(aviso('PURCHASE_CHARGEBACK', 'CHARGEBACK')).tipo).toBe('estorna');
  });

  it('ex14: cancelamento, atraso, troca de data e boleto impresso são ignorados', () => {
    for (const evento of [
      'PURCHASE_CANCELED',
      'PURCHASE_DELAYED',
      'SUBSCRIPTION_CANCELLATION',
      'UPDATE_SUBSCRIPTION_CHARGE_DATE',
      'PURCHASE_BILLET_PRINTED',
    ]) {
      expect(lerAviso(aviso(evento, 'APPROVED')).tipo, evento).toBe('ignora');
    }
  });

  it('lê evento e transação', () => {
    const a = lerAviso(aviso('PURCHASE_APPROVED', 'APPROVED'));
    expect(a).toMatchObject({ evento: 'PURCHASE_APPROVED', transacao: 'HP123' });
  });

  it('e-mail de data.buyer.email, senão data.subscriber.email, normalizado', () => {
    expect(lerAviso({ data: { buyer: { email: ' Ana@X.com ' } } }).email).toBe('ana@x.com');
    expect(lerAviso({ data: { subscriber: { email: 'Bia@Y.com' } } }).email).toBe('bia@y.com');
    expect(lerAviso({ data: { buyer: { email: 'sem-arroba' }, subscriber: { email: 'c@z.com' } } }).email).toBe('c@z.com');
    expect(lerAviso({ data: { buyer: { email: 'sem-arroba' } } }).email).toBeNull();
  });

  it('produto numérico vira texto e vem de data.product.id ou alternativas', () => {
    expect(lerAviso({ data: { product: { id: 123 } } }).produtoId).toBe('123');
    expect(lerAviso({ data: { purchase: { product: { id: '9' } } } }).produtoId).toBe('9');
    expect(lerAviso({ data: { subscription: { product: { id: 77 } } } }).produtoId).toBe('77');
  });

  it('payload estranho não estoura', () => {
    for (const p of [null, [], 'x', { data: 5 }, 42, undefined]) {
      expect(lerAviso(p)).toMatchObject({ tipo: 'ignora', transacao: null, email: null, produtoId: null });
    }
  });

  it('transação com quebra de linha é limpa e cortada em 64', () => {
    const longa = `HP\n${'9'.repeat(100)}`;
    const a = lerAviso({ event: 'PURCHASE_APPROVED', data: { purchase: { transaction: longa, status: 'APPROVED' } } });
    expect(a.transacao).toBe(`HP${'9'.repeat(62)}`);
    expect(a.transacao).toHaveLength(64);
    expect(lerAviso({ data: { purchase: { transaction: '\n\t ' } } }).transacao).toBeNull();
  });
});

describe('tokenConfere', () => {
  it('igual passa; diferente, prefixo ou vazio não', () => {
    expect(tokenConfere('segredo-123', 'segredo-123')).toBe(true);
    expect(tokenConfere('segredo-124', 'segredo-123')).toBe(false);
    expect(tokenConfere('segredo', 'segredo-123')).toBe(false);
    expect(tokenConfere('segredo-123-mais', 'segredo-123')).toBe(false);
    expect(tokenConfere('', 'segredo-123')).toBe(false);
    expect(tokenConfere('', '')).toBe(false);
  });
});
