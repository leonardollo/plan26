import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { falsos } = vi.hoisted(() => ({
  falsos: { signup: vi.fn(), login: vi.fn(), enviarVerificacaoDeEmail: vi.fn() },
}));

vi.mock('../hooks/usePlanData', () => ({ authService: falsos }));
vi.mock('../services/supabase', () => ({ SENHA_MINIMA: 6 }));

import Login, { mensagemDeErroDeLogin } from './Login';

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('mensagemDeErroDeLogin', () => {
  it('credenciais inválidas, pelo código ou só pela mensagem', () => {
    const esperada = 'Usuário não encontrado ou senha incorreta. Se é seu primeiro acesso, clique em "Cadastre-se" abaixo.';
    expect(mensagemDeErroDeLogin({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(esperada);
    expect(mensagemDeErroDeLogin({ message: 'Invalid login credentials' })).toBe(esperada);
  });

  it('e-mail não confirmado', () => {
    expect(mensagemDeErroDeLogin({ code: 'email_not_confirmed', message: 'Email not confirmed' })).toBe(
      'Confirme seu e-mail antes de entrar.',
    );
  });

  it('erro desconhecido mostra a mensagem original; sem nada, a genérica', () => {
    expect(mensagemDeErroDeLogin({ message: 'Falhou a rede' })).toBe('Falhou a rede');
    expect(mensagemDeErroDeLogin(null)).toBe('Ocorreu um erro. Verifique suas credenciais.');
  });
});

describe('Login — cadastro', () => {
  it('depois do cadastro pede a confirmação e reenvia o e-mail', async () => {
    falsos.signup.mockResolvedValue({});
    falsos.enviarVerificacaoDeEmail.mockResolvedValue(undefined);
    const { container } = render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: 'Cadastre-se' }));
    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'ana@empresa.com' } });
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: 'segredo1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(
      await screen.findByText('Enviamos um link de confirmação para ana@empresa.com. Abra o e-mail para entrar.'),
    ).toBeTruthy();
    expect(falsos.signup).toHaveBeenCalledWith('ana@empresa.com', 'segredo1', 'Ana');

    fireEvent.click(screen.getByRole('button', { name: 'Reenviar e-mail' }));
    await waitFor(() => expect(falsos.enviarVerificacaoDeEmail).toHaveBeenCalledWith('ana@empresa.com'));
  });

  it('login com e-mail não confirmado mostra o aviso traduzido', async () => {
    falsos.login.mockRejectedValue({ code: 'email_not_confirmed', message: 'Email not confirmed' });
    const { container } = render(<Login />);
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'ana@empresa.com' } });
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: 'segredo1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Confirme seu e-mail antes de entrar.')).toBeTruthy();
  });
});
