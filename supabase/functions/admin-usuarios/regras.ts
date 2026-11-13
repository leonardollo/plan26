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
// why: só o hash da prévia (sem hífen) entre "plan-" e o time; com hífen, outro time chamado
// "x-gestao-de-impactos-projects" casaria. O CORS não é a barreira (o token do admin é), mas não abre a mais.
const PREVIA_VERCEL = /^https:\/\/plan-[a-z0-9]+-gestao-de-impactos-projects\.vercel\.app$/;

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
  };
}
