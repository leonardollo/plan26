import { describe, expect, it } from 'vitest';
import { cabecalhosCors, normalizarEmail, origemPermitida, URL_DO_APP, validarCriar, validarReenviar } from './regras';

describe('normalizarEmail', () => {
  it('apara e põe em minúsculas', () => {
    expect(normalizarEmail(' Ana@X.com ')).toBe('ana@x.com');
  });

  it('recusa formato inválido, vazio e não texto', () => {
    for (const bruto of ['ana@', '', '   ', 'ana@x', 'a b@x.com', null, undefined, 42]) {
      expect(normalizarEmail(bruto), String(bruto)).toBeNull();
    }
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
      'http://localhost:5173',
    ]) {
      expect(origemPermitida(o), o).toBe(true);
    }
  });

  it('recusa o resto', () => {
    for (const o of [
      'https://plan-x.vercel.app.evil.com',
      'https://evil-gestao-de-impactos-projects.vercel.app',
      'https://plan-abc-x-gestao-de-impactos-projects.vercel.app',
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

  it('o endereço do app é o de produção', () => {
    expect(URL_DO_APP).toBe('https://planejamento.gestaoimpacto.com');
  });
});
