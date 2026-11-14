import { describe, it, expect } from 'vitest';
import { situacaoDoAcesso, telaDoApp } from './telaDoApp';
import type { EstadoDaCarga } from '../types';

const CARGAS: EstadoDaCarga[] = ['carregando', 'carregado', 'falhou'];

describe('telaDoApp', () => {
  it('conferindo o acesso, qualquer carga', () => {
    for (const c of CARGAS) expect(telaDoApp('loading', c)).toBe('conferindo');
  });
  it('pendente e bloqueado aguardam, qualquer carga', () => {
    for (const c of CARGAS) {
      expect(telaDoApp('not_found', c)).toBe('aguardando');
      expect(telaDoApp('inactive', c)).toBe('aguardando');
    }
  });
  it('expirado, qualquer carga', () => {
    for (const c of CARGAS) expect(telaDoApp('expired', c)).toBe('expirado');
  });
  it('admin sem e-mail verificado, qualquer carga', () => {
    for (const c of CARGAS) expect(telaDoApp('verificar_email', c)).toBe('verificar_email');
  });
  it('ativo com a carga em curso abre o plano', () => {
    expect(telaDoApp('active', 'carregando')).toBe('abrindo_plano');
  });
  it('ativo com a carga falha mostra o erro', () => {
    expect(telaDoApp('active', 'falhou')).toBe('erro_ao_abrir');
  });
  it('ativo com o plano carregado mostra o app', () => {
    expect(telaDoApp('active', 'carregado')).toBe('app');
  });
});

describe('situacaoDoAcesso', () => {
  it('liberado ativa; bloqueado e removido ficam inativos; pendente espera', () => {
    expect(situacaoDoAcesso('liberado')).toBe('active');
    expect(situacaoDoAcesso('bloqueado')).toBe('inactive');
    expect(situacaoDoAcesso('removido')).toBe('inactive');
    expect(situacaoDoAcesso('pendente')).toBe('not_found');
  });

  const AGORA = new Date('2027-03-10T12:00:00Z');

  it('liberado com prazo futuro → active', () => {
    expect(situacaoDoAcesso('liberado', '2028-03-10T12:00:00Z', AGORA)).toBe('active');
  });
  it('liberado com prazo vencido → expired', () => {
    expect(situacaoDoAcesso('liberado', '2027-03-10T11:59:59Z', AGORA)).toBe('expired');
  });
  it('liberado sem prazo → active', () => {
    expect(situacaoDoAcesso('liberado', null, AGORA)).toBe('active');
    expect(situacaoDoAcesso('liberado', undefined, AGORA)).toBe('active');
  });
  it('bloqueado com prazo futuro → inactive', () => {
    expect(situacaoDoAcesso('bloqueado', '2028-03-10T12:00:00Z', AGORA)).toBe('inactive');
  });
  it('prazo exatamente agora → expired', () => {
    expect(situacaoDoAcesso('liberado', '2027-03-10T12:00:00Z', AGORA)).toBe('expired');
  });
});
