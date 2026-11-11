import { describe, it, expect } from 'vitest';
import { MONTHS, MonthlyData, TaxesData, FinancialSheetData } from '../../types';
import {
    aliquotaDeducao, irpjCsllMensal, irpjCsllAnual, lucroLiquidoMensal, aliquotaDoAnoDoPlano, cbsSugerida,
} from './impostos';

const mesesIguais = (valor: number): MonthlyData =>
    MONTHS.reduce((acc, m) => ({ ...acc, [m]: valor }), {} as MonthlyData);

const soma = (dados: MonthlyData) => MONTHS.reduce((s, m) => s + (dados[m] ?? 0), 0);

const simples: Partial<TaxesData> = { regimeTributario: 'Simples Nacional', simplesNacional: 6 };
const presumido: Partial<TaxesData> = {
    regimeTributario: 'Lucro Presumido', iss: 5, pis: 0.65, cofins: 3, irpj: 4.8, csll: 2.88,
};
const real: Partial<TaxesData> = { regimeTributario: 'Lucro Real', pis: 1.65, cofins: 7.6 };

describe('impostos pelo regime', () => {
    it('Simples 6%, receita 100 mil e LAIR 20 mil: dedução 6, IRPJ/CSLL 0, lucro = LAIR', () => {
        expect(aliquotaDeducao(simples)).toBe(6);
        const ir = irpjCsllMensal(simples, mesesIguais(100000), mesesIguais(20000));
        MONTHS.forEach(m => expect(ir[m]).toBe(0));
        expect(lucroLiquidoMensal(simples, mesesIguais(100000), mesesIguais(20000)).jan).toBe(20000);
    });

    it('Presumido: dedução 8,65 e IRPJ/CSLL 7.680 mesmo em mês de prejuízo', () => {
        expect(aliquotaDeducao(presumido)).toBeCloseTo(8.65);
        const ir = irpjCsllMensal(presumido, mesesIguais(100000), mesesIguais(-10000));
        expect(ir.jan).toBeCloseTo(7680);
    });

    it('Presumido com alíquota efetiva 15: dedução 15 e IRPJ/CSLL 0', () => {
        const t = { ...presumido, aliquotaEfetiva: 15 };
        expect(aliquotaDeducao(t)).toBe(15);
        const ir = irpjCsllMensal(t, mesesIguais(100000), mesesIguais(20000));
        MONTHS.forEach(m => expect(ir[m]).toBe(0));
    });

    it('Real com LAIR 50 mil todo mês: 15 mil/mês, ano 180 mil', () => {
        const ir = irpjCsllMensal(real, mesesIguais(200000), mesesIguais(50000));
        MONTHS.forEach(m => expect(ir[m]).toBeCloseTo(15000));
        expect(soma(ir)).toBeCloseTo(180000);
        expect(irpjCsllAnual(real, 0, 600000)).toBeCloseTo(180000);
    });

    it('Real com jan -50 mil e fev-dez somando 650 mil: jan 0, ano 180 mil', () => {
        const lair = mesesIguais(650000 / 11);
        lair.jan = -50000;
        const ir = irpjCsllMensal(real, mesesIguais(200000), lair);
        expect(ir.jan).toBe(0);
        expect(soma(ir)).toBeCloseTo(180000);
    });

    it('Real com jan +100 mil e fev -100 mil: jan 32 mil, fev -32 mil, ano 0', () => {
        const lair = mesesIguais(0);
        lair.jan = 100000;
        lair.fev = -100000;
        const ir = irpjCsllMensal(real, mesesIguais(200000), lair);
        expect(ir.jan).toBeCloseTo(32000);
        expect(ir.fev).toBeCloseTo(-32000);
        expect(soma(ir)).toBeCloseTo(0);
    });

    it('Real com o ano em prejuízo: todo mês 0 e ano 0', () => {
        const ir = irpjCsllMensal(real, mesesIguais(100000), mesesIguais(-10000));
        MONTHS.forEach(m => expect(ir[m]).toBe(0));
        expect(irpjCsllAnual(real, 1200000, -120000)).toBe(0);
    });

    it('Real com alíquota efetiva 12: dedução 12 e IRPJ/CSLL pela regra do Real', () => {
        const t = { ...real, aliquotaEfetiva: 12 };
        expect(aliquotaDeducao(t)).toBe(12);
        const ir = irpjCsllMensal(t, mesesIguais(200000), mesesIguais(50000));
        MONTHS.forEach(m => expect(ir[m]).toBeCloseTo(15000));
    });

    it('taxes vazio, MonthlyData vazio e campos null: tudo 0, nunca NaN', () => {
        expect(aliquotaDeducao({})).toBe(0);
        const vazio = irpjCsllMensal({}, {}, {});
        MONTHS.forEach(m => {
            expect(vazio[m]).toBe(0);
            expect(Number.isNaN(vazio[m])).toBe(false);
        });
        const nulos: Partial<TaxesData> = {
            regimeTributario: 'Lucro Real', aliquotaEfetiva: null, iss: null, icms: null, pis: null, cofins: null,
        };
        expect(aliquotaDeducao(nulos)).toBe(0);
        const lairNulo = mesesIguais(0);
        lairNulo.jan = null;
        const ir = irpjCsllMensal(nulos, {}, lairNulo);
        MONTHS.forEach(m => expect(Number.isNaN(ir[m])).toBe(false));
        const lucro = lucroLiquidoMensal(nulos, {}, {});
        MONTHS.forEach(m => expect(lucro[m]).toBe(0));
        expect(irpjCsllAnual({ ...presumido, irpj: null, csll: null }, NaN, NaN)).toBe(0);
        const presumidoNulo = { ...presumido, iss: null, pis: null, cofins: null, irpj: null, csll: null };
        expect(aliquotaDeducao(presumidoNulo)).toBe(0);
        MONTHS.forEach(m => expect(irpjCsllMensal(presumidoNulo, mesesIguais(100000), {})[m]).toBe(0));
    });

    it('regime undefined e regime vazio: iguais ao Simples', () => {
        const semRegime = { simplesNacional: 6, irpj: 4.8, csll: 2.88 } as Partial<TaxesData>;
        const regimeVazio = { ...semRegime, regimeTributario: '' };
        [semRegime, regimeVazio].forEach(t => {
            expect(aliquotaDeducao(t)).toBe(6);
            const ir = irpjCsllMensal(t, mesesIguais(100000), mesesIguais(20000));
            MONTHS.forEach(m => expect(ir[m]).toBe(0));
            expect(irpjCsllAnual(t, 1200000, 240000)).toBe(0);
        });
    });
});

describe('aliquotaDoAnoDoPlano', () => {
    const baseCom = (R: number, V: number, extra: Partial<FinancialSheetData> = {}): Partial<FinancialSheetData> => ({
        receitaBruta: { values2025: { jan: R } as MonthlyData },
        cmv: { values2025: { jan: V } as MonthlyData },
        ...extra,
    });
    const presumidoCbs: Partial<TaxesData> = { regimeTributario: 'Lucro Presumido', iss: 5, pis: 0.65, cofins: 3 };
    const base = baseCom(1e6, 4e5);

    it('2026 fica igual', () => expect(aliquotaDoAnoDoPlano(presumidoCbs, 2026, base)).toBeCloseTo(8.65));
    it('2027 usa a CBS sugerida', () => expect(aliquotaDoAnoDoPlano(presumidoCbs, 2027, base)).toBeCloseTo(11.78));
    it('CBS digitada substitui', () =>
        expect(aliquotaDoAnoDoPlano({ ...presumidoCbs, cbsEfetiva: 8 }, 2027, base)).toBeCloseTo(13));
    it('CBS 0 usa a sugestão', () =>
        expect(aliquotaDoAnoDoPlano({ ...presumidoCbs, cbsEfetiva: 0 }, 2027, base)).toBeCloseTo(11.78));
    it('alíquota efetiva manda', () =>
        expect(aliquotaDoAnoDoPlano({ ...presumidoCbs, aliquotaEfetiva: 15 }, 2027, base)).toBeCloseTo(15));
    it('Simples fica igual', () =>
        expect(aliquotaDoAnoDoPlano({ regimeTributario: 'Simples Nacional', simplesNacional: 6 }, 2027, base)).toBeCloseTo(6));
    it('Real com ICMS', () =>
        expect(aliquotaDoAnoDoPlano(
            { regimeTributario: 'Lucro Real', icms: 18, iss: 0, pis: 1.65, cofins: 7.6 }, 2027, base,
        )).toBeCloseTo(24.78));
    it('custo maior que a receita', () =>
        expect(aliquotaDoAnoDoPlano(presumidoCbs, 2027, baseCom(1e6, 1.2e6))).toBeCloseTo(5));
    it('base sem receita', () => expect(aliquotaDoAnoDoPlano(presumidoCbs, 2027, baseCom(0, 0))).toBeCloseTo(16.3));
    it('custo negativo', () =>
        expect(aliquotaDoAnoDoPlano(presumidoCbs, 2027, baseCom(1e6, -100000))).toBeCloseTo(16.3));
    it('item variável próprio conta', () => {
        const comItem = baseCom(1e6, 300000, {
            customCustosVariaveis: [{ id: 'x', name: 'Embalagem', values2025: { jan: 100000 } as MonthlyData }],
        });
        expect(aliquotaDoAnoDoPlano(presumidoCbs, 2027, comItem)).toBeCloseTo(11.78);
    });
    it('2029 usa a regra de 2027', () => expect(aliquotaDoAnoDoPlano(presumidoCbs, 2029, base)).toBeCloseTo(11.78));
    it('meses vazios e strings', () => {
        const suja: Partial<FinancialSheetData> = {
            receitaBruta: { values2025: { jan: '1000000' as any, fev: null as any, mar: '' as any } as MonthlyData },
            cmv: { values2025: { jan: 400000 } as MonthlyData },
        };
        expect(aliquotaDoAnoDoPlano(presumidoCbs, 2027, suja)).toBeCloseTo(11.78);
    });
    it('cbsSugerida: 6,78 com 40% de custo variável; 11,3 sem receita', () => {
        expect(cbsSugerida(baseCom(1e6, 4e5))).toBeCloseTo(6.78);
        expect(cbsSugerida(baseCom(0, 0))).toBe(11.3);
    });
});
