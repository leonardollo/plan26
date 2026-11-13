import React, { useState } from 'react';
import { usePlan } from '../../hooks/usePlanData';
import type { PlanoDeCliente } from '../../types';
import AbaClientes from './AbaClientes';
import AbaAdministradores from './AbaAdministradores';
import AbaRegistro from './AbaRegistro';
import type { Eu } from './comum';

type Aba = 'clientes' | 'administradores' | 'registro';
const ABAS: Array<{ id: Aba; texto: string }> = [
  { id: 'clientes', texto: 'Clientes' },
  { id: 'administradores', texto: 'Administradores' },
  { id: 'registro', texto: 'Registro' },
];

/**
 * Tela do administrador. Só aparece no menu para admin, mas quem protege é o banco:
 * as RPCs e o RLS recusam quem não é admin, mesmo que alguém force esta tela.
 */
const Administracao: React.FC<{ eu: Eu; onAbrirPlano: (c: PlanoDeCliente) => void }> = ({ eu, onAbrirPlano }) => {
  const { souAdmin } = usePlan();
  const [aba, setAba] = useState<Aba>('clientes');

  if (!souAdmin) {
    return <p className="p-6 bg-white rounded-xl border border-gray-200 text-sm text-gray-600">Esta tela é só para administradores.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Administração</h1>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={`shrink-0 px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              aba === a.id ? 'border-brand-orange text-brand-orange' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {a.texto}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {aba === 'clientes' && <AbaClientes eu={eu} onAbrirPlano={onAbrirPlano} />}
        {aba === 'administradores' && <AbaAdministradores eu={eu} />}
        {aba === 'registro' && <AbaRegistro />}
      </div>
    </div>
  );
};

export default Administracao;
