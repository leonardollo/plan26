import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

const { acesso } = vi.hoisted(() => ({
  acesso: { listarRegistro: vi.fn(), listarAcessos: vi.fn() },
}));

vi.mock('../../services/supabase', () => ({ supabase: {} }));
vi.mock('../../services/acesso', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/acesso')>()),
  ...acesso,
}));

import AbaRegistro from './AbaRegistro';

const ACAO = {
  id: 1,
  quando: new Date(2026, 10, 13, 14, 5),
  adminEmail: 'eu@gi.com',
  acao: 'bloqueou',
  alvo: 'c1',
  alvoEmail: 'cli@x.com',
  detalhe: { de: 'liberado', para: 'bloqueado' },
};

async function montar() {
  render(<AbaRegistro />);
  await act(async () => {});
}

beforeEach(() => {
  vi.clearAllMocks();
  acesso.listarRegistro.mockResolvedValue([ACAO]);
  acesso.listarAcessos.mockResolvedValue([
    { uid: 'c1', nome: 'Cliente Um', email: 'cli@x.com', status: 'liberado' },
    { uid: 'c2', nome: 'Cliente Dois', email: 'dois@x.com', status: 'pendente' },
  ]);
});
afterEach(cleanup);

describe('AbaRegistro', () => {
  it('mostra quando, admin, ação, cliente e detalhe', async () => {
    await montar();
    expect(acesso.listarRegistro).toHaveBeenCalledWith(expect.anything(), undefined);
    const item = screen.getByLabelText('Ação 1');
    expect(within(item).getByText('13/11/26 14:05')).toBeTruthy();
    expect(within(item).getByText('eu@gi.com')).toBeTruthy();
    expect(within(item).getByText('bloqueou')).toBeTruthy();
    expect(within(item).getByText('cli@x.com')).toBeTruthy();
    expect(within(item).getByText('de: liberado · para: bloqueado')).toBeTruthy();
  });

  it('o filtro por cliente lê só as ações daquele cliente', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('Filtrar por cliente'), { target: { value: 'c2' } });
    await act(async () => {});
    expect(acesso.listarRegistro).toHaveBeenLastCalledWith(expect.anything(), 'c2');
    fireEvent.change(screen.getByLabelText('Filtrar por cliente'), { target: { value: '' } });
    await act(async () => {});
    expect(acesso.listarRegistro).toHaveBeenLastCalledWith(expect.anything(), undefined);
  });

  it('sem ações, diz que não há', async () => {
    acesso.listarRegistro.mockResolvedValue([]);
    await montar();
    expect(screen.getByText('Nenhuma ação registrada.')).toBeTruthy();
  });
});
