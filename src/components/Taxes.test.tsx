import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

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
