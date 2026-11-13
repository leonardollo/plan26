import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../hooks/usePlanData', () => ({ usePlan: () => ({ checkSubscription: vi.fn(async () => {}) }) }));

import AguardandoLiberacao from './AguardandoLiberacao';

afterEach(cleanup);

describe('AguardandoLiberacao', () => {
  it('removido: conta desativada, pede para falar com a GI e oferece Sair', () => {
    const sair = vi.fn();
    render(<AguardandoLiberacao onLogout={sair} removido />);
    expect(screen.getByText('Sua conta foi desativada')).toBeTruthy();
    expect(screen.getByText('Fale com a Gestão de Impacto para reativar.')).toBeTruthy();
    expect(screen.queryByText('Seu cadastro foi recebido')).toBeNull();
    expect(screen.queryByText('Já fui liberado, conferir')).toBeNull();
    fireEvent.click(screen.getByText('Sair'));
    expect(sair).toHaveBeenCalledTimes(1);
  });

  it('sem removido, o texto de hoje continua', () => {
    render(<AguardandoLiberacao onLogout={() => {}} />);
    expect(screen.getByText('Seu cadastro foi recebido')).toBeTruthy();
    expect(screen.getByText('Já fui liberado, conferir')).toBeTruthy();
    expect(screen.queryByText('Sua conta foi desativada')).toBeNull();
  });

  it('bloqueado continua com o aviso de suspensão', () => {
    render(<AguardandoLiberacao onLogout={() => {}} bloqueado />);
    expect(screen.getByText('Acesso suspenso')).toBeTruthy();
    expect(screen.queryByText('Sua conta foi desativada')).toBeNull();
  });
});
