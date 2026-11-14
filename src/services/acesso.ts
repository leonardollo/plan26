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

// `removido`: o admin tirou o cliente da lista; a conta e o plano continuam, e ele pode ser reativado.
export type StatusAcesso = 'pendente' | 'liberado' | 'bloqueado' | 'removido';

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
  /** Fim do acesso pago (ISO); null é sem prazo (clientes antigos e quem o admin liberou sem prazo). */
  acessoAte?: string | null;
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
  acesso_ate: string | null;
};

const COLUNAS = 'user_id, email, nome, status, criado_em, liberado_em, liberado_por, email_verificado, acesso_ate';

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
    acessoAte: l.acesso_ate ?? null,
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

/**
 * Define o último dia de acesso (AAAA-MM-DD, em São Paulo) de um cliente liberado e devolve o prazo gravado.
 * O banco recusa quem não é admin, hoje, passado e mais de 5 anos à frente, e registra a ação.
 */
export async function definirPrazo(cliente: SupabaseClient, alvo: string, dia: string): Promise<string> {
  const { data, error } = await cliente.rpc('admin_definir_prazo', { alvo, dia });
  if (error) throw error;
  return data as string;
}

/** Tira o prazo de uma conta (acesso sem vencimento). O banco recusa quem não é admin e registra a ação. */
export async function tirarPrazo(cliente: SupabaseClient, alvo: string): Promise<void> {
  const { error } = await cliente.rpc('admin_tirar_prazo', { alvo });
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

export type Admin = { email: string; uid: string | null; nome: string | null };

/** Administradores, com a conta de cada um quando existe (uid/nome null: e-mail sem conta). */
export async function listarAdmins(cliente: SupabaseClient): Promise<Admin[]> {
  const { data, error } = await cliente.rpc('listar_admins');
  if (error) throw error;
  return ((data ?? []) as Array<{ email: string; user_id: string | null; nome: string | null }>).map((l) => ({
    email: l.email,
    uid: l.user_id ?? null,
    nome: l.nome ?? null,
  }));
}

/** O banco recusa e-mail sem conta, cliente removido e quem não é admin. */
export async function promoverAdmin(cliente: SupabaseClient, email: string): Promise<void> {
  const { error } = await cliente.rpc('promover_admin', { email });
  if (error) throw error;
}

/** O banco recusa rebaixar a si mesmo e o último administrador. */
export async function rebaixarAdmin(cliente: SupabaseClient, email: string): Promise<void> {
  const { error } = await cliente.rpc('rebaixar_admin', { email });
  if (error) throw error;
}

export type AcaoDoRegistro = {
  id: number;
  quando: Date;
  adminEmail: string;
  acao: string;
  alvo: string | null;
  alvoEmail: string | null;
  detalhe: Record<string, unknown>;
};

type LinhaDoRegistro = {
  id: number;
  quando: string;
  admin_email: string;
  acao: string;
  alvo: string | null;
  alvo_email: string | null;
  detalhe: Record<string, unknown> | null;
};

const LIMITE_DO_REGISTRO = 200;

/** Ações dos administradores, mais novas primeiro; com `alvo`, só as daquele cliente. Só admin lê (RLS). */
export async function listarRegistro(cliente: SupabaseClient, alvo?: string): Promise<AcaoDoRegistro[]> {
  let consulta = cliente
    .from('registro_admin')
    .select('id, quando, admin_email, acao, alvo, alvo_email, detalhe')
    .order('quando', { ascending: false })
    .limit(LIMITE_DO_REGISTRO);
  if (alvo) consulta = consulta.eq('alvo', alvo);
  const { data, error } = await consulta;
  if (error) throw error;
  return ((data ?? []) as LinhaDoRegistro[]).map((l) => ({
    id: l.id,
    quando: new Date(l.quando),
    adminEmail: l.admin_email,
    acao: l.acao,
    alvo: l.alvo,
    alvoEmail: l.alvo_email,
    detalhe: l.detalhe ?? {},
  }));
}
