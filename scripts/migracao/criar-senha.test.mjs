// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { destinatarios, enviarEmLotes } from './criar-senha.mjs';

describe('destinatarios', () => {
  it('só quem tinha senha no Firebase e já existe no Supabase, em minúsculas e sem repetir', () => {
    const r = destinatarios(
      [
        { uid: 'a', email: 'Ana@X.com', provedores: ['password'] },
        { uid: 'b', email: 'bia@x.com', provedores: ['google.com'] },
        { uid: 'c', email: 'caio@x.com', provedores: ['google.com', 'password'] },
        { uid: 'd', email: 'dani@x.com', provedores: ['password'] },
        { uid: 'e', email: null, provedores: ['password'] },
      ],
      new Set(['ana@x.com', 'bia@x.com', 'caio@x.com']),
    );
    expect(r).toEqual({ emails: ['ana@x.com', 'caio@x.com'], semContaNoSupabase: 1 });
  });
});

describe('enviarEmLotes', () => {
  it('lotes de 10 com pausa só entre eles; conta enviados e falhas', async () => {
    const emails = Array.from({ length: 23 }, (_, i) => `p${i}@x.com`);
    const ordem = [];
    const r = await enviarEmLotes(
      emails,
      async (e) => {
        ordem.push(e);
        return e === 'p5@x.com' ? { error: { message: 'limite' } } : { error: null };
      },
      async (ms) => {
        ordem.push(`pausa ${ms}`);
      },
    );
    expect(r).toEqual({ enviados: 22, falhas: ['limite'] });
    expect(ordem.filter((x) => x.startsWith('pausa'))).toEqual(['pausa 30000', 'pausa 30000']);
    expect(ordem.indexOf('pausa 30000')).toBe(10);
  });

  it('lista vazia não envia nem espera', async () => {
    let chamadas = 0;
    const r = await enviarEmLotes([], async () => ({ error: null }), async () => { chamadas++; });
    expect(r).toEqual({ enviados: 0, falhas: [] });
    expect(chamadas).toBe(0);
  });
});
