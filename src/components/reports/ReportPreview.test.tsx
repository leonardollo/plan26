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

    it('custos variáveis da DRE somam os personalizados: CMV 30 mil + outros 5 mil = 35 mil, e líquida − custos = lucro bruto', () => {
        montarPlano({ regimeTributario: 'Simples Nacional', simplesNacional: 6 }, 50000, {
            receitaLiquida: { jan: 94000 }, custosVariaveis: { jan: 30000 },
            outrosCustosVariaveis: { jan: 5000 }, lucroBruto: { jan: 59000 },
        });
        render(<ReportPreview reportType="plan" onClose={() => {}} />);
        const celulas = screen.getByText('(-) Custos Variáveis').closest('tr')!.querySelectorAll('td');
        expect(celulas[1].textContent).toBe(formatCurrency(35000));
        expect(celulas[celulas.length - 1].textContent).toBe(formatCurrency(35000));
        const jan = (rotulo: string) => screen.getByText(rotulo).closest('tr')!.querySelectorAll('td')[1].textContent;
        expect(jan('(=) Receita Líquida')).toBe(formatCurrency(94000));
        expect(jan('(=) Lucro Bruto')).toBe(formatCurrency(94000 - 35000));
    });

    it('sem custos personalizados, a linha mostra só os custos variáveis (30 mil)', () => {
        montarPlano({ regimeTributario: 'Simples Nacional', simplesNacional: 6 }, 50000, { custosVariaveis: { jan: 30000 } });
        render(<ReportPreview reportType="plan" onClose={() => {}} />);
        const celulas = screen.getByText('(-) Custos Variáveis').closest('tr')!.querySelectorAll('td');
        expect(celulas[1].textContent).toBe(formatCurrency(30000));
    });

    it('Simples: o lucro líquido de 2025 é igual ao EBITDA de 2025', () => {
        montarPlano({ regimeTributario: 'Simples Nacional', simplesNacional: 6 }, 50000);
        render(<ReportPreview reportType="plan" onClose={() => {}} />);
        const celulas = linhaDoComparativo('Lucro Líquido').querySelectorAll('td');
        expect(celulas[1].textContent).toBe(formatCurrency(600000));
    });

    it('no plano 2027 (base 2026), o relatório do plano mostra PLAN 2027 e não cita 2025', () => {
        montarPlano({ regimeTributario: 'Simples Nacional', simplesNacional: 6 }, 50000);
        Object.assign(planoFalso, { anoPlano: 2027, anoBase: 2026 });
        render(<ReportPreview reportType="plan" onClose={() => {}} />);
        // O relatório abre num portal no body, fora do container do render.
        const texto = document.body.textContent;
        expect(texto).toMatch(/PLAN 2027/);
        expect(texto).toMatch(/2026/);
        expect(texto).not.toMatch(/2025/);
    });

    it('Lucro Real: EBITDA de 50 mil/mês em 2025 dá lucro líquido de 420 mil', () => {
        montarPlano({ regimeTributario: 'Lucro Real' }, 50000);
        render(<ReportPreview reportType="plan" onClose={() => {}} />);
        const celulas = linhaDoComparativo('Lucro Líquido').querySelectorAll('td');
        expect(celulas[1].textContent).toBe(formatCurrency(420000));
    });
});
