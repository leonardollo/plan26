/** Quem está usando a tela: identifica a própria linha, que não recebe ações. */
export interface Eu {
  uid: string;
  email: string;
}

/** Recusas do banco (PostgREST) e da Edge Function chegam com `message` pronta para a tela. */
export function mensagemDe(e: unknown): string {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m ? m : 'Algo deu errado; tente de novo.';
}

export const BOTAO = 'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50';
export const BOTAO_PRINCIPAL = `${BOTAO} bg-brand-orange text-white hover:bg-orange-700`;
export const BOTAO_NEUTRO = `${BOTAO} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`;
export const BOTAO_PERIGO = `${BOTAO} bg-white border border-red-300 text-red-700 hover:bg-red-50`;
