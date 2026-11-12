import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODO_LOCAL, configDoSupabase, telaDeEntrada, usuarioDoSupabase } from './supabase';

describe('usuarioDoSupabase', () => {
  it('sem usuário, devolve null', () => {
    expect(usuarioDoSupabase(null)).toBeNull();
  });

  it('com e-mail confirmado e full_name (Google), usa o nome e marca verificado', () => {
    expect(
      usuarioDoSupabase({
        id: 'u1',
        email: 'ana@empresa.com',
        email_confirmed_at: '2026-11-12T10:00:00Z',
        user_metadata: { full_name: 'Ana' },
      }),
    ).toEqual({ uid: 'u1', email: 'ana@empresa.com', displayName: 'Ana', emailVerified: true });
  });

  it('prefere name (cadastro com senha) a full_name', () => {
    expect(
      usuarioDoSupabase({ id: 'u1', email: 'a@b.com', user_metadata: { name: 'Bia', full_name: 'Outra' } })
        ?.displayName,
    ).toBe('Bia');
  });

  it('sem email_confirmed_at, não está verificado; sem nome nem e-mail, null', () => {
    expect(usuarioDoSupabase({ id: 'u2', email_confirmed_at: null })).toEqual({
      uid: 'u2',
      email: null,
      displayName: null,
      emailVerified: false,
    });
  });
});

describe('telaDeEntrada', () => {
  it('recuperando a senha com sessão → definir_senha', () => {
    expect(telaDeEntrada({ recuperandoSenha: true, temUsuario: true })).toBe('definir_senha');
  });

  it('com usuário → app', () => {
    expect(telaDeEntrada({ recuperandoSenha: false, temUsuario: true })).toBe('app');
  });

  it('sem usuário → login, mesmo que o evento de recuperação tenha chegado', () => {
    expect(telaDeEntrada({ recuperandoSenha: false, temUsuario: false })).toBe('login');
    expect(telaDeEntrada({ recuperandoSenha: true, temUsuario: false })).toBe('login');
  });
});

describe('configDoSupabase', () => {
  const ambiente = { VITE_SUPABASE_URL: undefined, VITE_SUPABASE_ANON_KEY: undefined };

  it('sem variáveis, usa o PLAN26', () => {
    expect(configDoSupabase({ ...ambiente, DEV: false, MODE: 'production' }).url).toBe(
      'https://aixjmxfkaziqlxnpudkk.supabase.co',
    );
  });

  it('as variáveis de ambiente vencem o padrão', () => {
    const c = configDoSupabase({
      DEV: false,
      MODE: 'production',
      VITE_SUPABASE_URL: 'https://outro.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'chave',
    });
    expect(c).toEqual({ url: 'https://outro.supabase.co', chave: 'chave' });
  });

  it('o Supabase local só vale em desenvolvimento com o modo banco-local', () => {
    expect(configDoSupabase({ ...ambiente, DEV: true, MODE: MODO_LOCAL }).url).toBe('http://127.0.0.1:54321');
    expect(configDoSupabase({ ...ambiente, DEV: true, MODE: 'development' }).url).not.toContain('127.0.0.1');
    // Um build de produção feito com --mode banco-local não pode apontar para a máquina de quem abre o site.
    expect(configDoSupabase({ ...ambiente, DEV: false, MODE: MODO_LOCAL }).url).not.toContain('127.0.0.1');
  });

  it('o npm run dev:local usa o modo que o app reconhece', () => {
    // O Vite recusa o modo "local" (colide com o sufixo .local dos .env); o script e o app precisam do mesmo nome.
    const scripts = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')).scripts;
    expect(scripts['dev:local']).toBe(`vite --mode ${MODO_LOCAL}`);
    expect(MODO_LOCAL).not.toBe('local');
  });
});
