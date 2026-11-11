import {
    MONTHS, Aporte2026, Emprestimo2026, Investimento2026, InvestmentData2025, InvestmentData2026, Month, MonthlyData,
} from '../../types';
import { num } from './impostos';

const zerado = (): MonthlyData => MONTHS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {} as MonthlyData);

// Mês vazio ou desconhecido vale janeiro.
const indiceDoMes = (mes: Month | null | undefined): number => Math.max(0, MONTHS.indexOf(mes ?? 'jan'));

// Valor vazio ou ≤ 0 faz a linha ser ignorada.
const valorPositivo = (valor: unknown): number => Math.max(0, num(valor));

// Juros negativos não fazem sentido num empréstimo; contam como 0.
const taxaMensal = (jurosMensalPct: unknown): number => Math.max(0, num(jurosMensalPct)) / 100;

const VIDA_UTIL_PADRAO_ANOS = 5;

export const investimento2026Vazio = (): InvestmentData2026 => ({
    investimentos: [], emprestimos: [], aportes: [], jurosDividaAtualPct: null,
});

/** Completa um bloco lido do Firestore (ausente ou parcial) sem perder o que já existe. */
export const normalizarInvestimento2026 = (lido: unknown): InvestmentData2026 => {
    const b = (lido && typeof lido === 'object' ? lido : {}) as Partial<Record<keyof InvestmentData2026, unknown>>;
    return {
        ...(b as object),
        investimentos: Array.isArray(b.investimentos) ? b.investimentos : [],
        emprestimos: Array.isArray(b.emprestimos) ? b.emprestimos : [],
        aportes: Array.isArray(b.aportes) ? b.aportes : [],
        jurosDividaAtualPct: typeof b.jurosDividaAtualPct === 'number' ? b.jurosDividaAtualPct : null,
    };
};

/** FCI (negativo), depreciação linear e ativo não circulante líquido dos investimentos do ano do plano. */
export const investimentos2026 = (itens: Investimento2026[] | undefined) => {
    const fci = zerado();
    const depreciacao = zerado();
    const ativoNaoCirculante = zerado();

    (itens || []).forEach(item => {
        const valor = valorPositivo(item?.valor);
        if (valor === 0) return;
        const compra = indiceDoMes(item?.mes);
        const vida = num(item?.vidaUtilAnos) > 0 ? num(item?.vidaUtilAnos) : VIDA_UTIL_PADRAO_ANOS;
        const mensal = valor / (vida * 12);

        fci[MONTHS[compra]] = fci[MONTHS[compra]]! - valor;
        let acumulada = 0;
        MONTHS.forEach((m, i) => {
            if (i < compra) return;
            // A depreciação começa no mês seguinte à compra e nunca passa do valor do bem.
            const doMes = i > compra ? Math.min(mensal, valor - acumulada) : 0;
            acumulada += doMes;
            depreciacao[m] = depreciacao[m]! + doMes;
            ativoNaoCirculante[m] = ativoNaoCirculante[m]! + (valor - acumulada);
        });
    });

    return { fci, depreciacao, ativoNaoCirculante };
};

// Nº de parcelas fracionado arredonda para baixo; menos de 1 parcela invalida a linha.
const nParcelas = (parcelas: unknown): number => Math.floor(num(parcelas));

/** Parcela da tabela Price. 0 quando o valor é ≤ 0 ou há menos de 1 parcela. */
export const parcelaPrice = (valor: number | null, jurosMensalPct: number | null, parcelas: number | null): number => {
    const p = valorPositivo(valor);
    const n = nParcelas(parcelas);
    if (p === 0 || n < 1) return 0;
    const i = taxaMensal(jurosMensalPct);
    if (i === 0) return p / n;
    return p * i / (1 - Math.pow(1 + i, -n));
};

/**
 * Empréstimos novos pela tabela Price, com a 1ª parcela no mês seguinte ao contrato.
 * Todos os valores são positivos; quem chama aplica o sinal. `curtoPrazo` e `longoPrazo` são saldos no fim do mês.
 */
export const emprestimosNovos = (itens: Emprestimo2026[] | undefined) => {
    const entradas = zerado();
    const juros = zerado();
    const parcelas = zerado();
    const curtoPrazo = zerado();
    const longoPrazo = zerado();

    (itens || []).forEach(item => {
        const valor = valorPositivo(item?.valor);
        const n = nParcelas(item?.parcelas);
        if (valor === 0 || n < 1) return;
        const contrato = indiceDoMes(item?.mes);
        const i = taxaMensal(item?.jurosMensalPct);
        const pmt = parcelaPrice(valor, item?.jurosMensalPct ?? null, n);

        // Cronograma só até dezembro do ano seguinte ao plano (índice 23): o ano do plano mais as 12 amortizações do curto prazo de dezembro.
        // Percorrer as n parcelas travaria a tela com n enorme; o saldo depois do horizonte é longo prazo.
        // amortizacao[k] e saldoApos[k] referem-se à parcela k, que vence no índice contrato + k.
        const horizonte = Math.min(n, 23 - contrato);
        const amortizacao: number[] = [0];
        const saldoApos: number[] = [valor];
        let saldo = valor;
        for (let k = 1; k <= horizonte; k++) {
            const jurosK = saldo * i;
            // A última parcela amortiza o saldo restante, para fechar em 0 sem resto de ponto flutuante.
            const amortK = k === n ? saldo : pmt - jurosK;
            saldo = k === n ? 0 : saldo - amortK;
            amortizacao.push(amortK);
            saldoApos.push(saldo);
            const indice = contrato + k;
            if (indice <= 11) {
                const m = MONTHS[indice];
                juros[m] = juros[m]! + jurosK;
                parcelas[m] = parcelas[m]! + jurosK + amortK;
            }
        }

        entradas[MONTHS[contrato]] = entradas[MONTHS[contrato]]! + valor;
        MONTHS.forEach((m, idx) => {
            if (idx < contrato) return;
            const pagas = Math.min(n, idx - contrato);
            const saldoFim = saldoApos[pagas];
            let curto = 0;
            for (let k = pagas + 1; k <= Math.min(n, pagas + 12); k++) curto += amortizacao[k];
            curtoPrazo[m] = curtoPrazo[m]! + curto;
            // Evita um −0,00 de ponto flutuante no Balanço; curto + longo continua igual ao saldo.
            longoPrazo[m] = longoPrazo[m]! + Math.max(0, saldoFim - curto);
        });
    });

    return { entradas, juros, parcelas, curtoPrazo, longoPrazo };
};

/**
 * Dívida que já existe em 31/12/25: o curto prazo é pago em 12 amortizações iguais (jan a dez);
 * o longo prazo fica parado o ano todo (simplificação aceita, sem reclassificação).
 * Juros sobre o saldo de curto prazo no início do mês + longo prazo, pagos no próprio mês.
 */
export const dividaAtual = (
    financing: Partial<InvestmentData2025['financing']> | undefined,
    jurosMensalPct: number | null | undefined,
) => {
    const juros = zerado();
    const amortizacao = zerado();
    const curtoPrazo = zerado();
    const longoPrazo = zerado();

    const cp = valorPositivo(financing?.financiamentoCurtoPrazo);
    const lp = valorPositivo(financing?.financiamentoLongoPrazo);
    const i = taxaMensal(jurosMensalPct);
    const parcela = cp / 12;

    let saldoCp = cp;
    MONTHS.forEach((m, idx) => {
        juros[m] = i * (saldoCp + lp);
        amortizacao[m] = parcela;
        // Em dezembro o curto prazo fecha em 0 exato.
        saldoCp = idx === 11 ? 0 : saldoCp - parcela;
        curtoPrazo[m] = saldoCp;
        longoPrazo[m] = lp;
    });

    return { juros, amortizacao, curtoPrazo, longoPrazo };
};

/** Aportes de sócios no mês informado (positivos). */
export const aportes2026 = (itens: Aporte2026[] | undefined): MonthlyData => {
    const r = zerado();
    (itens || []).forEach(item => {
        const valor = valorPositivo(item?.valor);
        if (valor === 0) return;
        const m = MONTHS[indiceDoMes(item?.mes)];
        r[m] = r[m]! + valor;
    });
    return r;
};
