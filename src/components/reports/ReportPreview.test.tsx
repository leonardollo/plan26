import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { formatCurrency } from '../../utils/formatters';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesesIguais = (valor: number) => Object.fromEntries(MESES.map(m => [m, valor]));

const { planoFalso } = vi.hoisted(() => ({ planoFalso: {} as any }));

vi.mock('../../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));

import ReportPreview from './ReportPreview';

const montarPlano = (taxes: Record<string, unknown>, ebitdaMensal2025: number, dre: Record<string, unknown> = {}) =>
    Object.assign(planoFalso, {
        taxes,
        baseScenario: 'Conservador',
        planData: {
            companyProfile: { name: 'Empresa X', industry: 'Varejo' },
            analysis: { planReportAnalysis: '', diagnosisReportAnalysis: '' },
            actionPlan: [],
            productPortfolio: [],
            okrsAndKpis: { okrs: [] },
            marketAnalysis: {
                swot: { strengths: '', weaknesses: '', opportunities: '', threats: '' },
                blueOcean: { factors: [], fourActions: {} },
            },
            commercialPlanning: { salesFunnel: {}, demandPlanning: { channels: [] } },
            financialSheet: { receitaBruta: { values2025: mesesIguais(100000) } },
            financialPlan2026: { dre, dfc: {}, bp: {} },
        },
        goals2026: {
            financeiras: { metaReceita: {} },
            comerciais: { metaNumClientes: {} },
            pessoas: {},
            objetivosEstrategicos: {},
        },
        summary2025: {
            receitaTotal: 0,
            receitaBrutaTotal: 1200000,
            ebitda: ebitdaMensal2025 * 12,
            monthlySummary: MESES.map(m => ({ month: m, receita: 100000, ebitda: ebitdaMensal2025 })),
        },
    });

// Sem globals no Vitest, o Testing Library não desmonta sozinho entre os testes.
afterEach(cleanup);

const linhaDoComparativo = (rotulo: string) =>
    screen.getAllByText(rotulo).map(el => el.closest('tr')).find(tr => tr && tr.querySelectorAll('td').length === 4)!;

describe('ReportPreview — números do relatório do plano', () => {
    it('despesas fixas da DRE: folha 30 mil + operacionais 10 mil = 40 mil, e não 0', () => {
        montarPlano({ regimeTributario: 'Simples Nacional', simplesNacional: 6 }, 50000,
            { despesasFolha: { jan: 30000 }, despesasOperacionais: { jan: 10000 } });
        render(<ReportPreview reportType="plan" onClose={() => {}} />);
        const linha = screen.getByText('(-) Despesas Fixas').closest('tr')!;
        const celulas = linha.querySelectorAll('td');
        expect(celulas[1].textContent).toBe(formatCurrency(40000));
        expect(celulas[celulas.length - 1].textContent).toBe(formatCurrency(40000));
    });

    it('Simples: o lucro líquido de 2025 é igual ao EBITDA de 2025', () => {
        montarPlano({ regimeTributario: 'Simples Nacional', simplesNacional: 6 }, 50000);
        render(<ReportPreview reportType="plan" onClose={() => {}} />);
        const celulas = linhaDoComparativo('Lucro Líquido').querySelectorAll('td');
        expect(celulas[1].textContent).toBe(formatCurrency(600000));
    });

    it('Lucro Real: EBITDA de 50 mil/mês em 2025 dá lucro líquido de 420 mil', () => {
        montarPlano({ regimeTributario: 'Lucro Real' }, 50000);
        render(<ReportPreview reportType="plan" onClose={() => {}} />);
        const celulas = linhaDoComparativo('Lucro Líquido').querySelectorAll('td');
        expect(celulas[1].textContent).toBe(formatCurrency(420000));
    });
});
