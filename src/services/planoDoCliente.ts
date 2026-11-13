/**
 * O plano de um cliente aberto pelo administrador. Tudo passa por funções do banco
 * (anos_do_cliente, plano_do_cliente, salvar_plano_do_cliente) que conferem se quem chama é admin
 * e registram a abertura e a alteração no Registro; as políticas de `planos` não mudam.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DadosDoPlano } from './planos';

export async function anosDoCliente(cliente: SupabaseClient, alvo: string): Promise<number[]> {
  const { data, error } = await cliente.rpc('anos_do_cliente', { alvo });
  if (error) throw error;
  return ((data ?? []) as Array<number | string>).map(Number);
}

/** null quando o cliente não tem plano daquele ano. Cada leitura entra no Registro como "abriu plano". */
export async function planoDoCliente(
  cliente: SupabaseClient, alvo: string, ano: number,
): Promise<{ dados: Partial<DadosDoPlano>; atualizadoEm: Date } | null> {
  const { data, error } = await cliente.rpc('plano_do_cliente', { alvo, ano });
  if (error) throw error;
  const [linha] = (data ?? []) as Array<{ dados: Partial<DadosDoPlano> | null; atualizado_em: string }>;
  if (!linha) return null;
  return { dados: linha.dados ?? {}, atualizadoEm: new Date(linha.atualizado_em) };
}

/** Grava o plano inteiro do cliente e devolve o atualizado_em gravado. */
export async function salvarPlanoDoCliente(
  cliente: SupabaseClient, alvo: string, ano: number, dados: DadosDoPlano,
): Promise<Date> {
  const { data, error } = await cliente.rpc('salvar_plano_do_cliente', { alvo, ano, dados });
  if (error) throw error;
  return new Date(data as string);
}
