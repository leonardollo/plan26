import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const { planoFalso } = vi.hoisted(() => ({ planoFalso: {} as any }));

vi.mock('../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));

import DataCollection from './DataCollection';

const LINHAS = [
    'receitaBruta', 'impostosSobreFaturamento', 'folhaPagamento', 'aluguel', 'despesasOperacionais',
    'marketingFixo', 'administrativo', 'cmv', 'comissoes', 'fretes',
];

Object.assign(planoFalso, {
    anoPlano: 2027,
    anoBase: 2026,
    planData: {
        financialSheet: {
            ...Object.fromEntries(LINHAS.map(l => [l, { values2025: {} }])),
            customCustosFixos: [],
            customCustosVariaveis: [],
        },
        commercial: { clientes: { totalClientesAtivos: {} } },
    },
    summary2025: {
        monthlySummary: [], receitaTotal: 0, custosVariaveisTotal: 0, margemBruta: 0,
        despesasTotal: 0, ebitda: 0, margemEbitda: 0, ticketMedio: 0,
    },
    taxes: {},
});

// Sem globals no Vitest, o Testing Library não desmonta sozinho entre os testes.
afterEach(cleanup);

describe('DataCollection — anos do plano aberto', () => {
    it('no plano 2027, a coleta é de 2026 e não cita 2025', () => {
        const { container } = render(<DataCollection />);
        expect(container.textContent).toMatch(/2026/);
        expect(container.textContent).not.toMatch(/2025/);
    });
});
