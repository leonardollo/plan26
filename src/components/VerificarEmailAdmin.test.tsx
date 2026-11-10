import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { falsos } = vi.hoisted(() => ({
  falsos: {
    checkSubscription: vi.fn(),
    recarregarUsuario: vi.fn(),
    enviarVerificacaoDeEmail: vi.fn(),
  },
}));

vi.mock('../hooks/usePlanData', () => ({
  usePlan: () => ({ checkSubscription: falsos.checkSubscription }),
  authService: {
    emailAtual: () => 'admin@gi.com',
    recarregarUsuario: falsos.recarregarUsuario,
    enviarVerificacaoDeEmail: falsos.enviarVerificacaoDeEmail,
  },
}));

import VerificarEmailAdmin from './VerificarEmailAdmin';

beforeEach(() => {
  vi.clearAllMocks();
  falsos.recarregarUsuario.mockResolvedValue(undefined);
  falsos.checkSubscription.mockResolvedValue(undefined);
});

describe('VerificarEmailAdmin', () => {
  it('"Já verifiquei" recarrega o usuário antes de conferir o acesso', async () => {
    render(<VerificarEmailAdmin onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Já verifiquei' }));
    await waitFor(() => expect(falsos.checkSubscription).toHaveBeenCalledTimes(1));
    expect(falsos.recarregarUsuario).toHaveBeenCalledTimes(1);
    expect(falsos.recarregarUsuario.mock.invocationCallOrder[0]).toBeLessThan(
      falsos.checkSubscription.mock.invocationCallOrder[0],
    );
  });
});
