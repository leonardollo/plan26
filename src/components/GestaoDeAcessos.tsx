import React, { useCallback, useEffect, useState } from 'react';
import { usePlan } from '../hooks/usePlanData';
import { Acesso, StatusAcesso, quando } from '../services/acesso';

/**
 * Gestão de Acessos — a tela do administrador.
 *
 * Mostra quem pediu acesso e libera com um clique. Só aparece no menu para
 * quem é administrador, mas o que de fato protege é a regra do Firestore:
 * mesmo que alguém force esta tela, o banco recusa a escrita.
 */

const ROTULO: Record<StatusAcesso, { texto: string; classe: string }> = {
  pendente: { texto: 'Esperando você', classe: 'bg-amber-100 text-amber-800' },
  liberado: { texto: 'Liberado', classe: 'bg-green-100 text-green-800' },
  bloqueado: { texto: 'Bloqueado', classe: 'bg-red-100 text-red-800' },
};

const GestaoDeAcessos: React.FC = () => {
  const { listarAcessosDoBanco, mudarStatusDeAcesso, souAdmin } = usePlan();
  const [lista, setLista] = useState<Acesso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mexendo, setMexendo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<StatusAcesso | 'todos'>('todos');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setLista(await listarAcessosDoBanco());
    } catch (e) {
      setErro(
        e instanceof Error && /permission/i.test(e.message)
          ? 'O banco recusou a leitura. Confira se seu e-mail está na coleção "admins" e se as regras do Firestore foram publicadas.'
          : e instanceof Error
            ? e.message
            : 'Não consegui carregar a lista.'
      );
    } finally {
      setCarregando(false);
    }
  }, [listarAcessosDoBanco]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const mudar = async (uid: string, status: StatusAcesso) => {
    setMexendo(uid);
    try {
      await mudarStatusDeAcesso(uid, status);
      setLista((atual) => atual.map((a) => (a.uid === uid ? { ...a, status } : a)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui alterar.');
    } finally {
      setMexendo(null);
    }
  };

  if (!souAdmin) {
    return (
      <div className="bg-white p-8 rounded-xl border border-gray-200">
        <h1 className="text-2xl font-bold text-brand-dark mb-2">Gestão de Acessos</h1>
        <p className="text-gray-600">Esta tela é só para administradores.</p>
      </div>
    );
  }

  const visiveis = filtro === 'todos' ? lista : lista.filter((a) => a.status === filtro);
  const pendentes = lista.filter((a) => a.status === 'pendente').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark">Gestão de Acessos</h1>
          <p className="text-gray-500 mt-1">
            Quem se cadastra entra aqui esperando. Só depois de liberado o espaço de planejamento
            da pessoa passa a existir.
          </p>
        </div>
        <button
          onClick={carregar}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          Atualizar
        </button>
      </div>

      {pendentes > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
          <p className="text-amber-900 font-semibold text-sm">
            {pendentes === 1
              ? '1 pessoa esperando sua liberação'
              : `${pendentes} pessoas esperando sua liberação`}
          </p>
        </div>
      )}

      {erro && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded text-red-800 text-sm">{erro}</div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(['todos', 'pendente', 'liberado', 'bloqueado'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filtro === f
                ? 'bg-brand-dark text-white border-brand-dark'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {f === 'todos' ? 'Todos' : ROTULO[f].texto}
            {f !== 'todos' && ` (${lista.filter((a) => a.status === f).length})`}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {carregando ? (
          <div className="p-10 text-center text-gray-500">Carregando…</div>
        ) : !visiveis.length ? (
          <div className="p-10 text-center text-gray-500">
            {lista.length ? 'Ninguém com esse filtro.' : 'Ninguém se cadastrou ainda.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wide text-gray-600">Pessoa</th>
                  <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wide text-gray-600">Cadastrou</th>
                  <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wide text-gray-600">Situação</th>
                  <th className="text-right px-5 py-3 font-semibold text-xs uppercase tracking-wide text-gray-600">Ação</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((a) => (
                  <tr key={a.uid} className="border-b border-gray-100 last:border-0">
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{a.nome || '(sem nome)'}</div>
                      <div className="text-gray-500 text-xs">{a.email}</div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {quando(a.criadoEm)}
                      {a.status === 'liberado' && a.liberadoPor && (
                        <div className="text-xs text-gray-400">liberado por {a.liberadoPor}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ROTULO[a.status].classe}`}>
                        {ROTULO[a.status].texto}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {mexendo === a.uid ? (
                        <span className="text-gray-400 text-xs">salvando…</span>
                      ) : a.status === 'liberado' ? (
                        <button
                          onClick={() => mudar(a.uid, 'bloqueado')}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Suspender
                        </button>
                      ) : (
                        <button
                          onClick={() => mudar(a.uid, 'liberado')}
                          className="px-4 py-1.5 bg-brand-orange text-white rounded-lg text-xs font-medium hover:bg-orange-600"
                        >
                          Liberar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-brand-dark text-sm mb-2">Para colocar outro administrador</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          No console do Firebase, crie um documento na coleção <span className="font-mono">admins</span> usando
          o <strong>e-mail da pessoa como ID do documento</strong> (em minúsculas). O conteúdo pode ficar vazio.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          É de propósito que isso não se faça por aqui: se o app pudesse criar administradores, quem
          entrasse poderia se promover sozinho.
        </p>
      </div>
    </div>
  );
};

export default GestaoDeAcessos;
