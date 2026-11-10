import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { formatCurrency } from '../utils/formatters';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesesIguais = (valor: number) => Object.fromEntries(MESES.map(m => [m, valor]));

const { planoFalso } = vi.hoisted(() => ({ planoFalso: {} as any }));

vi.mock('../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));

import MonthlyTracking from './MonthlyTracking';

const projecaoVazia = () => ({
    receitaBruta: {}, impostosSobreFaturamento: {}, folhaPagamento: {}, aluguel: {}, despesasOperacionais: {},
    marketingFixo: {}, administrativo: {}, customCustosFixos: [], cmv: {}, comissoes: {}, fretes: {}, customCustosVariaveis: [],
});

const comCenario = (cenario: Record<string, unknown>) => Object.assign(planoFalso, {
    tracking2026: {},
    scenarios2026: { Conservador: cenario },
    baseScenario: 'Conservador',
    updateTracking2026: vi.fn(),
    generateMonthlyAnalysis: vi.fn(),
});

const AVISO = 'Dados de cenário não encontrados';

// Sem globals no Vitest, o Testing Library não desmonta sozinho entre os testes.
afterEach(cleanup);

describe('MonthlyTracking — projeção do cenário', () => {
    it('lê a projeção do cenário, mesmo com o receitaProjetada antigo vazio no objeto', () => {
        comCenario({
            growthPercentage: 20,
            receitaProjetada: {},
            projection: { ...projecaoVazia(), receitaBruta: mesesIguais(120000) },
        });
        const { container } = render(<MonthlyTracking />);
        expect(screen.queryByText(AVISO)).toBeNull();
        expect(container.textContent).toContain(formatCurrency(120000));
    });

    it('projeção vazia: mostra o aviso', () => {
        comCenario({ growthPercentage: 20, projection: projecaoVazia() });
        render(<MonthlyTracking />);
        expect(screen.getByText(AVISO)).toBeTruthy();
    });
});
