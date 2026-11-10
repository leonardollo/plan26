import { describe, it, expect } from 'vitest';
import { MONTHS, FinancialSheetData, MonthlyData, PlanData, TaxesData } from '../../types';
import { projetarCenario } from './cenario';
import { calcularPlanoFinanceiro2026, despesasFixasDaDre } from './planoFinanceiro';

const mesesIguais = (valor: number): MonthlyData =>
    MONTHS.reduce((acc, m) => ({ ...acc, [m]: valor }), {} as MonthlyData);

const linha = (valor: number) => ({ values2025: mesesIguais(valor) });

const baseDeExemplo = (): FinancialSheetData => ({
    receitaBruta: linha(100000),
    impostosSobreFaturamento: linha(6000),
    folhaPagamento: linha(30000),
    aluguel: linha(10000),
    despesasOperacionais: { values2025: {} },
    marketingFixo: { values2025: {} },
    administrativo: { values2025: {} },
    customCustosFixos: [],
    cmv: linha(40000),
    comissoes: { values2025: {} },
    fretes: { values2025: {} },
    customCustosVariaveis: [],
});

const simples: Partial<TaxesData> = { regimeTributario: 'Simples Nacional', simplesNacional: 6 };
const real: Partial<TaxesData> = { regimeTributario: 'Lucro Real' };
const investimento = {
    financing: { saldoCaixaFinal2025: 0 },
    capex: { totalCapex: 0 },
    workingCapital: { prazoMedioRecebimento: 30, prazoMedioEstocagem: 30, prazoMedioPagamento: 30 },
} as unknown as PlanData['investment'];

// Otimista da Tarefa 2: receita 120 mil, impostos 7.200, CMV 48 mil, aluguel 10.450, folha 31.350.
const otimista = () => projetarCenario(baseDeExemplo(), 20, 4.5, simples);

describe('calcularPlanoFinanceiro2026', () => {
    it('Simples: EBITDA 23 mil, IRPJ/CSLL 0 e lucro líquido igual ao EBITDA', () => {
        const { dre } = calcularPlanoFinanceiro2026(otimista(), simples, investimento);
        expect(dre.ebitda.jan).toBeCloseTo(23000);
        expect(dre.irpjCsll.jan).toBe(0);
        expect(dre.lucroLiquido.jan).toBeCloseTo(23000);
    });

    it('Real: IRPJ/CSLL de jan = 0,24 × 23 mil + 0,10 × 3 mil e o FCO desconta o imposto', () => {
        const { dre, dfc } = calcularPlanoFinanceiro2026(otimista(), real, investimento);
        expect(dre.irpjCsll.jan).toBeCloseTo(5820);
        expect(dfc.fco.jan).toBeCloseTo(23000 - 5820);
    });

    it('projeção incompleta (plano antigo) não gera NaN', () => {
        const { dre, dfc, bp } = calcularPlanoFinanceiro2026({ receitaBruta: { jan: 1000 } } as any, {}, {} as any);
        MONTHS.forEach(m => {
            expect(Number.isNaN(dre.lucroLiquido[m])).toBe(false);
            expect(Number.isNaN(dfc.saldoFinalCaixa[m])).toBe(false);
            expect(Number.isNaN(bp.totalPassivoPL[m])).toBe(false);
        });
    });
});

describe('despesasFixasDaDre', () => {
    it('soma folha, marketing, operacionais (com aluguel) e outras despesas fixas', () => {
        const { dre } = calcularPlanoFinanceiro2026(otimista(), simples, investimento);
        expect(despesasFixasDaDre(dre).jan).toBeCloseTo(41800);
    });
});
