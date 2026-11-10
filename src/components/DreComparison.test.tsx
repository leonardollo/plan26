import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatCurrency } from '../utils/formatters';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesesIguais = (valor: number) => Object.fromEntries(MESES.map(m => [m, valor]));

const { planoFalso } = vi.hoisted(() => ({ planoFalso: {} as any }));

vi.mock('../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));

import DreComparison from './DreComparison';

const projecao = () => ({
    receitaBruta: mesesIguais(100000), impostosSobreFaturamento: mesesIguais(6000), cmv: mesesIguais(40000),
    folhaPagamento: {}, aluguel: {}, despesasOperacionais: {}, marketingFixo: {}, administrativo: {},
    comissoes: {}, fretes: {}, customCustosFixos: [], customCustosVariaveis: [],
});

// Valor planejado de jan: primeira célula de valor da linha com o rótulo dado.
const planejadoJan = (rotulo: string) => {
    const celulaDoRotulo = screen.getByText(rotulo);
    return celulaDoRotulo.closest('tr')!.querySelectorAll('td')[1].textContent;
};

describe('DreComparison — lucro líquido planejado', () => {
    it('Simples: o lucro líquido planejado de jan é igual ao EBITDA (54 mil), não 85% dele', () => {
        Object.assign(planoFalso, {
            scenarios2026: { Conservador: { growthPercentage: 10, projection: projecao() } },
            tracking2026: {},
            updateTracking2026: vi.fn(),
            baseScenario: 'Conservador',
            taxes: { regimeTributario: 'Simples Nacional', simplesNacional: 6 },
        });
        render(<DreComparison />);
        expect(planejadoJan('(=) EBITDA')).toBe(formatCurrency(54000, true));
        expect(planejadoJan('(=) Lucro Líquido Estimado')).toBe(formatCurrency(54000, true));
    });
});
