import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const { planoFalso, dpe } = vi.hoisted(() => ({
    planoFalso: {} as any,
    dpe: { resolverBusca: (_foto: unknown) => {} },
}));

vi.mock('../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));
vi.mock('../services/dpeImport', async (importOriginal) => {
    const original = await importOriginal<typeof import('../services/dpeImport')>();
    return {
        ...original,
        buscarFotoDpe: vi.fn(() => new Promise(resolve => { dpe.resolverBusca = resolve; })),
        importarDoDiagnostico: vi.fn((_foto: unknown, anoBase: number) => ({
            empresa: 'Empresa X',
            anoBase,
            mesesEncontrados: 12,
            patch: {},
            goals2026: {},
            relatorio: [],
            substituira: { portfolio: 0, acoes: 0 },
        })),
    };
});

import ImportFromDpe from './ImportFromDpe';
import { importarDoDiagnostico } from '../services/dpeImport';

const LINK = 'https://gestaoimpacto.com/planejamento/?p=12345678-1234-1234-1234-123456789abc&c=abcdefgh12';

beforeEach(() => {
    vi.mocked(importarDoDiagnostico).mockClear();
    Object.assign(planoFalso, {
        anoPlano: 2026,
        anoBase: 2025,
        planData: { productPortfolio: [], actionPlan: [] },
        aplicarImportacaoDpe: vi.fn(),
    });
});

// Sem globals no Vitest, o Testing Library não desmonta sozinho entre os testes.
afterEach(cleanup);

const iniciarBusca = () => {
    fireEvent.change(screen.getByPlaceholderText(/gestaoimpacto\.com/), { target: { value: LINK } });
    fireEvent.click(screen.getByText('Buscar diagnóstico'));
};

describe('ImportFromDpe — busca pendente e troca de ano', () => {
    it('busca concluída no mesmo ano mostra a prévia do ano base 2025', async () => {
        render(<ImportFromDpe />);
        iniciarBusca();
        await act(async () => { dpe.resolverBusca({}); });
        expect(screen.getByText('Aplicar ao PLAN 2026')).toBeTruthy();
        expect(screen.getByText(/12 meses de 2025/)).toBeTruthy();
    });

    it('busca iniciada no plano 2026 e concluída depois de abrir o 2027 não mostra prévia de 2025', async () => {
        const { rerender } = render(<ImportFromDpe />);
        iniciarBusca();
        Object.assign(planoFalso, { anoPlano: 2027, anoBase: 2026 });
        rerender(<ImportFromDpe />);
        await act(async () => { dpe.resolverBusca({}); });
        expect(importarDoDiagnostico).not.toHaveBeenCalledWith(expect.anything(), 2025);
        expect(screen.queryByText(/Aplicar ao PLAN/)).toBeNull();
        expect(screen.queryByText(/meses de 2025/)).toBeNull();
        expect(planoFalso.aplicarImportacaoDpe).not.toHaveBeenCalled();
    });

    const abrirArquivo = (container: HTMLElement) => {
        const entrada = container.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(entrada, { target: { files: [new File(['{}'], 'diagnostico.json', { type: 'application/json' })] } });
    };
    // O FileReader do jsdom termina num tique posterior; esperar um pouco deixa o onload rodar.
    const esperarLeitura = () => act(() => new Promise(r => setTimeout(r, 50)));

    it('arquivo lido no mesmo ano mostra a prévia do ano base 2025', async () => {
        const { container } = render(<ImportFromDpe />);
        abrirArquivo(container);
        await esperarLeitura();
        expect(screen.getByText(/12 meses de 2025/)).toBeTruthy();
    });

    it('arquivo aberto no plano 2026 e lido depois de abrir o 2027 não mostra prévia de 2025', async () => {
        const { container, rerender } = render(<ImportFromDpe />);
        abrirArquivo(container);
        Object.assign(planoFalso, { anoPlano: 2027, anoBase: 2026 });
        rerender(<ImportFromDpe />);
        await esperarLeitura();
        expect(importarDoDiagnostico).not.toHaveBeenCalledWith(expect.anything(), 2025);
        expect(screen.queryByText(/Aplicar ao PLAN/)).toBeNull();
    });
});
