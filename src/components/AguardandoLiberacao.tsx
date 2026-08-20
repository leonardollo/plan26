import React, { useState } from 'react';
import { usePlan } from '../hooks/usePlanData';

/**
 * Tela de quem se cadastrou e ainda não foi liberado.
 *
 * Fala a verdade sem assustar: a conta existe, o acesso depende de alguém da
 * Gestão de Impacto liberar. Não promete prazo que a GI não controla, e não
 * insinua que houve erro — porque não houve.
 */
const AguardandoLiberacao: React.FC<{ onLogout: () => void; bloqueado?: boolean }> = ({
  onLogout,
  bloqueado = false,
}) => {
  const { checkSubscription } = usePlan();
  const [conferindo, setConferindo] = useState(false);
  const [conferiu, setConferiu] = useState(false);

  const conferir = async () => {
    setConferindo(true);
    await checkSubscription();
    setConferindo(false);
    setConferiu(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-9">
        <img src="/logo-gi.png" alt="Gestão de Impacto" className="h-9 w-auto object-contain mb-7" />

        {bloqueado ? (
          <>
            <h1 className="text-2xl font-bold text-brand-dark mb-3">Acesso suspenso</h1>
            <p className="text-gray-600 leading-relaxed">
              Sua conta existe, mas o acesso ao PLAN 2026 está suspenso no momento. Fale com a
              Gestão de Impacto para entender e reativar.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-brand-dark mb-3">Seu cadastro foi recebido</h1>
            <p className="text-gray-600 leading-relaxed">
              Sua conta está criada e na fila de liberação. Assim que a Gestão de Impacto liberar,
              seu espaço de planejamento é aberto e você entra normalmente com este mesmo e-mail e
              senha.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              Não precisa se cadastrar de novo — criar outra conta só faria uma segunda fila.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={conferir}
                disabled={conferindo}
                className="px-5 py-2.5 bg-brand-orange text-white rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-300 transition-colors"
              >
                {conferindo ? 'Conferindo…' : 'Já fui liberado, conferir'}
              </button>
              <button
                onClick={onLogout}
                className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Sair
              </button>
            </div>

            {conferiu && (
              <p className="text-sm text-gray-500 mt-4">
                Ainda não. Quando a liberação sair, este botão abre o sistema.
              </p>
            )}
          </>
        )}

        {bloqueado && (
          <button
            onClick={onLogout}
            className="mt-7 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Sair
          </button>
        )}
      </div>
    </div>
  );
};

export default AguardandoLiberacao;
