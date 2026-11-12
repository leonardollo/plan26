/**
 * Controle de acesso do PLAN
 *
 * Antes, quem se cadastrasse entrava com acesso total: a verificação era um
 * `setSubscriptionStatus('active')` fixo, e o cadastro chamava
 * `createUserWithEmailAndPassword` sem trava nenhuma. Qualquer pessoa da
 * internet abria a página, se cadastrava e usava o sistema inteiro.
 *
 * Agora existe um portão. Quem se cadastra entra na fila como `pendente` e não
 * enxerga nada além da tela de espera. Um administrador libera, e só então o
 * espaço de dados daquela pessoa passa a existir de fato.
 *
 * Duas escolhas que sustentam isso:
 *
 * 1. Quem manda é o RLS do banco (supabase/migrations), não esta tela. O código
 *    aqui pode ser burlado por qualquer um com o navegador aberto — ele serve
 *    para a pessoa entender o que está acontecendo. Quem de fato barra são as
 *    políticas de `planos`, que só deixam ler e gravar com o acesso liberado.
 *
 * 2. A linha de acesso nasce no banco, por gatilho, sempre como `pendente`.
 *    Mudar o status é privilégio de administrador, pela função
 *    `definir_status_de_acesso` — também garantido no banco, não aqui.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type StatusAcesso = 'pendente' | 'liberado' | 'bloqueado';

export interface Acesso {
  uid: string;
  email: string;
  nome: string;
  status: StatusAcesso;
  criadoEm?: unknown;
  liberadoEm?: unknown;
  liberadoPor?: string | null;
  /** Ausente nos pedidos criados antes deste campo existir. */
  emailVerificado?: boolean;
}

type LinhaDeAcesso = {
  user_id: string;
  email: string | null;
  nome: string | null;
  status: string | null;
  criado_em: string | null;
  liberado_em: string | null;
  liberado_por: string | null;
  email_verificado: boolean | null;
};

const COLUNAS = 'user_id, email, nome, status, criado_em, liberado_em, liberado_por, email_verificado';

function paraAcesso(l: LinhaDeAcesso): Acesso {
  return {
    uid: l.user_id,
    email: l.email || '',
    nome: l.nome || '',
    status: (l.status as StatusAcesso) || 'pendente',
    criadoEm: l.criado_em,
    liberadoEm: l.liberado_em,
    liberadoPor: l.liberado_por ?? null,
    emailVerificado: l.email_verificado ?? undefined,
  };
}

/**
 * Administrador é quem tem o e-mail (confirmado) na tabela `admins`; quem
 * responde é o próprio banco, pela mesma função que as políticas usam.
 */
export async function ehAdministrador(cliente: SupabaseClient): Promise<boolean> {
  const { data, error } = await cliente.rpc('sou_admin');
  // Na dúvida, não é admin: o banco recusaria o painel de qualquer jeito.
  if (error) return false;
  return data === true;
}

/** O acesso de quem entrou; null se a linha ainda não existe (o gatilho não rodou ou falhou). */
export async function obterAcesso(cliente: SupabaseClient, uid: string): Promise<Acesso | null> {
  const { data, error } = await cliente.from('acessos').select(COLUNAS).eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data ? paraAcesso(data as LinhaDeAcesso) : null;
}

/** Lista a fila inteira. Só administrador vê todos — o RLS devolve ao resto só a própria linha. */
export async function listarAcessos(cliente: SupabaseClient): Promise<Acesso[]> {
  const { data, error } = await cliente.from('acessos').select(COLUNAS).order('criado_em', { ascending: false });
  if (error) throw error;
  return (data as LinhaDeAcesso[]).map(paraAcesso);
}

/** Rótulo da coluna "E-mail verificado"; '—' é pedido antigo, sem o campo. */
export function rotuloEmailVerificado(v: boolean | undefined): 'Sim' | 'Não' | '—' {
  if (v === undefined) return '—';
  return v ? 'Sim' : 'Não';
}

/** Libera, bloqueia ou devolve alguém para a fila. Quem e quando, o banco registra. */
export async function definirStatus(cliente: SupabaseClient, uid: string, status: StatusAcesso): Promise<void> {
  const { error } = await cliente.rpc('definir_status_de_acesso', { alvo: uid, novo_status: status });
  if (error) throw error;
}

/** Data legível a partir do texto ISO do banco (ou do carimbo antigo do Firestore). */
export function quando(valor: unknown): string {
  if (!valor) return '—';
  const v = valor as { toDate?: () => Date; seconds?: number };
  const d = typeof valor === 'string' ? new Date(valor)
    : typeof v.toDate === 'function' ? v.toDate()
      : v.seconds ? new Date(v.seconds * 1000) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
}
