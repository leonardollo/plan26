import { MONTHS, MonthlyData, ScenarioProjectionData } from '../../types';
import { num } from './impostos';

export interface ResumoDoCenario {
    receita: MonthlyData;
    custos: MonthlyData;
    despesas: MonthlyData;
    ebitda: MonthlyData;
}

const somaDosItens = (itens: { values?: MonthlyData }[] | undefined, m: string) =>
    (itens || []).reduce((s, i) => s + num(i?.values?.[m]), 0);

/**
 * Receita bruta, custos (variáveis + impostos sobre vendas), despesas fixas e EBITDA de cada mês,
 * lidos da projeção do cenário. O EBITDA é o mesmo da DRE.
 */
export const resumoDoCenario = (projection: Partial<ScenarioProjectionData> | undefined): ResumoDoCenario => {
    const p = projection || {};
    const resumo: ResumoDoCenario = { receita: {}, custos: {}, despesas: {}, ebitda: {} };
    MONTHS.forEach(m => {
        const receita = num(p.receitaBruta?.[m]);
        // Custos partem da receita bruta, então incluem os impostos sobre vendas.
        const custos = num(p.impostosSobreFaturamento?.[m]) + num(p.cmv?.[m]) + num(p.comissoes?.[m])
            + num(p.fretes?.[m]) + somaDosItens(p.customCustosVariaveis, m);
        const despesas = num(p.folhaPagamento?.[m]) + num(p.aluguel?.[m]) + num(p.despesasOperacionais?.[m])
            + num(p.marketingFixo?.[m]) + num(p.administrativo?.[m]) + somaDosItens(p.customCustosFixos, m);
        resumo.receita[m] = receita;
        resumo.custos[m] = custos;
        resumo.despesas[m] = despesas;
        resumo.ebitda[m] = receita - custos - despesas;
    });
    return resumo;
};
