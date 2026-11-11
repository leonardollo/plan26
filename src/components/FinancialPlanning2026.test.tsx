import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { planoFalso } = vi.hoisted(() => ({ planoFalso: {} as any }));

vi.mock('../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));
// A aba de investimentos tem teste próprio; aqui só importam os rótulos do ano.
vi.mock('./InvestimentosFinanciamentos2026', () => ({ default: () => null }));

import FinancialPlanning2026 from './FinancialPlanning2026';

Object.assign(planoFalso, {
    anoPlano: 2027,
    anoBase: 2026,
    planData: { financialPlan2026: { dre: {}, dfc: {}, bp: {} } },
    baseScenario: 'Conservador',
    calculateFinancialPlan2026: vi.fn(),
    setBaseScenario: vi.fn(),
});

// Sem globals no Vitest, o Testing Library não desmonta sozinho entre os testes.
afterEach(cleanup);

describe('FinancialPlanning2026 — anos do plano aberto', () => {
    it('no plano 2027, a DRE totaliza 2027 e nada cita 2025', () => {
        const { container } = render(<FinancialPlanning2026 />);
        expect(container.textContent).toMatch(/Planejamento Financeiro 2027/);
        expect(container.textContent).toMatch(/Total 2027/);
        expect(container.textContent).not.toMatch(/2025/);
    });

    it('no plano 2027, o balanço mostra o saldo de Dez/27', () => {
        const { container } = render(<FinancialPlanning2026 />);
        fireEvent.click(screen.getByText('Balanço Patrimonial'));
        expect(container.textContent).toMatch(/Saldo Dez\/27/);
        expect(container.textContent).not.toMatch(/Dez\/26/);
    });

    it('no plano 2027, a dica do balanço cita a coluna "Saldo Dez/27" sem código no texto', () => {
        const { container } = render(<FinancialPlanning2026 />);
        fireEvent.click(screen.getByText('Balanço Patrimonial'));
        const dica = screen.getByText('Dica de Visualização:').closest('p')!;
        expect(dica.textContent).toContain('"Saldo Dez/27"');
        expect(container.textContent).not.toContain('{String(');
        expect(container.textContent).not.toContain('slice(');
    });
});
