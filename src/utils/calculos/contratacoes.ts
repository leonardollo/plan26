import { MONTHS, HiringProjectionItem, MonthlyData } from '../../types';
import { num } from './impostos';

/** Custo mensal das novas contratações, do mês de entrada até dezembro. Os 12 meses estão sempre presentes. */
export const custoContratacoesMensal = (itens: HiringProjectionItem[] | undefined): MonthlyData => {
    const custo = MONTHS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {} as MonthlyData);
    (itens || []).forEach(item => {
        const mensal = num(item?.newHires) * num(item?.avgAnnualCost) / 12;
        if (mensal === 0) return;
        // Mês vazio ou desconhecido (plano antigo) vale janeiro.
        const inicio = Math.max(0, MONTHS.indexOf(item?.mesEntrada ?? 'jan'));
        MONTHS.forEach((m, i) => { if (i >= inicio) custo[m] = custo[m]! + mensal; });
    });
    return custo;
};
