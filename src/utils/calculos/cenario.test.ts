import { describe, it, expect } from 'vitest';
import { MONTHS, FinancialSheetData, MonthlyData, TaxesData } from '../../types';
import { projetarCenario } from './cenario';

// Ano do plano dos testes antigos: 2026, ainda com PIS e COFINS.
const ANO = 2026;

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

describe('projetarCenario', () => {
    it('Otimista 20%, inflação 4,5: variáveis pelo crescimento, fixos pela inflação, impostos pela alíquota', () => {
        const p = projetarCenario(baseDeExemplo(), 20, 4.5, simples, ANO);
        MONTHS.forEach(m => {
            expect(p.receitaBruta[m]).toBeCloseTo(120000);
            expect(p.cmv[m]).toBeCloseTo(48000);
            expect(p.aluguel[m]).toBeCloseTo(10450);
            expect(p.folhaPagamento[m]).toBeCloseTo(31350);
            expect(p.impostosSobreFaturamento[m]).toBeCloseTo(7200);
        });
    });

    it('Disruptivo -5%: receita 95 mil, CMV 38 mil, aluguel 10.450, impostos 5.700', () => {
        const p = projetarCenario(baseDeExemplo(), -5, 4.5, simples, ANO);
        expect(p.receitaBruta.jan).toBeCloseTo(95000);
        expect(p.cmv.jan).toBeCloseTo(38000);
        expect(p.aluguel.jan).toBeCloseTo(10450);
        expect(p.impostosSobreFaturamento.jan).toBeCloseTo(5700);
    });

    it('inflação 0: aluguel e folha iguais a 2025', () => {
        const p = projetarCenario(baseDeExemplo(), 20, 0, simples, ANO);
        expect(p.aluguel.jan).toBe(10000);
        expect(p.folhaPagamento.jan).toBe(30000);
    });

    it('inflação NaN: fixos iguais a 2025, sem NaN', () => {
        const p = projetarCenario(baseDeExemplo(), 20, NaN, simples, ANO);
        expect(p.aluguel.jan).toBe(10000);
        expect(p.folhaPagamento.jan).toBe(30000);
        MONTHS.forEach(m => {
            expect(Number.isNaN(p.aluguel[m])).toBe(false);
            expect(Number.isNaN(p.despesasOperacionais[m])).toBe(false);
        });
    });

    it('itens personalizados: fixo pela inflação, variável pelo crescimento, com id, nome e values', () => {
        const base = baseDeExemplo();
        base.customCustosFixos = [{ id: 'f1', name: 'Software', hint: 'dica', values2025: mesesIguais(2000) }];
        base.customCustosVariaveis = [{ id: 'v1', name: 'Embalagem', values2025: mesesIguais(1000) }];
        const p = projetarCenario(base, 20, 4.5, simples, ANO);
        expect(p.customCustosFixos[0]).toMatchObject({ id: 'f1', name: 'Software' });
        expect(p.customCustosFixos[0].values.jan).toBeCloseTo(2090);
        expect(p.customCustosVariaveis[0]).toMatchObject({ id: 'v1', name: 'Embalagem' });
        expect(p.customCustosVariaveis[0].values.jan).toBeCloseTo(1200);
    });

    it('contratações somam na folha depois da inflação', () => {
        const custo = MONTHS.reduce((acc, m, i) => ({ ...acc, [m]: i >= 6 ? 10000 : 0 }), {} as MonthlyData);
        const com = projetarCenario(baseDeExemplo(), 0, 10, simples, ANO, custo);
        const sem = projetarCenario(baseDeExemplo(), 0, 10, simples, ANO);
        expect(com.folhaPagamento.jul).toBeCloseTo(sem.folhaPagamento.jul! + 10000);
        expect(com.folhaPagamento.jun).toBe(sem.folhaPagamento.jun);
    });

    it('sem o 5º parâmetro a projeção não muda', () => {
        const zero = MONTHS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {} as MonthlyData);
        expect(projetarCenario(baseDeExemplo(), 20, 4.5, simples, ANO)).toEqual(projetarCenario(baseDeExemplo(), 20, 4.5, simples, ANO, zero));
        expect(projetarCenario(baseDeExemplo(), 20, 4.5, simples, ANO).folhaPagamento.jan).toBeCloseTo(31350);
    });

    it('crescimento 27 (20 + score 5 + bônus 2): receita 127 mil, aluguel continua 10.450', () => {
        const p = projetarCenario(baseDeExemplo(), 27, 4.5, simples, ANO);
        expect(p.receitaBruta.jan).toBeCloseTo(127000);
        expect(p.aluguel.jan).toBeCloseTo(10450);
    });
});

describe('projetarCenario — imposto do ano do plano', () => {
    const vazia = { values2025: {} as MonthlyData };
    const base: FinancialSheetData = {
        receitaBruta: { values2025: { jan: 100000, fev: 900000 } as MonthlyData },
        impostosSobreFaturamento: vazia, folhaPagamento: vazia, aluguel: vazia, despesasOperacionais: vazia,
        marketingFixo: vazia, administrativo: vazia, customCustosFixos: [],
        cmv: { values2025: { jan: 400000 } as MonthlyData },
        comissoes: vazia, fretes: vazia, customCustosVariaveis: [],
    };
    const presumido: Partial<TaxesData> = { regimeTributario: 'Lucro Presumido', iss: 5, pis: 0.65, cofins: 3 };

    it('plano 2027: ISS 5 + CBS sugerida 6,78 sobre 100 mil = 11.780', () =>
        expect(projetarCenario(base, 0, 0, presumido, 2027).impostosSobreFaturamento.jan).toBeCloseTo(11780));
    it('plano 2026: continua com PIS e COFINS (8.650)', () =>
        expect(projetarCenario(base, 0, 0, presumido, 2026).impostosSobreFaturamento.jan).toBeCloseTo(8650));
});
