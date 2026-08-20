/**
 * Controle de acesso do PLAN 2026
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
 * 1. Quem manda é a REGRA DO BANCO, não esta tela. O código aqui pode ser
 *    burlado por qualquer um com o navegador aberto — ele serve para a pessoa
 *    entender o que está acontecendo. Quem de fato barra é o `firestore.rules`,
 *    que só deixa ler e escrever `users/{uid}` quando o acesso está liberado.
 *
 * 2. O usuário cria o próprio pedido, mas só pode criá-lo como `pendente`.
 *    Mudar o status é privilégio de administrador — também garantido na regra,
 *    não aqui.
 */

import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

export type StatusAcesso = 'pendente' | 'liberado' | 'bloqueado';

export interface Acesso {
  uid: string;
  email: string;
  nome: string;
  status: StatusAcesso;
  criadoEm?: unknown;
  liberadoEm?: unknown;
  liberadoPor?: string | null;
  observacao?: string;
}

export const COLECAO_ACESSOS = 'acessos';
export const COLECAO_ADMINS = 'admins';

/**
 * Administrador é quem tem um documento em `admins` com o e-mail como id.
 * Fica pelo e-mail e não pelo uid de propósito: assim dá para cadastrar alguém
 * pelo console do Firebase antes mesmo dessa pessoa ter conta.
 */
export async function ehAdministrador(db: Firestore, email: string | null): Promise<boolean> {
  if (!email) return false;
  try {
    const snap = await getDoc(doc(db, COLECAO_ADMINS, email.toLowerCase().trim()));
    return snap.exists();
  } catch {
    // sem permissão de leitura = não é admin
    return false;
  }
}

/**
 * Busca o acesso de quem acabou de entrar. Se for a primeira vez, cria o
 * pedido como pendente — é o que coloca a pessoa na fila do administrador.
 */
export async function obterOuCriarAcesso(
  db: Firestore,
  uid: string,
  email: string | null,
  nome: string | null
): Promise<Acesso> {
  const ref = doc(db, COLECAO_ACESSOS, uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const d = snap.data();
    return {
      uid,
      email: d.email || email || '',
      nome: d.nome || nome || '',
      status: (d.status as StatusAcesso) || 'pendente',
      criadoEm: d.criadoEm,
      liberadoEm: d.liberadoEm,
      liberadoPor: d.liberadoPor ?? null,
      observacao: d.observacao,
    };
  }

  const novo = {
    email: (email || '').toLowerCase().trim(),
    nome: nome || '',
    status: 'pendente' as const,
    criadoEm: serverTimestamp(),
    liberadoEm: null,
    liberadoPor: null,
  };
  await setDoc(ref, novo);
  return { uid, ...novo, criadoEm: undefined };
}

/** Lista a fila inteira. Só administrador consegue — a regra do banco barra o resto. */
export async function listarAcessos(db: Firestore): Promise<Acesso[]> {
  const q = query(collection(db, COLECAO_ACESSOS), orderBy('criadoEm', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const v = d.data();
    return {
      uid: d.id,
      email: v.email || '',
      nome: v.nome || '',
      status: (v.status as StatusAcesso) || 'pendente',
      criadoEm: v.criadoEm,
      liberadoEm: v.liberadoEm,
      liberadoPor: v.liberadoPor ?? null,
      observacao: v.observacao,
    };
  });
}

/** Libera, bloqueia ou devolve alguém para a fila. */
export async function definirStatus(
  db: Firestore,
  uid: string,
  status: StatusAcesso,
  emailDoAdmin: string
): Promise<void> {
  await updateDoc(doc(db, COLECAO_ACESSOS, uid), {
    status,
    liberadoEm: status === 'liberado' ? serverTimestamp() : null,
    liberadoPor: emailDoAdmin,
  });
}

/** Data legível a partir do carimbo do Firestore. */
export function quando(valor: unknown): string {
  if (!valor) return '—';
  const v = valor as { toDate?: () => Date; seconds?: number };
  const d = typeof v.toDate === 'function' ? v.toDate() : v.seconds ? new Date(v.seconds * 1000) : null;
  if (!d) return '—';
  return (
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
}
