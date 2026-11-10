import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const { planoFalso } = vi.hoisted(() => ({ planoFalso: {} as any }));

vi.mock('../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));

import CommercialPlanning from './CommercialPlanning';

// "TI" e não "Comercial": o ajuste automático do newHires só mexe no departamento Comercial.
const contratacao = { id: 'h1', department: 'TI', currentHeadcount: 2, newHires: 1, avgAnnualCost: 60000 };

const montarPlano = (item: Record<string, any> = contratacao) => {
    Object.assign(planoFalso, {
        planData: {
            commercialPlanning: {
                demandPlanning: { channels: [] },
                salesFunnel: {},
                driverBasedPlanning: { leadsQualificados: {}, taxaConversao: {}, clientesRecorrentes: {}, ticketMedio: {} },
            },
            hiringProjection: [item],
        },
        goals2026: { financeiras: { metaReceita: {} }, pessoas: {} },
        summary2025: { custoColaboradorAno: 0, monthlySummary: [], ticketMedio: 0, receitaTotal: 0 },
        updateCommercialPlanning: vi.fn(),
        addDemandChannel: vi.fn(),
        removeDemandChannel: vi.fn(),
        updateDemandChannel: vi.fn(),
        generateChannelAnalysis: vi.fn(),
        updateHiringProjectionItem: vi.fn(),
        addHiringProjectionItem: vi.fn(),
        removeHiringProjectionItem: vi.fn(),
        generateFunnelSuggestions: vi.fn(),
        updateDriverBasedPlanning: vi.fn(),
    });
};

const abrirContratacoes = () => {
    render(<CommercialPlanning />);
    fireEvent.click(screen.getByRole('button', { name: '4. Contratacoes' }));
};

describe('CommercialPlanning — mês de entrada das contratações', () => {
    beforeEach(() => { for (const k of Object.keys(planoFalso)) delete planoFalso[k]; });
    // Sem globals no Vitest, o Testing Library não desmonta sozinho entre os testes.
    afterEach(cleanup);

    it('mostra a coluna Mês de entrada e a dica', () => {
        montarPlano();
        abrirContratacoes();
        expect(screen.getByRole('columnheader', { name: 'Mês de entrada' })).toBeTruthy();
        expect(screen.getByText('O custo das novas contratações entra na folha a partir deste mês')).toBeTruthy();
    });

    it('item sem mesEntrada aparece como Jan', () => {
        montarPlano();
        abrirContratacoes();
        expect((screen.getByLabelText('Mês de entrada') as HTMLSelectElement).value).toBe('jan');
    });

    it('trocar o mês chama updateHiringProjectionItem', () => {
        montarPlano({ ...contratacao, mesEntrada: 'mar' });
        abrirContratacoes();
        const seletor = screen.getByLabelText('Mês de entrada') as HTMLSelectElement;
        expect(seletor.value).toBe('mar');
        fireEvent.change(seletor, { target: { value: 'jul' } });
        expect(planoFalso.updateHiringProjectionItem).toHaveBeenCalledWith('h1', 'mesEntrada', 'jul');
    });
});

// 1.000 leads; 10 atividades × 20 dias = 200 por vendedor; 2 atuais cobrem 400 → faltam 3 (repsNeeded 5).
const comFunil = (newHires: number) => {
    montarPlano({ ...contratacao, department: 'Comercial', currentHeadcount: 2, newHires });
    planoFalso.planData.commercialPlanning.demandPlanning.channels = [{ id: 'c1', name: 'Site', budget: 0, leads: 1000, expectedRevenue: 0 }];
    planoFalso.planData.commercialPlanning.salesFunnel = { activitiesPerRep: 10, workingDays: 20, rampUpTime: 0 };
    render(<CommercialPlanning />);
};

describe('CommercialPlanning — ajuste automático das contratações do Comercial', () => {
    beforeEach(() => { for (const k of Object.keys(planoFalso)) delete planoFalso[k]; });
    afterEach(cleanup);

    it('newHires diferente do necessário: ajusta uma vez para 3', () => {
        comFunil(1);
        expect(planoFalso.updateHiringProjectionItem).toHaveBeenCalledTimes(1);
        expect(planoFalso.updateHiringProjectionItem).toHaveBeenCalledWith('h1', 'newHires', '3');
    });

    it('newHires já igual ao necessário: não chama', () => {
        comFunil(3);
        expect(planoFalso.updateHiringProjectionItem).not.toHaveBeenCalled();
    });
});
