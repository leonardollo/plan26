import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Admin, listarAdmins, promoverAdmin, rebaixarAdmin } from '../../services/acesso';
import { BOTAO_NEUTRO, BOTAO_PERIGO, BOTAO_PRINCIPAL, Eu, mensagemDe } from './comum';

const AbaAdministradores: React.FC<{ eu: Eu }> = ({ eu }) => {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState('');
  const [mexendo, setMexendo] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setAdmins(await listarAdmins(supabase));
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function executar(tarefa: () => Promise<void>) {
    setMexendo(true);
    setErro('');
    try {
      await tarefa();
      await carregar();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setMexendo(false);
    }
  }

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const email = novo.trim().toLowerCase();
    if (!email) return;
    executar(async () => {
      await promoverAdmin(supabase, email);
      setNovo('');
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={adicionar} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          aria-label="E-mail do novo administrador"
          placeholder="E-mail de quem já tem conta no PLAN"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 text-sm"
        />
        <button type="submit" disabled={mexendo} className={BOTAO_PRINCIPAL}>Adicionar admin</button>
      </form>

      {erro && <p role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{erro}</p>}

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando administradores...</p>
      ) : (
        <ul className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-200">
          {admins.map((a) => {
            const ehEu = a.email.toLowerCase() === eu.email.toLowerCase();
            return (
              <li key={a.email} aria-label={`Administrador ${a.email}`} className="p-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {a.uid ? (
                    <span className="font-semibold text-gray-900">{a.nome || a.email}</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">sem conta</span>
                  )}
                  {ehEu && <span className="text-[11px] text-gray-500">(você)</span>}
                </div>
                <span className="text-xs text-gray-500 break-all">{a.email}</span>
                {!ehEu && (
                  <div>
                    <button type="button" disabled={mexendo} className={BOTAO_PERIGO} onClick={() => setConfirmando(a.email)}>
                      Rebaixar
                    </button>
                  </div>
                )}
                {confirmando === a.email && (
                  <div className="p-3 rounded-lg bg-red-50 text-sm text-red-800 flex flex-wrap items-center gap-2">
                    <span>Rebaixar {a.email}? Ele deixa de ver a Administração e os planos dos clientes.</span>
                    <button
                      type="button"
                      className={BOTAO_PERIGO}
                      onClick={() => {
                        setConfirmando(null);
                        executar(() => rebaixarAdmin(supabase, a.email));
                      }}
                    >
                      Confirmar rebaixamento
                    </button>
                    <button type="button" className={BOTAO_NEUTRO} onClick={() => setConfirmando(null)}>Cancelar</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AbaAdministradores;
