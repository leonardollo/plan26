import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Acesso, StatusAcesso, definirStatus, listarAcessos, listarAdmins, promoverAdmin, tirarPrazo } from '../../services/acesso';
import { criarCliente, reenviarEmailDeSenha } from '../../services/adminUsuarios';
import type { PlanoDeCliente } from '../../types';
import { rotuloDoPrazo } from '../../utils/prazo';
import { BOTAO_NEUTRO, BOTAO_PERIGO, BOTAO_PRINCIPAL, Eu, mensagemDe } from './comum';

const ROTULO: Record<StatusAcesso, { texto: string; classe: string }> = {
  pendente: { texto: 'Pendente', classe: 'bg-amber-100 text-amber-800' },
  liberado: { texto: 'Liberado', classe: 'bg-green-100 text-green-800' },
  bloqueado: { texto: 'Bloqueado', classe: 'bg-red-100 text-red-800' },
  removido: { texto: 'Removido', classe: 'bg-gray-100 text-gray-600' },
};

type Filtro = 'todos' | StatusAcesso;
const FILTROS: Array<{ id: Filtro; texto: string }> = [
  { id: 'todos', texto: 'Todos' },
  { id: 'pendente', texto: 'Pendentes' },
  { id: 'liberado', texto: 'Liberados' },
  { id: 'bloqueado', texto: 'Bloqueados' },
  { id: 'removido', texto: 'Removidos' },
];

type Acao = 'liberar' | 'tirar_prazo' | 'bloquear' | 'remover' | 'reativar' | 'reenviar' | 'abrir' | 'tornar_admin';
const TEXTO_DA_ACAO: Record<Acao, string> = {
  liberar: 'Liberar',
  tirar_prazo: 'Liberar sem prazo',
  bloquear: 'Bloquear',
  remover: 'Remover',
  reativar: 'Reativar',
  reenviar: 'Reenviar e-mail de senha',
  abrir: 'Abrir plano',
  tornar_admin: 'Tornar admin',
};

/** O que não está na lista do status não aparece (spec: tela Administração, aba Clientes). */
function acoesDe(status: StatusAcesso, ehAdmin: boolean, ehEu: boolean, temPrazo = false): Acao[] {
  if (ehEu) return [];
  if (ehAdmin) return ['abrir'];
  switch (status) {
    case 'pendente': return ['liberar', 'bloquear', 'remover', 'reenviar', 'abrir', 'tornar_admin'];
    case 'liberado':
      // why: tirar o prazo não muda o status; só faz sentido para quem já está liberado e tem prazo (pago ou vencido).
      return [...(temPrazo ? (['tirar_prazo'] as Acao[]) : []), 'bloquear', 'remover', 'reenviar', 'abrir', 'tornar_admin'];
    case 'bloqueado': return ['liberar', 'remover', 'abrir'];
    case 'removido': return ['reativar', 'abrir'];
  }
}

type Aviso = { texto: string; reativar?: string };

interface Props {
  eu: Eu;
  onAbrirPlano: (c: PlanoDeCliente) => void;
}

const AbaClientes: React.FC<Props> = ({ eu, onAbrirPlano }) => {
  const [lista, setLista] = useState<Acesso[]>([]);
  const [admins, setAdmins] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  // "Todos" esconde os removidos: quem saiu só aparece quando o admin pede.
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [mexendo, setMexendo] = useState<string | null>(null);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [acessos, listaDeAdmins] = await Promise.all([listarAcessos(supabase), listarAdmins(supabase)]);
      setLista(acessos);
      setAdmins(new Set(listaDeAdmins.map((a) => a.email.toLowerCase())));
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { todos: 0, pendente: 0, liberado: 0, bloqueado: 0, removido: 0 };
    for (const a of lista) {
      c[a.status] += 1;
      if (a.status !== 'removido') c.todos += 1;
    }
    return c;
  }, [lista]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lista.filter((a) => {
      if (filtro === 'todos' ? a.status === 'removido' : a.status !== filtro) return false;
      if (!termo) return true;
      return a.nome.toLowerCase().includes(termo) || a.email.toLowerCase().includes(termo);
    });
  }, [lista, busca, filtro]);

  async function executar(chave: string, tarefa: () => Promise<void>) {
    setMexendo(chave);
    setErro('');
    setAviso(null);
    try {
      await tarefa();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setMexendo(null);
    }
  }

  const mudarStatus = (uid: string, status: StatusAcesso, texto?: string) =>
    executar(uid, async () => {
      await definirStatus(supabase, uid, status);
      setLista((l) => l.map((a) => (a.uid === uid ? { ...a, status } : a)));
      if (texto) setAviso({ texto });
    });

  function agir(a: Acesso, acao: Acao) {
    switch (acao) {
      case 'liberar': return mudarStatus(a.uid, 'liberado');
      case 'bloquear': return mudarStatus(a.uid, 'bloqueado');
      case 'reativar': return mudarStatus(a.uid, 'liberado', `${a.email} foi reativado e liberado.`);
      case 'tirar_prazo':
        return executar(a.uid, async () => {
          await tirarPrazo(supabase, a.uid);
          setLista((l) => l.map((x) => (x.uid === a.uid ? { ...x, acessoAte: null } : x)));
          setAviso({ texto: `${a.email} agora tem acesso sem prazo.` });
        });
      case 'remover':
        setConfirmandoRemocao(a.uid);
        return;
      case 'reenviar':
        return executar(a.uid, async () => {
          await reenviarEmailDeSenha(supabase, a.uid);
          setAviso({ texto: `E-mail de senha enviado para ${a.email}.` });
        });
      case 'abrir':
        onAbrirPlano({ uid: a.uid, email: a.email, nome: a.nome || null });
        return;
      case 'tornar_admin':
        return executar(a.uid, async () => {
          await promoverAdmin(supabase, a.email);
          setAdmins((s) => new Set(s).add(a.email.toLowerCase()));
          setAviso({ texto: `${a.email} agora é administrador.` });
        });
    }
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const email = novoEmail.trim().toLowerCase();
    const nome = novoNome.trim();
    if (!email) return;
    await executar('novo', async () => {
      const r = await criarCliente(supabase, email, nome);
      if (r.resultado === 'ja_existe') {
        const rotulo = r.status === 'administrador' ? 'administrador' : ROTULO[r.status].texto;
        setAviso({
          texto: `Esse e-mail já existe (${rotulo}). Nada mudou.`,
          reativar: r.status === 'removido' ? r.alvo : undefined,
        });
        return;
      }
      setAviso({
        texto: r.resultado === 'criado'
          ? `Cliente criado e liberado. O e-mail "Defina sua senha" foi para ${email}.`
          : `Cliente criado e liberado, mas o e-mail de senha não saiu: use Reenviar na linha de ${email}.`,
      });
      setNovoEmail('');
      setNovoNome('');
      setAdicionando(false);
      await carregar();
    });
  }

  const reativarDoAviso = (uid: string) =>
    executar(uid, async () => {
      await definirStatus(supabase, uid, 'liberado');
      setLista((l) => l.map((a) => (a.uid === uid ? { ...a, status: 'liberado' } : a)));
      setAviso({ texto: 'Cliente reativado e liberado.' });
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="search"
          aria-label="Buscar cliente"
          placeholder="Buscar por nome ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 text-sm"
        />
        <button type="button" className={BOTAO_PRINCIPAL} onClick={() => setAdicionando((v) => !v)}>
          Adicionar cliente
        </button>
      </div>

      {adicionando && (
        <form onSubmit={adicionar} className="p-4 bg-gray-50 border border-gray-200 rounded-xl grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-xs font-semibold text-gray-600">
            E-mail
            <input
              type="email"
              required
              aria-label="E-mail do cliente"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Nome
            <input
              type="text"
              aria-label="Nome do cliente"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-normal"
            />
          </label>
          <button type="submit" disabled={mexendo === 'novo'} className={BOTAO_PRINCIPAL}>Criar cliente</button>
        </form>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              filtro === f.id ? 'bg-brand-dark text-white border-brand-dark' : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            {f.texto} ({contagem[f.id]})
          </button>
        ))}
      </div>

      {erro && <p role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{erro}</p>}
      {aviso && (
        <div role="status" className="p-3 rounded-lg bg-green-50 text-green-800 text-sm flex flex-wrap items-center gap-2">
          <span>{aviso.texto}</span>
          {aviso.reativar && (
            <button type="button" className={BOTAO_NEUTRO} disabled={!!mexendo} onClick={() => reativarDoAviso(aviso.reativar!)}>
              Reativar
            </button>
          )}
        </div>
      )}

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando clientes...</p>
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-gray-500">Ninguém aqui.</p>
      ) : (
        <ul className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-200">
          {visiveis.map((a) => {
            const ehEu = a.uid === eu.uid;
            const ehAdmin = admins.has(a.email.toLowerCase());
            return (
              <li key={a.uid} aria-label={`Cliente ${a.email}`} className="p-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900 break-all">{a.nome || a.email}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ROTULO[a.status].classe}`}>
                    {ROTULO[a.status].texto}
                  </span>
                  {ehAdmin && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-dark text-white">admin</span>}
                  {ehEu && <span className="text-[11px] text-gray-500">(você)</span>}
                </div>
                {a.nome && <span className="text-xs text-gray-500 break-all">{a.email}</span>}
                <span className="text-xs text-gray-500">Acesso até: {rotuloDoPrazo(a.acessoAte)}</span>
                <div className="flex flex-wrap gap-2">
                  {acoesDe(a.status, ehAdmin, ehEu, !!a.acessoAte).map((acao) => (
                    <button
                      key={acao}
                      type="button"
                      disabled={mexendo === a.uid}
                      onClick={() => agir(a, acao)}
                      className={acao === 'remover' || acao === 'bloquear' ? BOTAO_PERIGO : BOTAO_NEUTRO}
                    >
                      {TEXTO_DA_ACAO[acao]}
                    </button>
                  ))}
                </div>
                {confirmandoRemocao === a.uid && (
                  <div className="p-3 rounded-lg bg-red-50 text-sm text-red-800 flex flex-wrap items-center gap-2">
                    <span>Remover {a.nome || a.email}? A conta é desativada; nada é apagado e dá para reativar depois.</span>
                    <button
                      type="button"
                      className={BOTAO_PERIGO}
                      onClick={() => {
                        setConfirmandoRemocao(null);
                        mudarStatus(a.uid, 'removido', `${a.email} foi removido.`);
                      }}
                    >
                      Confirmar remoção
                    </button>
                    <button type="button" className={BOTAO_NEUTRO} onClick={() => setConfirmandoRemocao(null)}>Cancelar</button>
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

export default AbaClientes;
