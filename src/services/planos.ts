import type { SupabaseClient } from '@supabase/supabase-js';
import type { Goals2026, PlanData, PricingItem, Scenarios2026, TaxesData, Tracking2026 } from '../types';

// No modo local (sem servidor), o plano 2026 mora na chave antiga, sem o ano: as chaves salvas no navegador não mudam.
export const ANO_DO_PLANO_LEGADO = 2026;

export type AnosDoPlano = { anoPlano: number; anoBase: number };

export const anosDoPlano = (anoPlano: number): AnosDoPlano => ({ anoPlano, anoBase: anoPlano - 1 });

export type DadosDoPlano = {
    planData: PlanData;
    goals2026: Goals2026;
    scenarios2026: Scenarios2026;
    tracking2026: Tracking2026;
    taxes: TaxesData;
    pricingItems: PricingItem[];
};

const PREFIXO_LOCAL = 'plan_data_';
const ID_DE_ANO = /^\d{4}$/;

export function chaveLocalDoPlano(uid: string, ano: number): string {
    return ano === ANO_DO_PLANO_LEGADO ? `${PREFIXO_LOCAL}${uid}` : `${PREFIXO_LOCAL}${uid}_${ano}`;
}

// O app é sempre o planejamento do ano seguinte ao atual (decisão do usuário, 11/11/2026). Data local.
export function anoDoPlanoAtual(hoje: Date): number {
    return hoje.getFullYear() + 1;
}

export type AberturaDoPlano = { abrir: number; copiarDe: number | null };

// Sem o ano seguinte salvo, ele é criado a partir do ano anterior mais recente; conta sem plano abre em branco, sem gravar.
export function aberturaDoPlano(anosSalvos: number[], hoje: Date): AberturaDoPlano {
    const alvo = anoDoPlanoAtual(hoje);
    if (anosSalvos.includes(alvo)) return { abrir: alvo, copiarDe: null };
    const anteriores = anosSalvos.filter(ano => ano < alvo);
    if (anteriores.length > 0) return { abrir: alvo, copiarDe: Math.max(...anteriores) };
    // Só anos à frente do alvo (relógio atrasado): abre o mais recente, sem criar nada.
    if (anosSalvos.length > 0) return { abrir: Math.max(...anosSalvos), copiarDe: null };
    return { abrir: alvo, copiarDe: null };
}

// Sem plano salvo não há de onde copiar. Oferece o ano do plano atual, não o seguinte ao último salvo:
// quem volta em 2028 só com o 2026 começa 2029, nunca um 2027 já passado.
export function proximoAnoDoPlano(anosSalvos: number[], hoje: Date): number | null {
    if (anosSalvos.length === 0) return null;
    const alvo = anoDoPlanoAtual(hoje);
    return anosSalvos.includes(alvo) || Math.max(...anosSalvos) > alvo ? null : alvo;
}

const ordenados = (anos: number[]) => [...new Set(anos)].sort((a, b) => a - b);

// Cada função lança o erro do banco: uma leitura ou gravação recusada pelo RLS não pode passar calada.
export async function listarPlanos(cliente: SupabaseClient, uid: string): Promise<number[]> {
    const { data, error } = await cliente.from('planos').select('ano').eq('user_id', uid);
    if (error) throw error;
    return ordenados((data ?? []).map(l => Number(l.ano)));
}

export async function carregarPlano(
    cliente: SupabaseClient, uid: string, ano: number,
): Promise<Partial<DadosDoPlano> | null> {
    const { data, error } = await cliente.from('planos').select('dados').eq('user_id', uid).eq('ano', ano).maybeSingle();
    if (error) throw error;
    return (data?.dados as Partial<DadosDoPlano> | undefined) ?? null;
}

// O documento inteiro é trocado: `dados` só leva os seis blocos do plano, todos presentes a cada gravação.
export async function salvarPlano(cliente: SupabaseClient, uid: string, ano: number, dados: DadosDoPlano): Promise<void> {
    const { error } = await cliente.from('planos').upsert({ user_id: uid, ano, dados }, { onConflict: 'user_id,ano' });
    if (error) throw error;
}

export function listarPlanosLocais(storage: Storage, uid: string): number[] {
    const anos: number[] = [];
    const legado = chaveLocalDoPlano(uid, ANO_DO_PLANO_LEGADO);
    for (let i = 0; i < storage.length; i++) {
        const chave = storage.key(i);
        if (!chave) continue;
        if (chave === legado) {
            anos.push(ANO_DO_PLANO_LEGADO);
        } else if (chave.startsWith(`${legado}_`)) {
            const id = chave.slice(legado.length + 1);
            if (ID_DE_ANO.test(id)) anos.push(Number(id));
        }
    }
    return ordenados(anos);
}

const CAMPOS_DE_IMPOSTO_COPIADOS = [
    'regimeTributario', 'anexoSimples', 'aliquotaEfetiva', 'simplesNacional', 'iss', 'icms', 'pis', 'cofins',
    'irpj', 'csll', 'inssPatronal', 'fgts', 'ratTerceiros', 'totalEncargosFolha',
] as const;

// Ano novo: copia o cadastro (perfil, produtos sem números, mercado e regime tributário) e deixa o resto no valor inicial.
export function montarPlanoDoAnoSeguinte(
    origem: Partial<DadosDoPlano>, iniciais: DadosDoPlano, anosDeDistancia: number,
): DadosDoPlano {
    const lido: Partial<PlanData> = origem.planData ?? {};
    const taxesLidos: Partial<TaxesData> = origem.taxes ?? {};
    const taxes: TaxesData = { ...iniciais.taxes };
    for (const campo of CAMPOS_DE_IMPOSTO_COPIADOS) {
        if (taxesLidos[campo] !== undefined) (taxes as any)[campo] = taxesLidos[campo];
    }
    // Só com anos seguidos o ano base da origem é o ano anterior ao base do plano novo (mesmo ano civil).
    if (anosDeDistancia === 1 && taxesLidos.totalImpostos2025 !== undefined) {
        taxes.totalImpostos2024 = taxesLidos.totalImpostos2025;
    }
    taxes.totalImpostos2025 = null;

    return {
        planData: {
            ...iniciais.planData,
            companyProfile: { ...iniciais.planData.companyProfile, ...lido.companyProfile },
            productPortfolio: (lido.productPortfolio ?? iniciais.planData.productPortfolio).map(p => ({
                id: p.id, name: p.name, revenue2025: null, cost2025: null, quantitySold2025: null,
            })),
            marketAnalysis: lido.marketAnalysis
                ? { ...iniciais.planData.marketAnalysis, ...lido.marketAnalysis }
                : iniciais.planData.marketAnalysis,
        },
        goals2026: iniciais.goals2026,
        scenarios2026: iniciais.scenarios2026,
        tracking2026: iniciais.tracking2026,
        taxes,
        pricingItems: iniciais.pricingItems,
    };
}

// Se outra aba já criou o ano, nada é sobrescrito (insert que ignora a linha existente). A origem vem do banco, não da tela.
export async function criarPlanoSeNaoExistir(
    cliente: SupabaseClient, uid: string, ano: number, anoOrigem: number, iniciais: DadosDoPlano,
): Promise<void> {
    const origem = (await carregarPlano(cliente, uid, anoOrigem)) ?? {};
    const dados = montarPlanoDoAnoSeguinte(origem, iniciais, ano - anoOrigem);
    const { error } = await cliente
        .from('planos')
        .upsert({ user_id: uid, ano, dados }, { onConflict: 'user_id,ano', ignoreDuplicates: true });
    if (error) throw error;
}
