import React from 'react';
import { linkDoCheckout, type ConfigDoCheckout } from '../utils/checkout';

/**
 * Cartão do plano anual. Sem configuração do checkout (link ausente ou fora da Hotmart),
 * só avisa que as assinaturas abrem em breve: nunca um botão que leva a lugar nenhum.
 */
const CartaoAssinatura: React.FC<{ config: ConfigDoCheckout | null; email?: string | null; mostrarAvisoDoEmail?: boolean }> = ({
  config,
  email,
  mostrarAvisoDoEmail = false,
}) => {
  if (!config) {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 text-center">
        <p className="font-semibold text-brand-dark">Assinaturas abrem em breve</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
      {/* why: no celular, "R$" sozinho no fim da linha separava do valor; o espaço do preço não quebra. */}
      <p className="text-lg font-bold text-brand-dark">
        {config.preco ? `Plano anual — ${config.preco.replace(/ /g, ' ')}/ano` : 'Plano anual'}
      </p>
      <p className="mt-1 text-sm text-gray-700">Planejamento estratégico, comercial e financeiro completo, por um ano.</p>
      {mostrarAvisoDoEmail && (
        <p className="mt-2 text-sm font-medium text-gray-800">Pague com este mesmo e-mail; o acesso libera em poucos minutos</p>
      )}
      <a
        href={linkDoCheckout(config, email)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-brand-orange px-5 py-3 font-semibold text-white transition-colors hover:bg-orange-600"
      >
        Assinar
      </a>
    </div>
  );
};

export default CartaoAssinatura;
