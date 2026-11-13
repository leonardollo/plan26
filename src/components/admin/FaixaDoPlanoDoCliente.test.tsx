import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { planoFalso } = vi.hoisted(() => ({ planoFalso: {} as Record<string, any> }));
vi.mock('../../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));

import FaixaDoPlanoDoCliente from './FaixaDoPlanoDoCliente';

const AGORA = new Date('2026-11-13T15:00:00Z');
const minutosAtras = (m: number) => new Date(AGORA.getTime() - m * 60_000);

function plano(atualizadoEmNoBanco: Date | null) {
  Object.assign(planoFalso, {
    planoDeCliente: { uid: 'c1', email: 'cli@x.com', nome: 'Fulano' },
    atualizadoEmNoBanco,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('FaixaDoPlanoDoCliente', () => {
  it('diz de quem é o plano e Voltar chama onVoltar', () => {
    plano(null);
    const voltar = vi.fn();
    render(<FaixaDoPlanoDoCliente onVoltar={voltar} />);
    expect(screen.getByText('Você está no plano de Fulano (cli@x.com)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à Administração' }));
    expect(voltar).toHaveBeenCalledTimes(1);
  });

  it('sem nome, mostra só o e-mail', () => {
    Object.assign(planoFalso, { planoDeCliente: { uid: 'c1', email: 'cli@x.com', nome: null }, atualizadoEmNoBanco: null });
    render(<FaixaDoPlanoDoCliente onVoltar={() => {}} />);
    expect(screen.getByText('Você está no plano de cli@x.com')).toBeTruthy();
  });

  it('alterado há 10 min: avisa', () => {
    plano(minutosAtras(10));
    render(<FaixaDoPlanoDoCliente onVoltar={() => {}} />);
    expect(screen.getByText('Este plano foi alterado há 10 min')).toBeTruthy();
  });

  it('alterado há 31 min: sem aviso', () => {
    plano(minutosAtras(31));
    render(<FaixaDoPlanoDoCliente onVoltar={() => {}} />);
    expect(screen.queryByText(/foi alterado/)).toBeNull();
  });

  it('sem data: sem aviso', () => {
    plano(null);
    render(<FaixaDoPlanoDoCliente onVoltar={() => {}} />);
    expect(screen.queryByText(/foi alterado/)).toBeNull();
  });
});
