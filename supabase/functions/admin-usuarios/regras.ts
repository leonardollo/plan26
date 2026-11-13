// Regras puras da Edge Function admin-usuarios: sem Deno e sem rede, para o vitest testar direto.

/** why: o link do "Defina sua senha" volta sempre para cá; um endereço vindo do pedido é ignorado. */
export const URL_DO_APP = 'https://planejamento.gestaoimpacto.com';

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOME_MAX = 120;

/** E-mail aparado e em minúsculas (admins.email exige minúsculas); null se não tiver formato de e-mail. */
export function normalizarEmail(bruto: unknown): string | null {
  if (typeof bruto !== 'string') return null;
  const email = bruto.trim().toLowerCase();
  return FORMATO_EMAIL.test(email) ? email : null;
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validarCriar(corpo: unknown): { email: string; nome: string } | { erro: string } {
  if (!ehObjeto(corpo)) return { erro: 'Pedido inválido' };
  const email = normalizarEmail(corpo.email);
  if (!email) return { erro: 'E-mail inválido' };
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
  if (!nome) return { erro: 'Nome obrigatório' };
  if (nome.length > NOME_MAX) return { erro: `Nome com mais de ${NOME_MAX} caracteres` };
  return { email, nome };
}

export function validarReenviar(corpo: unknown): { alvo: string } | { erro: string } {
  if (!ehObjeto(corpo) || typeof corpo.alvo !== 'string' || !FORMATO_UUID.test(corpo.alvo)) {
    return { erro: 'Cliente inválido' };
  }
  return { alvo: corpo.alvo.toLowerCase() };
}

const ORIGENS_FIXAS = new Set([URL_DO_APP, 'http://localhost:5173']);
// why: aceita hífens no meio para as prévias por branch (plan-git-<branch>-<time>.vercel.app), ancorada e só https.
// O CORS não é a barreira (o token do admin é); ele só deixa a tela ler a resposta.
const PREVIA_VERCEL = /^https:\/\/plan-[a-z0-9-]+-gestao-de-impactos-projects\.vercel\.app$/;

export function origemPermitida(origem: string | null): boolean {
  if (!origem) return false;
  return ORIGENS_FIXAS.has(origem) || PREVIA_VERCEL.test(origem);
}

export function cabecalhosCors(origem: string | null): Record<string, string> {
  const base: Record<string, string> = { Vary: 'Origin' };
  if (!origemPermitida(origem)) return base;
  return {
    ...base,
    'Access-Control-Allow-Origin': origem as string,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': 'Retry-After',
  };
}

// ---------- limite de envios ----------
// why: cada envio dispara um e-mail do Auth; o limite fica no banco (reservar_envio_de_senha), contado por hora,
// para não virar canhão de e-mail nem estourar a cota de envio do projeto (docs/SECURITY.md).

/** Criar + reenviar somados, por admin, por janela. */
export const LIMITE_ENVIOS_POR_ADMIN = 20;
/** Reenvios ao mesmo destinatário, por janela, somando todos os admins. */
export const LIMITE_REENVIOS_POR_DESTINATARIO = 3;
export const JANELA_DO_LIMITE_S = 3600;

/** Segundos para o Retry-After: até a janela liberar, arredondado para cima, entre 1 e a janela. */
export function segundosAteLiberar(liberaEm: Date, agora: Date): number {
  const s = Math.ceil((liberaEm.getTime() - agora.getTime()) / 1000);
  return Math.min(JANELA_DO_LIMITE_S, Math.max(1, s));
}
