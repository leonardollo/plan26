import { describe, expect, it } from 'vitest';
import {
  cabecalhosCors,
  JANELA_DO_LIMITE_S,
  LIMITE_ENVIOS_POR_ADMIN,
  LIMITE_REENVIOS_POR_DESTINATARIO,
  normalizarEmail,
  origemPermitida,
  segundosAteLiberar,
  URL_DO_APP,
  validarCriar,
  validarReenviar,
} from './regras';

describe('normalizarEmail', () => {
  it('apara e põe em minúsculas', () => {
    expect(normalizarEmail(' Ana@X.com ')).toBe('ana@x.com');
  });

  it('recusa formato inválido, vazio e não texto', () => {
    for (const bruto of ['ana@', '', '   ', 'ana@x', 'a b@x.com', null, undefined, 42]) {
      expect(normalizarEmail(bruto), String(bruto)).toBeNull();
    }
  });

  it('teto de 254 caracteres (RFC 5321): 254 passa, 255 não', () => {
    const com254 = 'a'.repeat(248) + '@x.com';
    expect(com254).toHaveLength(254);
    expect(normalizarEmail(com254)).toBe(com254);
    expect(normalizarEmail('a' + com254)).toBeNull();
  });
});

describe('validarCriar', () => {
  it('devolve e-mail normalizado e nome aparado', () => {
    expect(validarCriar({ email: ' Ana@X.com ', nome: '  Ana Souza ' })).toEqual({ email: 'ana@x.com', nome: 'Ana Souza' });
  });

  it('aceita nome de 120 caracteres', () => {
    expect(validarCriar({ email: 'a@x.com', nome: 'n'.repeat(120) })).toEqual({ email: 'a@x.com', nome: 'n'.repeat(120) });
  });

  it('recusa nome vazio, só espaços ou com 121 caracteres', () => {
    for (const nome of ['', '   ', 'n'.repeat(121), undefined, 7]) {
      expect(validarCriar({ email: 'a@x.com', nome }), String(nome)).toHaveProperty('erro');
    }
  });

  it('recusa e-mail inválido e corpo que não é objeto', () => {
    expect(validarCriar({ email: 'ana@', nome: 'Ana' })).toHaveProperty('erro');
    expect(validarCriar(null)).toHaveProperty('erro');
    expect(validarCriar('texto')).toHaveProperty('erro');
  });

  it('ignora campos a mais, como redirectTo', () => {
    expect(validarCriar({ email: 'a@x.com', nome: 'Ana', redirectTo: 'https://evil.com' })).toEqual({ email: 'a@x.com', nome: 'Ana' });
  });
});

describe('validarReenviar', () => {
  it('aceita alvo uuid e recusa o resto', () => {
    const alvo = '3f1c2a9e-1b2c-4d5e-8f90-1234567890ab';
    expect(validarReenviar({ alvo })).toEqual({ alvo });
    expect(validarReenviar({ alvo: 'x' })).toHaveProperty('erro');
    expect(validarReenviar({})).toHaveProperty('erro');
  });
});

describe('origens do CORS', () => {
  it('permite produção, prévias do time e localhost:5173', () => {
    for (const o of [
      'https://planejamento.gestaoimpacto.com',
      'https://plan-abc123-gestao-de-impactos-projects.vercel.app',
      'https://plan-ab12cd34e-gestao-de-impactos-projects.vercel.app',
      'http://localhost:5173',
    ]) {
      expect(origemPermitida(o), o).toBe(true);
    }
  });

  it('recusa o resto', () => {
    for (const o of [
      'https://plan-x.vercel.app.evil.com',
      // Outro time com slug "x-gestao-de-impactos-projects" (o caso do ataque) e prévia de branch, ambígua do mesmo jeito.
      'https://plan-abc-x-gestao-de-impactos-projects.vercel.app',
      'https://plan-git-feat-x-gestao-de-impactos-projects.vercel.app',
      'https://plan-git-feat-area-admin-gestao-de-impactos-projects.vercel.app',
      'https://plan-abc123-gestao-de-impactos-projects.vercel.app.evil.com',
      'http://plan-abc123-gestao-de-impactos-projects.vercel.app',
      'https://plan-abc123-outro-time.vercel.app',
      'https://outro-abc123-gestao-de-impactos-projects.vercel.app',
      'https://evil-gestao-de-impactos-projects.vercel.app',
      'https://plan--gestao-de-impactos-projects.vercel.app',
      'https://planejamento.gestaoimpacto.com.evil.com',
      'http://localhost:5174',
      null,
    ]) {
      expect(origemPermitida(o), String(o)).toBe(false);
    }
  });

  it('cabeçalhos: com a origem permitida ecoa a origem; sem ela não há Allow-Origin', () => {
    expect(cabecalhosCors('http://localhost:5173')['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(cabecalhosCors('https://evil.com')).not.toHaveProperty('Access-Control-Allow-Origin');
    expect(cabecalhosCors(null)).not.toHaveProperty('Access-Control-Allow-Origin');
  });

  it('a tela consegue ler o Retry-After', () => {
    expect(cabecalhosCors('http://localhost:5173')['Access-Control-Expose-Headers']).toBe('Retry-After');
  });

  it('o endereço do app é o de produção', () => {
    expect(URL_DO_APP).toBe('https://planejamento.gestaoimpacto.com');
  });
});

describe('limite de envios', () => {
  it('limites: 20 envios por admin e 3 reenvios por destinatário, por hora', () => {
    expect(LIMITE_ENVIOS_POR_ADMIN).toBe(20);
    expect(LIMITE_REENVIOS_POR_DESTINATARIO).toBe(3);
    expect(JANELA_DO_LIMITE_S).toBe(3600);
  });

  it('segundosAteLiberar arredonda para cima', () => {
    const agora = new Date('2026-11-13T12:00:00.000Z');
    expect(segundosAteLiberar(new Date('2026-11-13T12:10:00.000Z'), agora)).toBe(600);
    expect(segundosAteLiberar(new Date('2026-11-13T12:00:00.200Z'), agora)).toBe(1);
    expect(segundosAteLiberar(new Date('2026-11-13T12:59:59.001Z'), agora)).toBe(3600);
  });

  it('segundosAteLiberar nunca é menor que 1, mesmo com relógios desencontrados', () => {
    const agora = new Date('2026-11-13T12:00:00.000Z');
    expect(segundosAteLiberar(agora, agora)).toBe(1);
    expect(segundosAteLiberar(new Date('2026-11-13T11:59:00.000Z'), agora)).toBe(1);
  });

  it('segundosAteLiberar não passa da janela, mesmo com o relógio do banco adiantado', () => {
    const agora = new Date('2026-11-13T12:00:00.000Z');
    expect(segundosAteLiberar(new Date('2026-11-13T14:00:00.000Z'), agora)).toBe(3600);
  });
});
