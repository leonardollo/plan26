import { describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/usePlanData', () => ({ authService: {} }));
vi.mock('../services/supabase', () => ({ SENHA_MINIMA: 6 }));

import { mensagemDeErroAoDefinirSenha } from './DefinirSenha';

describe('mensagemDeErroAoDefinirSenha', () => {
  it('senha igual à atual: pede outra, sem mandar pedir link novo', () => {
    // Visto no teste como usuário: quem pede "esqueci a senha" e digita a mesma recebia "peça um link novo".
    expect(mensagemDeErroAoDefinirSenha({ code: 'same_password', message: 'New password should be different from the old password.' })).toBe(
      'Essa já é a sua senha atual. Escolha uma diferente.',
    );
  });

  it('qualquer outro erro: o link pode ter vencido', () => {
    expect(mensagemDeErroAoDefinirSenha({ code: 'session_not_found', message: 'x' })).toBe(
      'Não consegui salvar a senha. Peça um link novo em "Esqueceu a senha?" e tente de novo.',
    );
    expect(mensagemDeErroAoDefinirSenha(new Error('Failed to fetch'))).toBe(
      'Não consegui salvar a senha. Peça um link novo em "Esqueceu a senha?" e tente de novo.',
    );
  });
});
