import React, { useState } from 'react';
import { authService, usePlan } from '../hooks/usePlanData';

/**
 * Tela do admin que entrou com senha e ainda não verificou o e-mail.
 * A regra do banco só reconhece admin com e-mail verificado: sem isso, quem
 * criasse conta com o e-mail de um admin ganharia o poder sem ser o dono dele.
 */
const VerificarEmailAdmin: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { checkSubscription } = usePlan();
  const email = authService.emailAtual();
  const [rodando, setRodando] = useState(false);
  const [aviso, setAviso] = useState('');

  const enviar = async () => {
    setRodando(true);
    try {
      await authService.enviarVerificacaoDeEmail();
      setAviso(`Enviamos o link para ${email}. Abra o link e clique em Já verifiquei.`);
    } catch {
      setAviso('Não consegui enviar agora. Tente de novo em alguns minutos.');
    } finally {
      setRodando(false);
    }
  };

  const jaVerifiquei = async () => {
    setRodando(true);
    try {
      await authService.recarregarUsuario();
      await checkSubscription();
      // Se a conferência liberou, esta tela some; se continuou aqui, o e-mail ainda não está verificado.
      setAviso('Ainda não aparece como verificado. Abra o link do e-mail e tente de novo.');
    } catch {
      setAviso('Ainda não aparece como verificado. Abra o link do e-mail e tente de novo.');
    } finally {
      setRodando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-9">
        <img src="/logo-gi.png" alt="Gestão de Impacto" className="h-9 w-auto object-contain mb-7" />

        <h1 className="text-2xl font-bold text-brand-dark mb-3">Verifique seu e-mail</h1>
        <p className="text-gray-600 leading-relaxed">
          Seu e-mail é de administrador, mas ainda não foi verificado.
        </p>
        <p className="text-gray-800 font-medium mt-2 break-all">{email}</p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            onClick={enviar}
            disabled={rodando}
            className="px-5 py-2.5 bg-brand-orange text-white rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-300 transition-colors"
          >
            Enviar e-mail de verificação
          </button>
          <button
            onClick={jaVerifiquei}
            disabled={rodando}
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Já verifiquei
          </button>
          <button
            onClick={onLogout}
            disabled={rodando}
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Sair
          </button>
        </div>

        {aviso && <p className="text-sm text-gray-500 mt-4">{aviso}</p>}
      </div>
    </div>
  );
};

export default VerificarEmailAdmin;
