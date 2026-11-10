import { describe, it, expect } from 'vitest';
import { MONTHS, FinancialSheetData, MonthlyData, TaxesData } from '../../types';
import { projetarCenario } from './cenario';

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
        const p = projetarCenario(baseDeExemplo(), 20, 4.5, simples);
        MONTHS.forEach(m => {
            expect(p.receitaBruta[m]).toBeCloseTo(120000);
            expect(p.cmv[m]).toBeCloseTo(48000);
            expect(p.aluguel[m]).toBeCloseTo(10450);
            expect(p.folhaPagamento[m]).toBeCloseTo(31350);
            expect(p.impostosSobreFaturamento[m]).toBeCloseTo(7200);
        });
    });

    it('Disruptivo -5%: receita 95 mil, CMV 38 mil, aluguel 10.450, impostos 5.700', () => {
        const p = projetarCenario(baseDeExemplo(), -5, 4.5, simples);
        expect(p.receitaBruta.jan).toBeCloseTo(95000);
        expect(p.cmv.jan).toBeCloseTo(38000);
        expect(p.aluguel.jan).toBeCloseTo(10450);
        expect(p.impostosSobreFaturamento.jan).toBeCloseTo(5700);
    });

    it('inflação 0: aluguel e folha iguais a 2025', () => {
        const p = projetarCenario(baseDeExemplo(), 20, 0, simples);
        expect(p.aluguel.jan).toBe(10000);
        expect(p.folhaPagamento.jan).toBe(30000);
    });

    it('inflação NaN: fixos iguais a 2025, sem NaN', () => {
        const p = projetarCenario(baseDeExemplo(), 20, NaN, simples);
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
        const p = projetarCenario(base, 20, 4.5, simples);
        expect(p.customCustosFixos[0]).toMatchObject({ id: 'f1', name: 'Software' });
        expect(p.customCustosFixos[0].values.jan).toBeCloseTo(2090);
        expect(p.customCustosVariaveis[0]).toMatchObject({ id: 'v1', name: 'Embalagem' });
        expect(p.customCustosVariaveis[0].values.jan).toBeCloseTo(1200);
    });

    it('crescimento 27 (20 + score 5 + bônus 2): receita 127 mil, aluguel continua 10.450', () => {
        const p = projetarCenario(baseDeExemplo(), 27, 4.5, simples);
        expect(p.receitaBruta.jan).toBeCloseTo(127000);
        expect(p.aluguel.jan).toBeCloseTo(10450);
    });
});
