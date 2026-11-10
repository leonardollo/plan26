import { MONTHS, MonthlyData, TaxesData } from '../../types';

// Lucro Real: IRPJ 15% + adicional de 10% sobre o que passar de R$ 20 mil/mês + CSLL 9% (Lei 9.249/95 e 9.430/96).
const IRPJ_ALIQUOTA = 0.15;
const IRPJ_ADICIONAL_ALIQUOTA = 0.10;
const IRPJ_ADICIONAL_LIMITE_MENSAL = 20000;
const CSLL_ALIQUOTA = 0.09;

type Regime = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';

/** null, undefined, NaN e string vazia valem 0. */
export const num = (valor: unknown): number => {
    const n = typeof valor === 'number' ? valor : parseFloat(String(valor ?? ''));
    return Number.isFinite(n) ? n : 0;
};

// Regime vazio ou desconhecido (planos antigos) conta como Simples, o padrão do app.
const regimeDe = (taxes: Partial<TaxesData>): Regime =>
    taxes.regimeTributario === 'Lucro Presumido' || taxes.regimeTributario === 'Lucro Real'
        ? taxes.regimeTributario
        : 'Simples Nacional';

/** Alíquota (em %) dos impostos sobre a receita bruta, sem IRPJ e CSLL fora do Simples. */
export const aliquotaDeducao = (taxes: Partial<TaxesData>): number => {
    const efetiva = num(taxes.aliquotaEfetiva);
    if (efetiva > 0) return efetiva;
    if (regimeDe(taxes) === 'Simples Nacional') return num(taxes.simplesNacional);
    // IRPJ e CSLL ficam de fora: no Presumido e no Real eles são calculados à parte.
    return num(taxes.iss) + num(taxes.icms) + num(taxes.pis) + num(taxes.cofins);
};

// Imposto do Lucro Real sobre uma base positiva acumulada em `meses` meses.
const irpjCsllLucroReal = (base: number, meses: number): number => {
    if (base <= 0) return 0;
    const adicional = Math.max(0, base - IRPJ_ADICIONAL_LIMITE_MENSAL * meses);
    return IRPJ_ALIQUOTA * base + IRPJ_ADICIONAL_ALIQUOTA * adicional + CSLL_ALIQUOTA * base;
};

const zerado = (): MonthlyData => MONTHS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {} as MonthlyData);

/** IRPJ + CSLL de cada mês pelo regime. Os 12 meses estão sempre presentes. */
export const irpjCsllMensal = (
    taxes: Partial<TaxesData>,
    receitaBruta: MonthlyData,
    lair: MonthlyData,
): MonthlyData => {
    const resultado = zerado();
    const regime = regimeDe(taxes);

    // Simples: o DAS já inclui IRPJ e CSLL.
    if (regime === 'Simples Nacional') return resultado;

    if (regime === 'Lucro Presumido') {
        // Com alíquota efetiva, IRPJ e CSLL já estão dentro dela.
        if (num(taxes.aliquotaEfetiva) > 0) return resultado;
        const aliquota = (num(taxes.irpj) + num(taxes.csll)) / 100;
        MONTHS.forEach(m => { resultado[m] = aliquota * num(receitaBruta?.[m]); });
        return resultado;
    }

    // Real: apuração anual com compensação de prejuízo no ano; o mês recebe a variação do acumulado.
    let lairAcumulado = 0;
    let impostoAnterior = 0;
    MONTHS.forEach((m, indice) => {
        lairAcumulado += num(lair?.[m]);
        const impostoAcumulado = irpjCsllLucroReal(lairAcumulado, indice + 1);
        resultado[m] = impostoAcumulado - impostoAnterior;
        impostoAnterior = impostoAcumulado;
    });
    return resultado;
};

/** IRPJ + CSLL do ano inteiro, como um único período de 12 meses. */
export const irpjCsllAnual = (
    taxes: Partial<TaxesData>,
    receitaBrutaAnual: number,
    lairAnual: number,
): number => {
    const regime = regimeDe(taxes);
    if (regime === 'Simples Nacional') return 0;
    if (regime === 'Lucro Presumido') {
        if (num(taxes.aliquotaEfetiva) > 0) return 0;
        return ((num(taxes.irpj) + num(taxes.csll)) / 100) * num(receitaBrutaAnual);
    }
    return irpjCsllLucroReal(num(lairAnual), MONTHS.length);
};

/** Lucro líquido de cada mês: LAIR menos IRPJ/CSLL do regime. */
export const lucroLiquidoMensal = (
    taxes: Partial<TaxesData>,
    receitaBruta: MonthlyData,
    lair: MonthlyData,
): MonthlyData => {
    const ir = irpjCsllMensal(taxes, receitaBruta, lair);
    return MONTHS.reduce((acc, m) => ({ ...acc, [m]: num(lair?.[m]) - (ir[m] ?? 0) }), {} as MonthlyData);
};
