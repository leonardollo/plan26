import React, { useEffect, useState } from 'react';
import { usePlan } from '../../hooks/usePlanData';

const JANELA_DO_AVISO_MS = 30 * 60_000;

/**
 * Faixa fixa enquanto o admin está no plano de um cliente. O aviso diz "alterado", e não
 * "Fulano editou", porque a data do banco muda também com as gravações do próprio admin.
 */
const FaixaDoPlanoDoCliente: React.FC<{ onVoltar: () => void }> = ({ onVoltar }) => {
  const { planoDeCliente, atualizadoEmNoBanco } = usePlan();
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!planoDeCliente) return null;
  const quem = planoDeCliente.nome ? `${planoDeCliente.nome} (${planoDeCliente.email})` : planoDeCliente.email;

  const passou = atualizadoEmNoBanco ? Math.max(0, agora - atualizadoEmNoBanco.getTime()) : null;
  const minutos = passou !== null && passou < JANELA_DO_AVISO_MS ? Math.floor(passou / 60_000) : null;

  return (
    <div className="shrink-0 bg-brand-orange text-white px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="font-semibold break-words min-w-0">Você está no plano de {quem}</span>
      {minutos !== null && (
        <span className="text-orange-50 text-xs">
          {minutos === 0 ? 'Este plano foi alterado há menos de 1 min' : `Este plano foi alterado há ${minutos} min`}
        </span>
      )}
      <button
        type="button"
        onClick={onVoltar}
        className="ml-auto px-3 py-1 rounded-lg bg-white text-brand-orange text-xs font-semibold hover:bg-orange-50"
      >
        Voltar à Administração
      </button>
    </div>
  );
};

export default FaixaDoPlanoDoCliente;
