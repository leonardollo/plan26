import { describe, it, expect } from 'vitest';
import { MONTHS, Aporte2026, Emprestimo2026, Investimento2026 } from '../../types';
import {
    aportes2026, dividaAtual, emprestimosNovos, investimento2026Vazio, investimentos2026,
    normalizarInvestimento2026, parcelaPrice,
} from './investimentos';

const inv = (o: Partial<Investimento2026> = {}): Investimento2026 =>
    ({ id: 'i1', descricao: 'Máquina', valor: null, mes: 'jan', vidaUtilAnos: null, ...o });
const emp = (o: Partial<Emprestimo2026> = {}): Emprestimo2026 =>
    ({ id: 'e1', descricao: 'Banco', valor: null, mes: 'jan', jurosMensalPct: null, parcelas: null, ...o });
const aporte = (o: Partial<Aporte2026> = {}): Aporte2026 =>
    ({ id: 'a1', descricao: 'Sócio', valor: null, mes: 'jan', ...o });

const soma = (d: Record<string, number | null | undefined>) => MONTHS.reduce((s, m) => s + (d[m] ?? 0), 0);
const semNaN = (obj: Record<string, Record<string, number | null | undefined>>) =>
    Object.values(obj).forEach(linha => MONTHS.forEach(m => expect(Number.isNaN(linha[m])).toBe(false)));

describe('investimentos2026', () => {
    it('120 mil em março, 5 anos', () => {
        const r = investimentos2026([inv({ valor: 120000, mes: 'mar', vidaUtilAnos: 5 })]);
        expect(r.fci.mar).toBe(-120000); expect(r.fci.fev).toBe(0);
        expect(r.depreciacao.mar).toBe(0); expect(r.depreciacao.abr).toBeCloseTo(2000);
        expect(soma(r.depreciacao)).toBeCloseTo(18000);
        expect(r.ativoNaoCirculante.fev).toBe(0); expect(r.ativoNaoCirculante.mar).toBe(120000);
        expect(r.ativoNaoCirculante.dez).toBeCloseTo(102000);
    });

    it('12 mil em dezembro: sem depreciação em 2026', () => {
        const r = investimentos2026([inv({ valor: 12000, mes: 'dez', vidaUtilAnos: 5 })]);
        expect(r.fci.dez).toBe(-12000);
        expect(soma(r.depreciacao)).toBe(0);
        expect(r.ativoNaoCirculante.dez).toBe(12000);
    });

    it('12 mil em janeiro, vida 0,5 ano: 2 mil de fev a jul, depois 0', () => {
        const r = investimentos2026([inv({ valor: 12000, mes: 'jan', vidaUtilAnos: 0.5 })]);
        expect(r.depreciacao.jan).toBe(0);
        expect(r.depreciacao.fev).toBeCloseTo(2000);
        expect(r.depreciacao.jul).toBeCloseTo(2000);
        expect(r.depreciacao.ago).toBe(0);
        expect(r.depreciacao.dez).toBe(0);
        expect(r.ativoNaoCirculante.jul).toBeCloseTo(0);
        expect(r.ativoNaoCirculante.dez).toBeCloseTo(0);
    });

    it('vida útil vazia ou ≤ 0 vale 5 anos', () => {
        [null, 0, -2].forEach(vida => {
            const r = investimentos2026([inv({ valor: 120000, mes: 'jan', vidaUtilAnos: vida })]);
            expect(r.depreciacao.fev).toBeCloseTo(2000);
        });
    });

    it('valor vazio ou ≤ 0 e mês vazio', () => {
        const vazio = investimentos2026([inv({ valor: null }), inv({ valor: -5 }), inv({ valor: NaN })]);
        semNaN(vazio);
        MONTHS.forEach(m => {
            expect(vazio.fci[m]).toBe(0);
            expect(vazio.depreciacao[m]).toBe(0);
            expect(vazio.ativoNaoCirculante[m]).toBe(0);
        });
        const semMes = investimentos2026([inv({ valor: 12000, mes: null })]);
        expect(semMes.fci.jan).toBe(-12000);
    });

    it('lista ausente dá 12 meses zerados', () => {
        const r = investimentos2026(undefined);
        expect(Object.keys(r.fci)).toHaveLength(12);
        expect(soma(r.ativoNaoCirculante)).toBe(0);
    });
});

describe('parcelaPrice', () => {
    it('100 mil, 2%, 24× ≈ 5.287,11; juros 0 → P ÷ n; parcelas < 1 → 0', () => {
        expect(parcelaPrice(100000, 2, 24)).toBeCloseTo(5287.11, 2);
        expect(parcelaPrice(12000, 0, 12)).toBe(1000);
        expect(parcelaPrice(12000, null, 12)).toBe(1000);
        expect(parcelaPrice(12000, 2, 0.5)).toBe(0);
        expect(parcelaPrice(12000, 2, null)).toBe(0);
        expect(parcelaPrice(null, 2, 12)).toBe(0);
        expect(parcelaPrice(12000, 0, 12.9)).toBe(1000);
    });
});

describe('emprestimosNovos', () => {
    it('100 mil em jan, 2% a.m., 24×', () => {
        const r = emprestimosNovos([emp({ valor: 100000, mes: 'jan', jurosMensalPct: 2, parcelas: 24 })]);
        expect(r.entradas.jan).toBe(100000);
        expect(r.parcelas.jan).toBe(0); expect(r.parcelas.fev).toBeCloseTo(5287.11, 2); expect(r.parcelas.dez).toBeCloseTo(5287.11, 2);
        expect(r.juros.jan).toBe(0);
        expect(r.juros.fev).toBeCloseTo(2000, 2); expect(r.juros.mar).toBeCloseTo(1934.26, 2);
        expect(r.curtoPrazo.jan + r.longoPrazo.jan).toBeCloseTo(100000, 2);
        expect(r.curtoPrazo.fev + r.longoPrazo.fev).toBeCloseTo(96712.89, 2);
    });

    it('Balanço de dezembro: curto = amortização das 12 parcelas de 2027; curto + longo = saldo', () => {
        const r = emprestimosNovos([emp({ valor: 100000, mes: 'jan', jurosMensalPct: 2, parcelas: 24 })]);
        // Tabela Price no próprio teste: 24 parcelas, a 1ª em fev/26.
        const i = 0.02;
        const pmt = 100000 * i / (1 - Math.pow(1 + i, -24));
        let saldo = 100000;
        const amortizacoes: number[] = [];
        for (let k = 1; k <= 24; k++) {
            const a = pmt - saldo * i;
            amortizacoes.push(a);
            saldo -= a;
        }
        // Até dez/26 foram pagas 11 parcelas (fev a dez).
        const saldoDez = 100000 - amortizacoes.slice(0, 11).reduce((s, a) => s + a, 0);
        const curtoEsperado = amortizacoes.slice(11, 23).reduce((s, a) => s + a, 0);
        expect(r.curtoPrazo.dez + r.longoPrazo.dez).toBeCloseTo(saldoDez, 2);
        expect(r.curtoPrazo.dez).toBeCloseTo(curtoEsperado, 2);
        expect(r.longoPrazo.dez).toBeCloseTo(amortizacoes[23], 2);
    });

    it('12 mil, juros 0, 12× em jan: 1 mil de fev a dez e 1 mil no curto prazo em dez', () => {
        const r = emprestimosNovos([emp({ valor: 12000, mes: 'jan', jurosMensalPct: 0, parcelas: 12 })]);
        expect(r.parcelas.jan).toBe(0);
        MONTHS.slice(1).forEach(m => expect(r.parcelas[m]).toBeCloseTo(1000));
        expect(soma(r.juros)).toBe(0);
        expect(r.curtoPrazo.dez).toBeCloseTo(1000);
        expect(r.longoPrazo.dez).toBeCloseTo(0);
    });

    it('empréstimo em dezembro: só a entrada; saldo inteiro no Balanço', () => {
        const r = emprestimosNovos([emp({ valor: 100000, mes: 'dez', jurosMensalPct: 2, parcelas: 24 })]);
        expect(r.entradas.dez).toBe(100000);
        expect(soma(r.parcelas)).toBe(0);
        expect(soma(r.juros)).toBe(0);
        expect(r.curtoPrazo.nov + r.longoPrazo.nov).toBe(0);
        expect(r.curtoPrazo.dez + r.longoPrazo.dez).toBeCloseTo(100000, 2);
    });

    it('sem nº de parcelas, parcelas 0,5 ou valor vazio: linha ignorada, sem NaN', () => {
        const r = emprestimosNovos([
            emp({ valor: 100000, jurosMensalPct: 2, parcelas: null }),
            emp({ valor: 100000, jurosMensalPct: 2, parcelas: 0.5 }),
            emp({ valor: null, jurosMensalPct: 2, parcelas: 12 }),
            emp({ valor: NaN, jurosMensalPct: null, parcelas: NaN, mes: null }),
        ]);
        semNaN(r);
        MONTHS.forEach(m => {
            expect(r.entradas[m]).toBe(0);
            expect(r.parcelas[m]).toBe(0);
            expect(r.curtoPrazo[m] + r.longoPrazo[m]).toBe(0);
        });
    });

    it('nº de parcelas fracionado arredonda para baixo', () => {
        const a = emprestimosNovos([emp({ valor: 12000, jurosMensalPct: 0, parcelas: 12.9 })]);
        expect(a.parcelas.fev).toBeCloseTo(1000);
    });

    it('última parcela zera o saldo', () => {
        // 12 mil, 2%, 6× em jan: as 6 parcelas (fev a jul) pagam tudo; de jul em diante o saldo é 0 exato.
        const r = emprestimosNovos([emp({ valor: 12000, jurosMensalPct: 2, parcelas: 6 })]);
        expect(r.curtoPrazo.jul).toBe(0);
        expect(r.longoPrazo.jul).toBe(0);
        expect(r.curtoPrazo.dez + r.longoPrazo.dez).toBe(0);
        expect(r.parcelas.ago).toBe(0);
    });

    it('mês vazio vale janeiro e juros negativos contam como 0', () => {
        const r = emprestimosNovos([emp({ valor: 12000, mes: null, jurosMensalPct: -3, parcelas: 12 })]);
        expect(r.entradas.jan).toBe(12000);
        expect(r.parcelas.fev).toBeCloseTo(1000);
        expect(soma(r.juros)).toBe(0);
    });

    it('nº de parcelas enorme (100.000.000×) dá resultado finito e rápido', () => {
        const inicio = performance.now();
        const r = emprestimosNovos([emp({ valor: 100000, mes: 'jan', jurosMensalPct: 2, parcelas: 100000000 })]);
        expect(performance.now() - inicio).toBeLessThan(100);
        Object.values(r).forEach(linha => MONTHS.forEach(m => expect(Number.isFinite(linha[m])).toBe(true)));
        // Com prazo quase infinito a parcela é só juros (2 mil) e o saldo fica em 100 mil.
        expect(r.parcelas.fev).toBeCloseTo(2000);
        expect(r.juros.fev).toBeCloseTo(2000);
        expect(r.curtoPrazo.dez! + r.longoPrazo.dez!).toBeCloseTo(100000);
    });
});

describe('dividaAtual', () => {
    it('curto 120 mil, longo 240 mil, juros 1%', () => {
        const r = dividaAtual({ financiamentoCurtoPrazo: 120000, financiamentoLongoPrazo: 240000 }, 1);
        expect(r.amortizacao.jan).toBeCloseTo(10000); expect(r.juros.jan).toBeCloseTo(3600); expect(r.juros.fev).toBeCloseTo(3500);
        expect(r.curtoPrazo.jan).toBeCloseTo(110000);
        expect(r.curtoPrazo.dez).toBeCloseTo(0); MONTHS.forEach(m => expect(r.longoPrazo[m]).toBe(240000));
    });

    it('juros vazio: só amortizações, juros 0', () => {
        const r = dividaAtual({ financiamentoCurtoPrazo: 120000, financiamentoLongoPrazo: 240000 }, null);
        MONTHS.forEach(m => {
            expect(r.amortizacao[m]).toBeCloseTo(10000);
            expect(r.juros[m]).toBe(0);
        });
    });

    it('financing ausente: tudo 0', () => {
        const r = dividaAtual(undefined, undefined);
        semNaN(r);
        MONTHS.forEach(m => {
            expect(r.amortizacao[m]).toBe(0);
            expect(r.juros[m]).toBe(0);
            expect(r.curtoPrazo[m]).toBe(0);
            expect(r.longoPrazo[m]).toBe(0);
        });
    });
});

describe('aportes2026 e normalização', () => {
    it('aporte de 50 mil em maio', () => {
        const r = aportes2026([aporte({ valor: 50000, mes: 'mai' }), aporte({ valor: null, mes: 'jun' })]);
        expect(r.mai).toBe(50000);
        MONTHS.filter(m => m !== 'mai').forEach(m => expect(r[m]).toBe(0));
    });

    it('normalizar: undefined dá o vazio; bloco parcial é completado', () => {
        expect(investimento2026Vazio()).toEqual({ investimentos: [], emprestimos: [], aportes: [], jurosDividaAtualPct: null });
        expect(normalizarInvestimento2026(undefined)).toEqual(investimento2026Vazio());
        const x = emp({ valor: 100000 });
        expect(normalizarInvestimento2026({ emprestimos: [x] }))
            .toEqual({ investimentos: [], emprestimos: [x], aportes: [], jurosDividaAtualPct: null });
        expect(normalizarInvestimento2026({ investimentos: 'lixo', jurosDividaAtualPct: 1.5 }))
            .toEqual({ investimentos: [], emprestimos: [], aportes: [], jurosDividaAtualPct: 1.5 });
    });
});
