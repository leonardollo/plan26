import React, { useState } from 'react';

/**
 * Tela de quando a leitura do plano falhou. O app não abre vazio: se abrisse,
 * a primeira edição gravaria o plano vazio por cima do real.
 */
const ErroAoAbrirPlano: React.FC<{ onTentarDeNovo: () => Promise<void>; onLogout: () => void }> = ({
  onTentarDeNovo,
  onLogout,
}) => {
  const [tentando, setTentando] = useState(false);

  const tentar = async () => {
    setTentando(true);
    try {
      await onTentarDeNovo();
    } finally {
      setTentando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-9">
        <img src="/logo-gi.png" alt="Gestão de Impacto" className="h-9 w-auto object-contain mb-7" />

        <h1 className="text-2xl font-bold text-brand-dark mb-3">Não consegui abrir seu plano. Nada foi alterado.</h1>
        <p className="text-gray-600 leading-relaxed">
          Pode ser a conexão. Tente de novo em instantes; se continuar, fale com a Gestão de Impacto.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            onClick={tentar}
            disabled={tentando}
            className="px-5 py-2.5 bg-brand-orange text-white rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-300 transition-colors"
          >
            {tentando ? 'Tentando…' : 'Tentar de novo'}
          </button>
          <button
            onClick={onLogout}
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErroAoAbrirPlano;
