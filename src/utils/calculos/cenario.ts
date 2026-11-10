import {
    MONTHS, CustomLineItem, CustomProjectionLineItem, FinancialSheetData, MonthlyData, ScenarioProjectionData, TaxesData,
} from '../../types';
import { aliquotaDeducao, num } from './impostos';

const multiplicar = (dados: MonthlyData | undefined, fator: number): MonthlyData =>
    MONTHS.reduce((acc, m) => ({ ...acc, [m]: num(dados?.[m]) * fator }), {} as MonthlyData);

const multiplicarItens = (itens: CustomLineItem[] | undefined, fator: number): CustomProjectionLineItem[] =>
    (itens || []).map(item => ({ id: item.id, name: item.name, values: multiplicar(item.values2025, fator) }));

/**
 * Projeção de 2026 a partir da base de 2025.
 * `crescimentoPct` já chega somado (crescimento do cenário + score estratégico + bônus de produtividade).
 */
export const projetarCenario = (
    base: FinancialSheetData,
    crescimentoPct: number,
    inflacaoPct: number,
    taxes: Partial<TaxesData>,
    custoContratacoes?: MonthlyData,
): ScenarioProjectionData => {
    // Receita e custos variáveis acompanham o volume de vendas; custos fixos e despesas, só a inflação.
    const fatorCrescimento = 1 + num(crescimentoPct) / 100;
    const fatorInflacao = 1 + num(inflacaoPct) / 100;

    const receitaBruta = multiplicar(base.receitaBruta?.values2025, fatorCrescimento);
    // Impostos sobre faturamento saem da receita projetada, não do imposto de 2025 crescido.
    const aliquota = aliquotaDeducao(taxes) / 100;
    const impostosSobreFaturamento = MONTHS.reduce(
        (acc, m) => ({ ...acc, [m]: num(receitaBruta[m]) * aliquota }), {} as MonthlyData,
    );

    // Contratações entram depois da inflação: o custo médio digitado já é de 2026.
    const folhaCorrigida = multiplicar(base.folhaPagamento?.values2025, fatorInflacao);
    const folhaPagamento = MONTHS.reduce(
        (acc, m) => ({ ...acc, [m]: num(folhaCorrigida[m]) + num(custoContratacoes?.[m]) }), {} as MonthlyData,
    );

    return {
        receitaBruta,
        impostosSobreFaturamento,
        folhaPagamento,
        aluguel: multiplicar(base.aluguel?.values2025, fatorInflacao),
        despesasOperacionais: multiplicar(base.despesasOperacionais?.values2025, fatorInflacao),
        marketingFixo: multiplicar(base.marketingFixo?.values2025, fatorInflacao),
        administrativo: multiplicar(base.administrativo?.values2025, fatorInflacao),
        customCustosFixos: multiplicarItens(base.customCustosFixos, fatorInflacao),
        cmv: multiplicar(base.cmv?.values2025, fatorCrescimento),
        comissoes: multiplicar(base.comissoes?.values2025, fatorCrescimento),
        fretes: multiplicar(base.fretes?.values2025, fatorCrescimento),
        customCustosVariaveis: multiplicarItens(base.customCustosVariaveis, fatorCrescimento),
    };
};
