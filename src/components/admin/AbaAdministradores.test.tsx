import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

const { acesso } = vi.hoisted(() => ({
  acesso: { listarAdmins: vi.fn(), promoverAdmin: vi.fn(), rebaixarAdmin: vi.fn() },
}));

vi.mock('../../services/supabase', () => ({ supabase: {} }));
vi.mock('../../services/acesso', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/acesso')>()),
  ...acesso,
}));

import AbaAdministradores from './AbaAdministradores';

const ADMINS = [
  { email: 'eu@gi.com', uid: 'eu', nome: 'Eu Mesmo' },
  { email: 'eva@gi.com', uid: 'a2', nome: 'Eva Admin' },
  { email: 'semconta@gi.com', uid: null, nome: null },
];

async function montar() {
  render(<AbaAdministradores eu={{ uid: 'eu', email: 'eu@gi.com' }} />);
  await act(async () => {});
}

const linha = (email: string) => screen.getByLabelText(`Administrador ${email}`);

beforeEach(() => {
  vi.clearAllMocks();
  acesso.listarAdmins.mockResolvedValue(ADMINS);
  acesso.promoverAdmin.mockResolvedValue(undefined);
  acesso.rebaixarAdmin.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('AbaAdministradores', () => {
  it('lista os admins, com quem ainda não tem conta', async () => {
    await montar();
    expect(within(linha('eu@gi.com')).getByText('Eu Mesmo')).toBeTruthy();
    expect(within(linha('eva@gi.com')).getByText('Eva Admin')).toBeTruthy();
    expect(within(linha('semconta@gi.com')).getByText('sem conta')).toBeTruthy();
  });

  it('Adicionar admin por e-mail chama promoverAdmin e recarrega', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('E-mail do novo administrador'), { target: { value: ' Bruno@X.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar admin' }));
    await act(async () => {});
    expect(acesso.promoverAdmin).toHaveBeenCalledWith(expect.anything(), 'bruno@x.com');
    expect(acesso.listarAdmins).toHaveBeenCalledTimes(2);
  });

  it('Rebaixar não aparece na própria linha', async () => {
    await montar();
    expect(within(linha('eu@gi.com')).queryByRole('button', { name: 'Rebaixar' })).toBeNull();
    expect(within(linha('eva@gi.com')).getByRole('button', { name: 'Rebaixar' })).toBeTruthy();
  });

  it('Rebaixar pede confirmação e só rebaixa depois de confirmar', async () => {
    await montar();
    fireEvent.click(within(linha('eva@gi.com')).getByRole('button', { name: 'Rebaixar' }));
    expect(screen.getByText(/Rebaixar eva@gi.com\?/)).toBeTruthy();
    expect(acesso.rebaixarAdmin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(acesso.rebaixarAdmin).not.toHaveBeenCalled();
    fireEvent.click(within(linha('eva@gi.com')).getByRole('button', { name: 'Rebaixar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar rebaixamento' }));
    await act(async () => {});
    expect(acesso.rebaixarAdmin).toHaveBeenCalledWith(expect.anything(), 'eva@gi.com');
  });

  it('o erro do banco aparece na tela', async () => {
    acesso.promoverAdmin.mockRejectedValue({ code: 'P0001', message: 'Esse e-mail não tem conta no PLAN' });
    await montar();
    fireEvent.change(screen.getByLabelText('E-mail do novo administrador'), { target: { value: 'x@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar admin' }));
    await act(async () => {});
    expect(screen.getByText('Esse e-mail não tem conta no PLAN')).toBeTruthy();
  });
});
