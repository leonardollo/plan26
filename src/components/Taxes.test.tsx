import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesesIguais = (valor: number) => Object.fromEntries(MESES.map(m => [m, valor]));

const { planoFalso } = vi.hoisted(() => ({ planoFalso: {} as any }));

vi.mock('../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));
vi.mock('../services/geminiService', () => ({ getTaxRecommendation: vi.fn() }));

import Taxes from './Taxes';

const montarPlano = (impostos2025: Record<string, any>) => {
    Object.assign(planoFalso, {
        taxes: { regimeTributario: 'Simples Nacional', simplesNacional: 6, inssPatronal: 0, fgts: 0, ratTerceiros: 0, totalEncargosFolha: 0 },
        updateTaxes: vi.fn(),
        applyTaxesTo2025: vi.fn(),
        summary2025: { receitaBrutaTotal: 1200000 },
        planData: {
            companyProfile: { cnpj: '' },
            financialSheet: {
                receitaBruta: { values2025: mesesIguais(100000) },
                impostosSobreFaturamento: { values2025: impostos2025 },
            },
        },
    });
};

// Troca a alíquota do Simples (6 → 10) e rerenderiza, como a aba faz quando o cliente edita o campo.
const mudarAliquota = (rerender: (ui: React.ReactElement) => void) => {
    planoFalso.taxes = { ...planoFalso.taxes, simplesNacional: 10 };
    rerender(<Taxes />);
};

describe('Taxes — preenchimento automático do imposto de 2025', () => {
    beforeEach(() => { for (const k of Object.keys(planoFalso)) delete planoFalso[k]; });

    it('linha vazia ({}): mudar a alíquota preenche o imposto de 2025', () => {
        montarPlano({});
        const { rerender } = render(<Taxes />);
        mudarAliquota(rerender);
        expect(planoFalso.applyTaxesTo2025).toHaveBeenCalledTimes(1);
    });

    it('linha só com zeros, vazios e nulos conta como vazia', () => {
        montarPlano({ jan: 0, fev: null, mar: '', abr: undefined });
        const { rerender } = render(<Taxes />);
        mudarAliquota(rerender);
        expect(planoFalso.applyTaxesTo2025).toHaveBeenCalledTimes(1);
    });

    it('imposto digitado à mão (jan 5.000) fica: mudar a alíquota não sobrescreve', () => {
        montarPlano({ jan: 5000 });
        const { rerender } = render(<Taxes />);
        mudarAliquota(rerender);
        expect(planoFalso.applyTaxesTo2025).not.toHaveBeenCalled();
    });

    it('linha toda preenchida também fica', () => {
        montarPlano(mesesIguais(6000));
        const { rerender } = render(<Taxes />);
        mudarAliquota(rerender);
        expect(planoFalso.applyTaxesTo2025).not.toHaveBeenCalled();
    });
});

// Plano Presumido com base de R 1,2 mi e custo variável de 480 mil: CBS sugerida 6,78.
const montarPlanoCbs = (ano: number, taxesExtra: Record<string, any> = {}) => {
    montarPlano({});
    planoFalso.anoPlano = ano;
    planoFalso.anoBase = ano - 1;
    planoFalso.taxes = {
        regimeTributario: 'Lucro Presumido', iss: 5, pis: 0.65, cofins: 3,
        inssPatronal: 0, fgts: 0, ratTerceiros: 0, totalEncargosFolha: 0, ...taxesExtra,
    };
    planoFalso.planData.financialSheet.cmv = { values2025: mesesIguais(40000) };
};

describe('Taxes — CBS a partir de 2027', () => {
    beforeEach(() => { for (const k of Object.keys(planoFalso)) delete planoFalso[k]; });
    // Sem globals no Vitest, a Testing Library não desmonta sozinha entre os testes.
    afterEach(cleanup);

    it('2027: campo CBS com a sugestão, imposto do ano do plano e dica de PIS e COFINS', () => {
        montarPlanoCbs(2027);
        render(<Taxes />);
        expect(screen.getByText('CBS efetiva (%)')).toBeTruthy();
        expect(screen.getByPlaceholderText('Sugestão: 6,78%')).toBeTruthy();
        expect(screen.getByText('Imposto sobre a receita em 2027')).toBeTruthy();
        expect(screen.getByText('11,78%')).toBeTruthy();
        expect(screen.getAllByText('Vale para 2026; em 2027 a CBS substitui')).toHaveLength(2);
    });

    it('2027 com CBS 0 (campo apagado): o campo fica vazio e mostra a sugestão', () => {
        montarPlanoCbs(2027, { cbsEfetiva: 0 });
        render(<Taxes />);
        expect((screen.getByPlaceholderText('Sugestão: 6,78%') as HTMLInputElement).value).toBe('');
    });

    it('2026: sem campo CBS e sem linha do ano do plano', () => {
        montarPlanoCbs(2026);
        render(<Taxes />);
        expect(screen.queryByText('CBS efetiva (%)')).toBeNull();
        expect(screen.queryByText(/Imposto sobre a receita em/)).toBeNull();
    });

    it('2027 no Simples: sem campo CBS', () => {
        montarPlanoCbs(2027, { regimeTributario: 'Simples Nacional', simplesNacional: 6 });
        render(<Taxes />);
        expect(screen.queryByText('CBS efetiva (%)')).toBeNull();
    });

    it('alíquota efetiva preenchida: aviso em 2027, nada em 2026', () => {
        montarPlanoCbs(2027, { aliquotaEfetiva: 15 });
        const { unmount } = render(<Taxes />);
        expect(screen.getByText(/Em 2027 o PIS e a COFINS deixam de existir/)).toBeTruthy();
        unmount();
        montarPlanoCbs(2026, { aliquotaEfetiva: 15 });
        render(<Taxes />);
        expect(screen.queryByText(/deixam de existir e entra a CBS/)).toBeNull();
    });

    it('mudar só a CBS não preenche o imposto do ano base', () => {
        montarPlanoCbs(2027);
        const { rerender } = render(<Taxes />);
        const chamadas = planoFalso.applyTaxesTo2025.mock.calls.length;
        planoFalso.taxes = { ...planoFalso.taxes, cbsEfetiva: 8 };
        rerender(<Taxes />);
        expect(planoFalso.applyTaxesTo2025).toHaveBeenCalledTimes(chamadas);
    });
});

describe('Taxes — cronograma marca o ano do plano', () => {
    beforeEach(() => { for (const k of Object.keys(planoFalso)) delete planoFalso[k]; });
    afterEach(cleanup);

    const faseMarcada = (ano: number) => {
        montarPlanoCbs(ano);
        render(<Taxes />);
        fireEvent.click(screen.getByText('Cenário Tributário'));
        const selo = screen.getByText(`Ano do seu plano (${ano})`);
        return selo.closest('[data-fase]')?.getAttribute('data-fase');
    };

    it('2027 cai na virada federal', () => expect(faseMarcada(2027)).toBe('2027'));
    it('2028 continua na virada federal (CBS de 2027-28)', () => expect(faseMarcada(2028)).toBe('2027'));
    it('2030 cai na transição estadual', () => expect(faseMarcada(2030)).toBe('2029-32'));
    it('2035 cai no sistema definitivo', () => expect(faseMarcada(2035)).toBe('2033'));
    it('títulos sem ano fixo: cabeçalho e plano de ação seguem o ano do plano', () => {
        montarPlanoCbs(2028);
        render(<Taxes />);
        expect(screen.getByText(/prepare sua empresa para a reforma em 2028/)).toBeTruthy();
        fireEvent.click(screen.getByText('Cenário Tributário'));
        expect(screen.queryByText(/AGORA em 2026/)).toBeNull();
    });
});
