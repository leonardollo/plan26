/**
 * Chamadas à Edge Function admin-usuarios: adicionar cliente e (re)enviar o "Defina sua senha".
 * Criar conta exige a chave secreta, que só existe no servidor; o app manda apenas o token do admin.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { StatusAcesso } from './acesso';

export type ResultadoCriar =
  | { resultado: 'criado' | 'criado_sem_email' }
  | { resultado: 'ja_existe'; status: StatusAcesso | 'administrador'; alvo?: string };

/** 429 da função (limite de envios por hora): a tela mostra quanto falta, em minutos arredondados para cima. */
function mensagemDeLimite(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return 'Muitos envios; tente de novo mais tarde';
  return `Muitos envios; tente de novo em ${Math.ceil(segundos / 60)} min`;
}

async function invocar<T>(cliente: SupabaseClient, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await cliente.functions.invoke('admin-usuarios', { body });
  if (!error) return data as T;
  // A resposta de erro da função traz { erro } com a mensagem para a tela.
  const contexto = (error as { context?: unknown }).context;
  if (contexto instanceof Response) {
    const retryAfter = Number(contexto.headers.get('Retry-After'));
    const corpo = await contexto.json().catch(() => null) as { erro?: unknown; esperaSegundos?: unknown } | null;
    if (corpo?.erro === 'limite') {
      const segundos = typeof corpo.esperaSegundos === 'number' ? corpo.esperaSegundos : retryAfter;
      throw new Error(mensagemDeLimite(segundos));
    }
    if (corpo && typeof corpo.erro === 'string') throw new Error(corpo.erro);
  }
  throw new Error('Não foi possível falar com o servidor; tente de novo');
}

export function criarCliente(cliente: SupabaseClient, email: string, nome: string): Promise<ResultadoCriar> {
  return invocar<ResultadoCriar>(cliente, { acao: 'criar', email, nome });
}

export async function reenviarEmailDeSenha(cliente: SupabaseClient, alvo: string): Promise<void> {
  await invocar<unknown>(cliente, { acao: 'reenviar', alvo });
}
