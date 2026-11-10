import { describe, it, expect } from 'vitest';
import { TaxesData } from '../../types';
import { nopat, paybackCacMeses } from './indicadores';

const simples: Partial<TaxesData> = { regimeTributario: 'Simples Nacional', simplesNacional: 6 };
const real: Partial<TaxesData> = { regimeTributario: 'Lucro Real' };

describe('nopat', () => {
    it('Simples: EBITDA 600 mil continua 600 mil (o DAS já inclui o IR)', () => {
        expect(nopat(simples, 1200000, 600000)).toBeCloseTo(600000);
    });

    it('Real: EBITDA 600 mil dá 420 mil (e não 456 mil do × 0,76)', () => {
        expect(nopat(real, 1200000, 600000)).toBeCloseTo(420000);
    });
});

describe('paybackCacMeses', () => {
    it('CAC 1.200, ticket mensal 1.000 e margem 40%: 3 meses', () => {
        expect(paybackCacMeses(1200, 1000, 40)).toBeCloseTo(3);
    });

    it('ticket 0: 0, sem divisão por zero', () => {
        expect(paybackCacMeses(1200, 0, 40)).toBe(0);
    });
});
