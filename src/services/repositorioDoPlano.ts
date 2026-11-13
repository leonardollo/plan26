/**
 * De onde o PlanProvider lê e para onde grava o plano: o próprio (tabela `planos`, pelo RLS de sempre)
 * ou o de um cliente aberto pelo admin (funções do banco que conferem o admin e registram no Registro).
 * O provider escolhe um repositório uma vez e não sabe qual é.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { carregarPlano, listarPlanos, salvarPlano, type DadosDoPlano } from './planos';
import { anosDoCliente, planoDoCliente, salvarPlanoDoCliente } from './planoDoCliente';

export interface RepositorioDoPlano {
  anos(): Promise<number[]>;
  /** null sem plano salvo; atualizadoEm null quando a origem não informa (o plano próprio). */
  carregar(ano: number): Promise<{ dados: Partial<DadosDoPlano>; atualizadoEm: Date | null } | null>;
  /** Devolve quando o banco gravou, se a origem informa. */
  salvar(ano: number, dados: DadosDoPlano): Promise<Date | null>;
}

export function repositorioProprio(cliente: SupabaseClient, uid: string): RepositorioDoPlano {
  return {
    anos: () => listarPlanos(cliente, uid),
    async carregar(ano) {
      const dados = await carregarPlano(cliente, uid, ano);
      return dados ? { dados, atualizadoEm: null } : null;
    },
    async salvar(ano, dados) {
      await salvarPlano(cliente, uid, ano, dados);
      return null;
    },
  };
}

export function repositorioDoCliente(cliente: SupabaseClient, alvo: string): RepositorioDoPlano {
  return {
    anos: () => anosDoCliente(cliente, alvo),
    carregar: (ano) => planoDoCliente(cliente, alvo, ano),
    salvar: (ano, dados) => salvarPlanoDoCliente(cliente, alvo, ano, dados),
  };
}
