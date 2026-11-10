import { describe, it, expect } from 'vitest';
import {
    MONTHS, FinancialSheetData, InvestmentData2026, MonthlyData, PlanData, ScenarioProjectionData, TaxesData,
} from '../../types';
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

const bloco = (o: Partial<InvestmentData2026> = {}): InvestmentData2026 =>
    ({ investimentos: [], emprestimos: [], aportes: [], jurosDividaAtualPct: null, ...o });
const comFinanciamento = (curto: number, longo: number, caixa = 0) =>
    ({ ...investimento, financing: { saldoCaixaFinal2025: caixa, financiamentoCurtoPrazo: curto, financiamentoLongoPrazo: longo } } as unknown as PlanData['investment']);
const emprestimo100mil = { id: 'e1', descricao: 'Banco', valor: 100000, mes: 'jan' as const, jurosMensalPct: 2, parcelas: 24 };

describe('calcularPlanoFinanceiro2026 com o bloco de 2026', () => {
    it('FCI não usa mais o CAPEX de 2025', () => {
        const comCapex = { ...investimento, capex: { totalCapex: 120000 } } as unknown as PlanData['investment'];
        const { dfc } = calcularPlanoFinanceiro2026(otimista(), simples, comCapex);
        MONTHS.forEach(m => expect(dfc.fci[m]).toBe(0));
    });

    it('investimento: FCI, depreciação na DRE e ativo não circulante', () => {
        const { dre, dfc, bp } = calcularPlanoFinanceiro2026(otimista(), simples, investimento, bloco({
            investimentos: [{ id: 'i1', descricao: 'Máquina', valor: 120000, mes: 'mar', vidaUtilAnos: 5 }],
        }));
        expect(dfc.fci.mar).toBe(-120000);
        expect(dre.depreciacao.abr).toBeCloseTo(2000);
        expect(dre.ebit.abr).toBeCloseTo(dre.ebitda.abr! - 2000);
        expect(bp.ativoNaoCirculante.dez).toBeCloseTo(102000);
    });

    it('empréstimo novo: entrada e parcela no FCF, juros na DRE, dívida no Balanço', () => {
        const sem = calcularPlanoFinanceiro2026(otimista(), simples, investimento);
        const { dre, dfc, bp } = calcularPlanoFinanceiro2026(otimista(), simples, investimento, bloco({ emprestimos: [emprestimo100mil] }));
        expect(dfc.fcf.jan).toBeCloseTo(100000);
        expect(dfc.fcf.fev).toBeCloseTo(-5287.11, 2);
        expect(dre.despesasFinanceiras.fev).toBeCloseTo(2000, 2);
        expect(dfc.fco.fev).toBeCloseTo(sem.dfc.fco.fev!);
        expect(bp.passivoCirculante.dez).toBeCloseTo(bp.fornecedores.dez! + bp.emprestimosCurtoPrazo.dez!);
        expect(bp.emprestimosLongoPrazo.dez).toBeGreaterThan(0);
        expect(bp.passivoNaoCirculante.dez).toBeCloseTo(bp.emprestimosLongoPrazo.dez!);
    });

    it('dívida atual: amortização e juros no FCF, juros na DRE, LP parado', () => {
        const { dre, dfc, bp } = calcularPlanoFinanceiro2026(otimista(), simples, comFinanciamento(120000, 240000), bloco({ jurosDividaAtualPct: 1 }));
        expect(dfc.fcf.jan).toBeCloseTo(-13600);
        expect(dfc.fcf.fev).toBeCloseTo(-13500);
        expect(dre.despesasFinanceiras.jan).toBeCloseTo(3600);
        expect(bp.emprestimosCurtoPrazo.dez).toBeCloseTo(0);
        MONTHS.forEach(m => expect(bp.emprestimosLongoPrazo[m]).toBe(240000));
    });

    it('aporte entra no FCF e não mexe na DRE', () => {
        const sem = calcularPlanoFinanceiro2026(otimista(), simples, investimento);
        const { dre, dfc } = calcularPlanoFinanceiro2026(otimista(), simples, investimento, bloco({
            aportes: [{ id: 'a1', descricao: 'Sócio', valor: 50000, mes: 'mai' }],
        }));
        expect(dfc.fcf.mai).toBe(50000);
        expect(dre.lucroLiquido).toEqual(sem.dre.lucroLiquido);
    });

    it('Lucro Real: depreciação e juros reduzem o IRPJ/CSLL', () => {
        const proj = { receitaBruta: mesesIguais(100000), cmv: mesesIguais(50000) } as unknown as ScenarioProjectionData;
        const regimeReal: Partial<TaxesData> = { regimeTributario: 'Lucro Real' };
        const b = bloco({
            // Vida útil de 1 mês: R$ 2 mil de depreciação só em fevereiro.
            investimentos: [{ id: 'i1', descricao: 'X', valor: 2000, mes: 'jan', vidaUtilAnos: 1 / 12 }],
            // Uma parcela em fevereiro: R$ 2 mil de juros só em fevereiro.
            emprestimos: [{ ...emprestimo100mil, parcelas: 1 }],
        });
        const { dre } = calcularPlanoFinanceiro2026(proj, regimeReal, investimento, b);
        expect(dre.ebitda.jan).toBeCloseTo(50000);
        expect(dre.irpjCsll.jan).toBeCloseTo(15000);
        expect(dre.irpjCsll.fev).toBeCloseTo(13640);
        const controle = calcularPlanoFinanceiro2026(proj, regimeReal, investimento);
        expect(controle.dre.irpjCsll.fev).toBeCloseTo(15000);
    });

    it('Presumido: IRPJ/CSLL igual com e sem investimento e empréstimo', () => {
        const presumido: Partial<TaxesData> = { regimeTributario: 'Lucro Presumido', irpj: 4.8, csll: 2.88 };
        const sem = calcularPlanoFinanceiro2026(otimista(), presumido, investimento);
        const com = calcularPlanoFinanceiro2026(otimista(), presumido, investimento, bloco({
            investimentos: [{ id: 'i1', descricao: 'X', valor: 120000, mes: 'mar', vidaUtilAnos: 5 }],
            emprestimos: [emprestimo100mil],
        }));
        expect(sem.dre.irpjCsll.jan).toBeGreaterThan(0);
        expect(com.dre.irpjCsll).toEqual(sem.dre.irpjCsll);
    });

    it('todos os blocos juntos: Balanço fecha e caixa bate com a DFC', () => {
        const { dfc, bp } = calcularPlanoFinanceiro2026(otimista(), real, comFinanciamento(120000, 240000, 30000), bloco({
            investimentos: [{ id: 'i1', descricao: 'X', valor: 120000, mes: 'mar', vidaUtilAnos: 5 }],
            emprestimos: [emprestimo100mil],
            aportes: [{ id: 'a1', descricao: 'Sócio', valor: 50000, mes: 'mai' }],
            jurosDividaAtualPct: 1,
        }));
        MONTHS.forEach(m => expect(bp.totalAtivos[m]).toBeCloseTo(bp.totalPassivoPL[m]!));
        const somaFluxos = MONTHS.reduce((s, m) => s + dfc.fco[m]! + dfc.fci[m]! + dfc.fcf[m]!, 0);
        expect(bp.caixa.dez).toBeCloseTo(30000 + somaFluxos);
        expect(bp.passivoNaoCirculante.dez).toBeGreaterThan(240000);
    });

    it('campos apagados (null) não geram NaN', () => {
        const { dre, dfc, bp } = calcularPlanoFinanceiro2026(otimista(), real, comFinanciamento(120000, 240000), {
            investimentos: [{ id: 'i1', descricao: '', valor: null, mes: null, vidaUtilAnos: null }],
            emprestimos: [{ id: 'e1', descricao: '', valor: null, mes: null, jurosMensalPct: null, parcelas: null }],
            aportes: [{ id: 'a1', descricao: '', valor: null, mes: null }],
            jurosDividaAtualPct: null,
        });
        [dre, dfc, bp].forEach(demo => Object.values(demo).forEach(linha =>
            MONTHS.forEach(m => expect(Number.isNaN((linha as MonthlyData)[m])).toBe(false))));
    });
});

describe('despesasFixasDaDre', () => {
    it('soma folha, marketing, operacionais (com aluguel) e outras despesas fixas', () => {
        const { dre } = calcularPlanoFinanceiro2026(otimista(), simples, investimento);
        expect(despesasFixasDaDre(dre).jan).toBeCloseTo(41800);
    });
});
