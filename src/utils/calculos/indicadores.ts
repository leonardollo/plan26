import { TaxesData } from '../../types';
import { irpjCsllAnual, num } from './impostos';

/** Lucro operacional depois do IRPJ/CSLL do regime (base do ROIC). */
export const nopat = (taxes: Partial<TaxesData>, receitaBrutaAnual: number, ebitdaAnual: number): number =>
    num(ebitdaAnual) - irpjCsllAnual(taxes, receitaBrutaAnual, ebitdaAnual);

/** Meses de lucro bruto por cliente para pagar o CAC; 0 quando não há lucro bruto. */
export const paybackCacMeses = (cac: number, ticketMedioMensal: number, margemBrutaPct: number): number => {
    // O ticket médio já é mensal: dividir por 12 de novo multiplicava o payback por 12.
    const lucroBrutoMensalPorCliente = num(ticketMedioMensal) * (num(margemBrutaPct) / 100);
    return lucroBrutoMensalPorCliente > 0 ? num(cac) / lucroBrutoMensalPorCliente : 0;
};
