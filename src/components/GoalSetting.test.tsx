import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const { planoFalso } = vi.hoisted(() => ({ planoFalso: {} as any }));

vi.mock('../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));

import GoalSetting from './GoalSetting';

Object.assign(planoFalso, {
    anoPlano: 2027,
    anoBase: 2026,
    goals2026: {
        financeiras: { metaReceita: {} },
        comerciais: { metaNumClientes: {} },
        pessoas: {},
        objetivosEstrategicos: {},
    },
    summary2025: { receitaTotal: 0, margemEbitda: 0, novosClientesTotal: 0, ticketMedio: 0, turnoverPercent: 0, headcountFinal: 0 },
    generateGoalSuggestions: vi.fn(),
    updateGoal: vi.fn(),
    updateObjective: vi.fn(),
    updateInflation: vi.fn(),
});

// Sem globals no Vitest, o Testing Library não desmonta sozinho entre os testes.
afterEach(cleanup);

describe('GoalSetting — anos do plano aberto', () => {
    it('no plano 2027, as metas são de 2027, o diagnóstico de 2026, e nada cita 2025', () => {
        const { container } = render(<GoalSetting />);
        expect(container.textContent).toMatch(/Metas & Objetivos para 2027/);
        expect(container.textContent).toMatch(/Diagnóstico Rápido 2026/);
        expect(container.textContent).not.toMatch(/2025/);
    });
});
