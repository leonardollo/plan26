import { describe, it, expect } from 'vitest';
import { telaDoApp } from './telaDoApp';
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
