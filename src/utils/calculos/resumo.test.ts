import { describe, it, expect } from 'vitest';
import { MONTHS, FinancialSheetData, MonthlyData, PlanData, TaxesData } from '../../types';
import { projetarCenario } from './cenario';

// Ano do plano dos testes antigos: 2026, ainda com PIS e COFINS.
const ANO = 2026;
import { calcularPlanoFinanceiro2026 } from './planoFinanceiro';
import { resumoDoCenario } from './resumo';

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
const investimento = {
    financing: { saldoCaixaFinal2025: 0 },
    capex: { totalCapex: 0 },
    workingCapital: { prazoMedioRecebimento: 30, prazoMedioEstocagem: 30, prazoMedioPagamento: 30 },
} as unknown as PlanData['investment'];

describe('resumoDoCenario', () => {
    it('Otimista: receita 120 mil, custos 55.200 (com impostos), despesas 41.800 e EBITDA 23 mil, igual à DRE', () => {
        const projecao = projetarCenario(baseDeExemplo(), 20, 4.5, simples, ANO);
        const resumo = resumoDoCenario(projecao);
        expect(resumo.receita.jan).toBeCloseTo(120000);
        expect(resumo.custos.jan).toBeCloseTo(55200);
        expect(resumo.despesas.jan).toBeCloseTo(41800);
        expect(resumo.ebitda.jan).toBeCloseTo(23000);
        const { dre } = calcularPlanoFinanceiro2026(projecao, simples, investimento);
        expect(resumo.ebitda.jan).toBeCloseTo(dre.ebitda.jan!);
    });

    it('projeção ausente ou vazia: tudo 0 nos 12 meses', () => {
        [resumoDoCenario(undefined), resumoDoCenario({})].forEach(resumo => {
            MONTHS.forEach(m => {
                expect(resumo.receita[m]).toBe(0);
                expect(resumo.custos[m]).toBe(0);
                expect(resumo.despesas[m]).toBe(0);
                expect(resumo.ebitda[m]).toBe(0);
            });
        });
    });
});
