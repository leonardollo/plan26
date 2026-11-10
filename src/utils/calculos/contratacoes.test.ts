import { describe, it, expect } from 'vitest';
import { MONTHS } from '../../types';
import { custoContratacoesMensal } from './contratacoes';

describe('custoContratacoesMensal', () => {
    it('2 contratações × 60 mil/ano a partir de julho somam 10 mil de jul a dez', () => {
        const c = custoContratacoesMensal([{ id: '1', department: 'X', currentHeadcount: 0, newHires: 2, avgAnnualCost: 60000, mesEntrada: 'jul' }]);
        expect(c.jun).toBe(0);
        expect(c.jul).toBeCloseTo(10000);
        expect(c.dez).toBeCloseTo(10000);
    });

    it('sem mesEntrada (plano antigo) entra em janeiro', () => {
        const c = custoContratacoesMensal([{ id: '1', department: 'X', currentHeadcount: 0, newHires: 1, avgAnnualCost: 24000 }]);
        MONTHS.forEach(m => expect(c[m]).toBeCloseTo(2000));
    });

    it('newHires ou avgAnnualCost vazio dá 0, sem NaN', () => {
        const c = custoContratacoesMensal([
            { id: '1', department: 'X', currentHeadcount: 0, newHires: null as any, avgAnnualCost: 60000, mesEntrada: 'jan' },
            { id: '2', department: 'Y', currentHeadcount: 0, newHires: 2, avgAnnualCost: NaN, mesEntrada: null },
        ]);
        MONTHS.forEach(m => expect(c[m]).toBe(0));
    });

    it('lista ausente dá 12 meses zerados', () => {
        expect(Object.keys(custoContratacoesMensal(undefined))).toHaveLength(12);
    });

    it('soma vários itens da tabela', () => {
        const c = custoContratacoesMensal([
            { id: '1', department: 'X', currentHeadcount: 0, newHires: 1, avgAnnualCost: 24000, mesEntrada: 'jan' },
            { id: '2', department: 'Y', currentHeadcount: 0, newHires: 2, avgAnnualCost: 60000, mesEntrada: 'jul' },
        ]);
        expect(c.jan).toBeCloseTo(2000);
        expect(c.jul).toBeCloseTo(12000);
    });
});
