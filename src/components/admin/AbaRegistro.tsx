import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Acesso, AcaoDoRegistro, listarAcessos, listarRegistro } from '../../services/acesso';
import { mensagemDe } from './comum';

const dois = (n: number) => String(n).padStart(2, '0');
// Formato fixo (dd/mm/aa hh:mm), igual em qualquer navegador.
const formatar = (d: Date) =>
  `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${dois(d.getFullYear() % 100)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;

const textoDoDetalhe = (detalhe: Record<string, unknown>) =>
  Object.entries(detalhe)
    .map(([k, v]) => `${k}: ${v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');

const AbaRegistro: React.FC = () => {
  const [clientes, setClientes] = useState<Acesso[]>([]);
  const [alvo, setAlvo] = useState('');
  const [acoes, setAcoes] = useState<AcaoDoRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarAcessos(supabase).then(setClientes, (e) => setErro(mensagemDe(e)));
  }, []);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    listarRegistro(supabase, alvo || undefined).then(
      (l) => { if (vivo) { setAcoes(l); setErro(''); } },
      (e) => { if (vivo) setErro(mensagemDe(e)); },
    ).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [alvo]);

  return (
    <div className="space-y-4">
      <select
        aria-label="Filtrar por cliente"
        value={alvo}
        onChange={(e) => setAlvo(e.target.value)}
        className="w-full sm:w-auto max-w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white"
      >
        <option value="">Todos os clientes</option>
        {clientes.map((c) => (
          <option key={c.uid} value={c.uid}>{c.nome ? `${c.nome} (${c.email})` : c.email}</option>
        ))}
      </select>

      {erro && <p role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{erro}</p>}

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando o registro...</p>
      ) : acoes.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma ação registrada.</p>
      ) : (
        <ul className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-200">
          {acoes.map((a) => (
            <li key={a.id} aria-label={`Ação ${a.id}`} className="p-4 grid gap-1 text-sm sm:grid-cols-[8rem_1fr_7rem_1fr] sm:gap-3">
              <span className="text-gray-500 tabular-nums">{formatar(a.quando)}</span>
              <span className="text-gray-700 break-all">{a.adminEmail}</span>
              <span className="font-semibold text-gray-900">{a.acao}</span>
              <span className="text-gray-700 break-all">{a.alvoEmail ?? '—'}</span>
              {Object.keys(a.detalhe).length > 0 && (
                <span className="text-xs text-gray-500 break-all sm:col-span-4">{textoDoDetalhe(a.detalhe)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AbaRegistro;
