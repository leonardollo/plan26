import React, { useState } from 'react';
import { authService } from '../hooks/usePlanData';
import { SENHA_MINIMA } from '../services/supabase';

export function mensagemDeErroAoDefinirSenha(erro: unknown): string {
  // O Auth recusa a senha igual à atual; o link continua valendo, então não mande pedir outro.
  if ((erro as { code?: string } | null)?.code === 'same_password') return 'Essa já é a sua senha atual. Escolha uma diferente.';
  return 'Não consegui salvar a senha. Peça um link novo em "Esqueceu a senha?" e tente de novo.';
}

/**
 * Aberta pelo link de "criar/redefinir senha": o link já abriu a sessão,
 * mas a pessoa só entra no app depois de escolher a senha nova.
 */
const DefinirSenha: React.FC<{ email: string | null; onConcluido: () => void }> = ({ email, onConcluido }) => {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [gravando, setGravando] = useState(false);

  const gravar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais.');
      return;
    }
    setGravando(true);
    try {
      await authService.definirSenha(senha);
      onConcluido();
    } catch (error: unknown) {
      console.error(error);
      setErro(mensagemDeErroAoDefinirSenha(error));
      setGravando(false);
    }
  };

  const campo =
    'w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange text-sm';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col justify-center px-6 sm:px-12">
      <div className="w-full max-w-md mx-auto">
        <img src="/logo-gi.png" alt="Gestão de Impacto" className="h-12 w-auto object-contain mx-auto mb-8" />
        <h2 className="text-2xl font-extrabold text-white mb-1">Crie sua senha</h2>
        <p className="text-gray-400 mb-8">
          {email ? <>Escolha a senha para entrar como <span className="text-white">{email}</span>.</> : 'Escolha a senha para entrar.'}
        </p>

        <form className="space-y-4" onSubmit={gravar}>
          <div>
            <label htmlFor="senha-nova" className="block text-sm font-medium text-gray-300 mb-1.5">Nova senha</label>
            <input
              id="senha-nova"
              type="password"
              autoComplete="new-password"
              required
              minLength={SENHA_MINIMA}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={campo}
              placeholder={`Pelo menos ${SENHA_MINIMA} caracteres`}
            />
          </div>
          <div>
            <label htmlFor="senha-confirmacao" className="block text-sm font-medium text-gray-300 mb-1.5">Repita a senha</label>
            <input
              id="senha-confirmacao"
              type="password"
              autoComplete="new-password"
              required
              minLength={SENHA_MINIMA}
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className={campo}
            />
          </div>

          {erro && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-xl">
              <p className="text-sm text-red-400 text-center">{erro}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={gravando}
            className="w-full py-3 px-4 bg-brand-orange text-white font-bold rounded-xl hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {gravando ? 'Salvando...' : 'Salvar senha e entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DefinirSenha;
