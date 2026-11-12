// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { conferirDestino } from './destino.mjs';

describe('conferirDestino', () => {
  it('Supabase local dispensa --confirmo', () => {
    expect(conferirDestino('http://127.0.0.1:54321', undefined)).toEqual({ host: '127.0.0.1:54321', local: true });
    expect(conferirDestino('http://localhost:54321', undefined)).toEqual({ host: 'localhost:54321', local: true });
  });

  it('projeto remoto exige --confirmo igual ao ref da URL', () => {
    expect(() => conferirDestino('https://abcdefghij.supabase.co', undefined)).toThrow(/--confirmo=abcdefghij/);
    expect(() => conferirDestino('https://abcdefghij.supabase.co', 'outro')).toThrow(/--confirmo=abcdefghij/);
    expect(conferirDestino('https://abcdefghij.supabase.co', 'abcdefghij')).toEqual({ host: 'abcdefghij.supabase.co', local: false });
  });

  it('URL vazia, inválida ou fora do supabase.co é recusada', () => {
    expect(() => conferirDestino(undefined, undefined)).toThrow(/SUPABASE_URL/);
    expect(() => conferirDestino('não é url', undefined)).toThrow(/SUPABASE_URL/);
    expect(() => conferirDestino('https://exemplo.com', 'exemplo')).toThrow(/supabase\.co/);
    // http://localhost.evil.com não é local
    expect(() => conferirDestino('http://localhost.evil.com', undefined)).toThrow();
  });
});
