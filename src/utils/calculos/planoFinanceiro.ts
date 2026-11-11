import {
    MONTHS, BP2026, DFC2026, DRE2026, FinancialPlan2026, InvestmentData2026, MonthlyData, PlanData,
    ScenarioProjectionData, TaxesData,
} from '../../types';
import { irpjCsllMensal, num } from './impostos';
import {
    aportes2026, dividaAtual, emprestimosNovos, investimento2026Vazio, investimentos2026,
} from './investimentos';

const somaDosItens = (itens: { values?: MonthlyData }[] | undefined, m: string) =>
    (itens || []).reduce((s, i) => s + num(i?.values?.[m]), 0);

/** DRE, DFC e BP do ano do plano a partir da projeção do cenário base. */
export const calcularPlanoFinanceiro2026 = (
    proj: ScenarioProjectionData,
    taxes: Partial<TaxesData>,
    investment: PlanData['investment'],
    investment2026?: InvestmentData2026,
): FinancialPlan2026 => {
    // Planos antigos podem trazer a projeção incompleta; linha ausente vale 0.
    const p = (proj || {}) as Partial<ScenarioProjectionData>;
    const bloco = investment2026 ?? investimento2026Vazio();
    const inv = investimentos2026(bloco.investimentos);
    const emp = emprestimosNovos(bloco.emprestimos);
    const divida = dividaAtual(investment?.financing, bloco.jurosDividaAtualPct);
    const aportes = aportes2026(bloco.aportes);
    const linha = (dados: MonthlyData | undefined): MonthlyData =>
        MONTHS.reduce((acc, m) => ({ ...acc, [m]: num(dados?.[m]) }), {} as MonthlyData);

    const dre: DRE2026 = {} as any;
    dre.receitaBruta = linha(p.receitaBruta);
    dre.impostosVendas = linha(p.impostosSobreFaturamento);
    dre.receitaLiquida = {};
    dre.custosVariaveis = {};
    dre.outrosCustosVariaveis = {};
    dre.lucroBruto = {};
    dre.despesasFolha = {};
    dre.despesasMarketing = {};
    dre.despesasOperacionais = {};
    dre.outrasDespesasFixas = {};
    dre.ebitda = {};
    dre.depreciacao = {};
    dre.ebit = {};
    dre.despesasFinanceiras = {};
    dre.lucroAntesImpostos = {};
    dre.irpjCsll = {};
    dre.lucroLiquido = {};

    MONTHS.forEach(m => {
        const rb = num(dre.receitaBruta[m]);
        const imp = num(dre.impostosVendas[m]);
        dre.receitaLiquida[m] = rb - imp;

        dre.custosVariaveis[m] = num(p.cmv?.[m]) + num(p.comissoes?.[m]) + num(p.fretes?.[m]);

        const custVarCustom = somaDosItens(p.customCustosVariaveis, m);
        dre.outrosCustosVariaveis[m] = custVarCustom;

        dre.lucroBruto[m] = dre.receitaLiquida[m]! - dre.custosVariaveis[m]! - custVarCustom;

        dre.despesasFolha[m] = num(p.folhaPagamento?.[m]);
        dre.despesasMarketing[m] = num(p.marketingFixo?.[m]);
        dre.despesasOperacionais[m] = num(p.despesasOperacionais?.[m]) + num(p.aluguel?.[m]);
        dre.outrasDespesasFixas[m] = num(p.administrativo?.[m]) + somaDosItens(p.customCustosFixos, m);

        const totalDespesas = dre.despesasFolha[m]! + dre.despesasMarketing[m]! + dre.despesasOperacionais[m]! + dre.outrasDespesasFixas[m]!;
        dre.ebitda[m] = dre.lucroBruto[m]! - totalDespesas;

        dre.depreciacao[m] = num(inv.depreciacao[m]);
        dre.ebit[m] = dre.ebitda[m]! - dre.depreciacao[m]!;
        dre.despesasFinanceiras[m] = num(emp.juros[m]) + num(divida.juros[m]);
        dre.lucroAntesImpostos[m] = dre.ebit[m]! - dre.despesasFinanceiras[m]!;
    });

    // IRPJ/CSLL pelo regime tributário (no Real, apurado no acumulado do ano).
    dre.irpjCsll = irpjCsllMensal(taxes, dre.receitaBruta, dre.lucroAntesImpostos);
    MONTHS.forEach(m => {
        dre.lucroLiquido[m] = dre.lucroAntesImpostos[m]! - num(dre.irpjCsll[m]);
    });

    const dfc: DFC2026 = { fco: {}, fci: {}, fcf: {}, variacaoCaixa: {}, saldoInicialCaixa: {}, saldoFinalCaixa: {} } as any;
    let currentCash = num(investment?.financing?.saldoCaixaFinal2025);

    MONTHS.forEach(m => {
        dfc.fco[m] = dre.ebitda[m]! - num(dre.irpjCsll[m]);
        // O CAPEX do ano base não entra mais: já foi gasto. Só os investimentos do ano do plano saem do caixa.
        dfc.fci[m] = num(inv.fci[m]);
        // Os juros saem aqui no FCF, e não no FCO (que parte do EBITDA), para não contar duas vezes.
        dfc.fcf[m] = num(emp.entradas[m]) + num(aportes[m])
            - num(emp.parcelas[m]) - num(divida.amortizacao[m]) - num(divida.juros[m]);

        dfc.variacaoCaixa[m] = dfc.fco[m]! + dfc.fci[m]! + dfc.fcf[m]!;
        dfc.saldoInicialCaixa[m] = currentCash;
        currentCash += dfc.variacaoCaixa[m]!;
        dfc.saldoFinalCaixa[m] = currentCash;
    });

    const bp: BP2026 = { caixa: {}, contasAReceber: {}, estoques: {}, ativoCirculante: {}, ativoNaoCirculante: {}, totalAtivos: {}, fornecedores: {}, emprestimosCurtoPrazo: {}, passivoCirculante: {}, emprestimosLongoPrazo: {}, passivoNaoCirculante: {}, capitalSocial: {}, lucrosAcumulados: {}, patrimonioLiquido: {}, totalPassivoPL: {} } as any;
    const capitalDeGiro = investment?.workingCapital;

    MONTHS.forEach(m => {
        bp.caixa[m] = dfc.saldoFinalCaixa[m];
        bp.contasAReceber[m] = dre.receitaBruta[m]! * (capitalDeGiro?.prazoMedioRecebimento || 30) / 30;
        bp.estoques[m] = dre.custosVariaveis[m]! * (capitalDeGiro?.prazoMedioEstocagem || 30) / 30;
        bp.ativoCirculante[m] = bp.caixa[m]! + bp.contasAReceber[m]! + bp.estoques[m]!;
        bp.ativoNaoCirculante[m] = num(inv.ativoNaoCirculante[m]);
        bp.totalAtivos[m] = bp.ativoCirculante[m]! + bp.ativoNaoCirculante[m]!;

        bp.fornecedores[m] = (dre.custosVariaveis[m]! + dre.despesasOperacionais[m]!) * (capitalDeGiro?.prazoMedioPagamento || 30) / 30;
        bp.emprestimosCurtoPrazo[m] = num(divida.curtoPrazo[m]) + num(emp.curtoPrazo[m]);
        bp.emprestimosLongoPrazo[m] = num(divida.longoPrazo[m]) + num(emp.longoPrazo[m]);
        bp.passivoCirculante[m] = bp.fornecedores[m]! + bp.emprestimosCurtoPrazo[m]!;
        bp.passivoNaoCirculante[m] = bp.emprestimosLongoPrazo[m];
        // O PL continua como fechamento; capital social e lucros acumulados seguem fora (fora do escopo).
        bp.patrimonioLiquido[m] = bp.totalAtivos[m]! - bp.passivoCirculante[m]! - bp.passivoNaoCirculante[m]!;
        bp.totalPassivoPL[m] = bp.passivoCirculante[m]! + bp.passivoNaoCirculante[m]! + bp.patrimonioLiquido[m]!;
    });

    return { dre, dfc, bp };
};

/** Custos variáveis da DRE: CMV + comissões + fretes + custos variáveis personalizados. */
export const custosVariaveisDaDre = (dre: Partial<DRE2026> | undefined): MonthlyData =>
    MONTHS.reduce((acc, m) => ({
        ...acc,
        [m]: num(dre?.custosVariaveis?.[m]) + num(dre?.outrosCustosVariaveis?.[m]),
    }), {} as MonthlyData);

/** Despesas fixas da DRE: folha + marketing + operacionais (com aluguel) + outras despesas fixas. */
export const despesasFixasDaDre = (dre: Partial<DRE2026> | undefined): MonthlyData =>
    MONTHS.reduce((acc, m) => ({
        ...acc,
        [m]: num(dre?.despesasFolha?.[m]) + num(dre?.despesasMarketing?.[m])
            + num(dre?.despesasOperacionais?.[m]) + num(dre?.outrasDespesasFixas?.[m]),
    }), {} as MonthlyData);
