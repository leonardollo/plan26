import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const { planoFalso } = vi.hoisted(() => ({ planoFalso: {} as any }));

vi.mock('../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));

import InvestimentosFinanciamentos2026 from './InvestimentosFinanciamentos2026';

const emprestimo = { id: 'e1', descricao: 'Banco', valor: 100000, mes: 'jan', jurosMensalPct: 2, parcelas: 24 };

const montarPlano = (bloco: Record<string, any> = {}) => {
    Object.assign(planoFalso, {
        planData: {
            investment: { financing: { saldoCaixaFinal2025: 0, financiamentoCurtoPrazo: 120000, financiamentoLongoPrazo: 240000 } },
            investment2026: { investimentos: [], emprestimos: [], aportes: [], jurosDividaAtualPct: null, ...bloco },
        },
        updateJurosDividaAtual: vi.fn(),
        addItemInvestimento2026: vi.fn(),
        updateItemInvestimento2026: vi.fn(),
        removeItemInvestimento2026: vi.fn(),
    });
};

describe('InvestimentosFinanciamentos2026', () => {
    beforeEach(() => { for (const k of Object.keys(planoFalso)) delete planoFalso[k]; });
    // Sem globals no Vitest, o Testing Library não desmonta sozinho entre os testes.
    afterEach(cleanup);

    it('mostra as quatro seções e a dívida atual da Coleta', () => {
        montarPlano();
        render(<InvestimentosFinanciamentos2026 />);
        ['Investimentos 2026', 'Empréstimos novos', 'Aportes de sócios', 'Dívida atual (31/12/25)']
            .forEach(titulo => expect(screen.getByRole('heading', { name: titulo })).toBeTruthy());
        expect(screen.getByText(/120\.000,00/)).toBeTruthy();
        expect(screen.getByText(/240\.000,00/)).toBeTruthy();
    });

    it('adicionar chama a função de cada lista', () => {
        montarPlano();
        render(<InvestimentosFinanciamentos2026 />);
        fireEvent.click(screen.getByRole('button', { name: 'Adicionar investimento' }));
        fireEvent.click(screen.getByRole('button', { name: 'Adicionar empréstimo' }));
        fireEvent.click(screen.getByRole('button', { name: 'Adicionar aporte' }));
        expect(planoFalso.addItemInvestimento2026.mock.calls).toEqual([['investimentos'], ['emprestimos'], ['aportes']]);
    });

    it('editar valor e mês chama updateItemInvestimento2026', () => {
        montarPlano({ emprestimos: [{ ...emprestimo, valor: null }] });
        render(<InvestimentosFinanciamentos2026 />);
        // O CurrencyInput só entrega o valor ao sair do campo.
        const valor = screen.getByLabelText('Valor do empréstimo');
        fireEvent.focus(valor);
        fireEvent.change(valor, { target: { value: '100000' } });
        fireEvent.blur(valor);
        expect(planoFalso.updateItemInvestimento2026).toHaveBeenCalledWith('emprestimos', 'e1', 'valor', '100000');
        fireEvent.change(screen.getByLabelText('Mês do empréstimo'), { target: { value: 'mar' } });
        expect(planoFalso.updateItemInvestimento2026).toHaveBeenCalledWith('emprestimos', 'e1', 'mes', 'mar');
    });

    // Cada lista sozinha, com valor vazio, para o CurrencyInput aceitar a digitação.
    const listas = [
        {
            lista: 'investimentos', sufixo: 'investimento',
            item: { id: 'i1', descricao: '', valor: null, mes: 'jan', vidaUtilAnos: null },
            numericos: [['Vida útil (anos)', 'vidaUtilAnos', '10']],
        },
        {
            lista: 'emprestimos', sufixo: 'empréstimo',
            item: { id: 'e1', descricao: '', valor: null, mes: 'jan', jurosMensalPct: null, parcelas: null },
            numericos: [['Juros a.m. do empréstimo (%)', 'jurosMensalPct', '1.5'], ['Nº de parcelas', 'parcelas', '36']],
        },
        {
            lista: 'aportes', sufixo: 'aporte',
            item: { id: 'a1', descricao: '', valor: null, mes: 'jan' },
            numericos: [],
        },
    ];

    listas.forEach(({ lista, sufixo, item, numericos }) => {
        it(`${lista}: editar cada campo chama updateItemInvestimento2026 com os argumentos exatos`, () => {
            montarPlano({ [lista]: [item] });
            render(<InvestimentosFinanciamentos2026 />);
            fireEvent.change(screen.getByLabelText(`Descrição do ${sufixo}`), { target: { value: 'Novo' } });
            const valor = screen.getByLabelText(`Valor do ${sufixo}`);
            fireEvent.focus(valor);
            fireEvent.change(valor, { target: { value: '50000' } });
            fireEvent.blur(valor);
            fireEvent.change(screen.getByLabelText(`Mês do ${sufixo}`), { target: { value: 'jun' } });
            numericos.forEach(([rotulo, , digitado]) =>
                fireEvent.change(screen.getByLabelText(rotulo), { target: { value: digitado } }));
            expect(planoFalso.updateItemInvestimento2026.mock.calls).toEqual([
                [lista, item.id, 'descricao', 'Novo'],
                [lista, item.id, 'valor', '50000'],
                [lista, item.id, 'mes', 'jun'],
                ...numericos.map(([, campo, digitado]) => [lista, item.id, campo, digitado]),
            ]);
        });

        it(`${lista}: remover chama removeItemInvestimento2026 com a lista e o id`, () => {
            montarPlano({ [lista]: [item] });
            render(<InvestimentosFinanciamentos2026 />);
            fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
            expect(planoFalso.removeItemInvestimento2026.mock.calls).toEqual([[lista, item.id]]);
        });
    });

    it('empréstimo mostra a parcela calculada', () => {
        montarPlano({ emprestimos: [emprestimo] });
        render(<InvestimentosFinanciamentos2026 />);
        expect(screen.getByRole('columnheader', { name: 'Parcela (R$)' })).toBeTruthy();
        expect(screen.getByText(/5\.287,11/)).toBeTruthy();
    });

    it('empréstimo sem nº de parcelas mostra o aviso', () => {
        montarPlano({ emprestimos: [{ ...emprestimo, parcelas: null }] });
        render(<InvestimentosFinanciamentos2026 />);
        expect(screen.getByText('Informe o nº de parcelas')).toBeTruthy();
    });

    it('juros da dívida atual chama updateJurosDividaAtual', () => {
        montarPlano();
        render(<InvestimentosFinanciamentos2026 />);
        fireEvent.change(screen.getByLabelText('Juros médios a.m. da dívida atual (%)'), { target: { value: '1.5' } });
        expect(planoFalso.updateJurosDividaAtual).toHaveBeenCalledWith('1.5');
    });
});
