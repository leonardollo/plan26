
import React from 'react';
import { MarketingData2025, Month, MONTHS, MONTH_LABELS, Summary2025, FinancialSheetData, CommercialData2025 } from '../../types';
import { formatCurrency, formatNumber, formatPercentage } from '../../utils/formatters';
import CurrencyInput from './CurrencyInput';
import { usePlan } from '../../hooks/usePlanData';

interface MarketingDataSheetProps {
  data: MarketingData2025;
  onUpdate: (section: keyof MarketingData2025, metric: string, month: Month, value: string) => void;
  summary: Summary2025;
  financialSheet: FinancialSheetData;
  commercial?: CommercialData2025;
}

const MarketingDataSheet: React.FC<MarketingDataSheetProps> = ({ data, onUpdate, summary, financialSheet, commercial }) => {
    const { anoBase } = usePlan();
    
    const sumMonthlyData = (monthlyData: { [key: string]: number | undefined }) => Object.values(monthlyData).reduce((sum, val) => sum + (val || 0), 0);

    const renderInputRow = (section: keyof MarketingData2025, metric: string, label: string, hint: string, isCurrency = true) => {
        const metricData = (data[section] as any)[metric];
        const total = sumMonthlyData(metricData);
        const formatFn = isCurrency ? formatCurrency : formatNumber;
        return (
            <tr className="hover:bg-gray-50">
                <td className="sticky left-0 bg-inherit z-10 p-3 text-gray-800">{label}</td>
                <td className="p-3 text-gray-500 text-xs italic">{hint}</td>
                <td className="p-3 text-right font-semibold text-gray-600">{formatFn(total)}</td>
                {MONTHS.map(month => (
                    <td key={month} className="p-0">
                        <CurrencyInput
                            value={metricData?.[month] ?? null}
                            onChange={(v) => onUpdate(section, metric, month, v)}
                            className="w-32 p-2 text-right border-none bg-transparent focus:ring-2 focus:ring-brand-orange focus:ring-inset"
                            placeholder="0"
                        />
                    </td>
                ))}
            </tr>
        );
    };
    
    const renderCalculatedRow = (label: string, hint: string, monthlyValues: (number|undefined)[], totalValue: number, isPercentage = false) => {
        const formatFn = isPercentage ? (v: number | undefined) => formatPercentage(v) : (v: number | undefined) => formatCurrency(v, false);
        return (
             <tr className="bg-gray-50 font-semibold">
                <td className="sticky left-0 bg-inherit z-10 p-3 text-gray-800">{label}</td>
                <td className="p-3 text-gray-500 text-xs italic">{hint}</td>
                <td className="p-3 text-right text-brand-dark font-bold">{formatFn(totalValue)}</td>
                {monthlyValues.map((value, index) => (
                    <td key={MONTHS[index]} className="p-2 text-right text-sm text-gray-700">
                        {value !== undefined ? formatFn(value) : '-'}
                    </td>
                ))}
            </tr>
        )
    }

     const renderPerformanceRow = (label: string, hint: string, value: number, monthlyValues: (number|undefined)[], formatFn: (v: number) => string) => {
        return (
             <tr className="bg-gray-50 font-semibold">
                <td className="sticky left-0 bg-inherit z-10 p-3 text-gray-800">{label}</td>
                <td className="p-3 text-gray-500 text-xs italic">{hint}</td>
                <td className="p-3 text-right text-brand-dark font-bold">{formatFn(value)}</td>
                {MONTHS.map((month, index) => (
                    <td key={month} className="p-2 text-right text-sm text-gray-700">
                        {monthlyValues[index] !== undefined && monthlyValues[index] !== Infinity && !isNaN(monthlyValues[index]!) ? formatFn(monthlyValues[index]!) : '-'}
                    </td>
                ))}
            </tr>
        )
     }

    // --- Calculations ---
    const monthlyPercentReceita = MONTHS.map(m => {
        const invest = data.investimentos.investimentoTotal[m] || 0;
        const receita = financialSheet.receitaBruta.values2025[m] || 0;
        return receita > 0 ? (invest / receita) * 100 : undefined;
    });
    const totalPercentReceita = summary.receitaBrutaTotal > 0 ? (summary.investimentoMarketingTotal / summary.receitaBrutaTotal) * 100 : 0;
    
    const monthlyClicks = data.performance?.cliques || {};
    const monthlyImpressoes = data.performance?.impressoes || {};
    const monthlyConversoes = data.performance?.conversoes || {};
    const monthlyMidiaPaga = data.investimentos.midiaPaga;

    const totalClicks = sumMonthlyData(monthlyClicks);
    const totalImpressoes = sumMonthlyData(monthlyImpressoes);
    const totalConversoes = sumMonthlyData(monthlyConversoes);
    const totalMidiaPaga = sumMonthlyData(monthlyMidiaPaga);

    const monthlyCtr = MONTHS.map(m => {
        const clicks = monthlyClicks[m] || 0;
        const impressoes = monthlyImpressoes[m] || 0;
        return impressoes > 0 ? (clicks / impressoes) * 100 : undefined;
    });
    const totalCtr = totalImpressoes > 0 ? (totalClicks / totalImpressoes) * 100 : 0;

    const monthlyCpc = MONTHS.map(m => {
        const custo = monthlyMidiaPaga[m] || 0;
        const clicks = monthlyClicks[m] || 0;
        return clicks > 0 ? custo / clicks : undefined;
    });
    const totalCpc = totalClicks > 0 ? totalMidiaPaga / totalClicks : 0;
    
    const monthlyCpa = MONTHS.map(m => {
        const custo = monthlyMidiaPaga[m] || 0;
        const conversoes = monthlyConversoes[m] || 0;
        return conversoes > 0 ? custo / conversoes : undefined;
    });
    const totalCpa = totalConversoes > 0 ? totalMidiaPaga / totalConversoes : 0;

    // Monthly Performance Calculations
    const monthlyCac = MONTHS.map(m => {
        const invest = data.investimentos.investimentoTotal[m] || 0;
        // Use data from Commercial tab if available
        const novosClientes = commercial?.clientes.novosClientes[m] || 0;
        return novosClientes > 0 ? invest / novosClientes : undefined;
    });

    const monthlyLtvCac = MONTHS.map((m, i) => {
        const cac = monthlyCac[i];
        if (!cac || cac === 0) return undefined;
        // Using average annual LTV for monthly estimation simplicity
        return summary.ltv / cac;
    });

    const monthlyRoi = MONTHS.map(m => {
        const invest = data.investimentos.investimentoTotal[m] || 0;
        const receita = financialSheet.receitaBruta.values2025[m] || 0;
        return invest > 0 ? ((receita - invest) / invest) * 100 : undefined;
    });

    return (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-600">
                    <tr>
                        <th className="sticky left-0 bg-gray-100 z-10 p-3 text-left font-semibold" style={{width: '250px'}}>Indicador</th>
                        <th className="p-3 text-left font-semibold">Instruções</th>
                        <th className="p-3 text-right font-semibold">Total {anoBase}</th>
                        {MONTHS.map(m => <th key={`25-${m}`} className="p-2 text-center font-medium">{MONTH_LABELS[m]}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {/* INVESTIMENTOS */}
                    <tr className="bg-orange-50"><td colSpan={15} className="p-2 font-bold text-orange-800">INVESTIMENTOS</td></tr>
                    {renderInputRow('investimentos', 'investimentoTotal', 'Investimento Total (R$)', 'Gasto total marketing')}
                    {renderCalculatedRow('% da Receita', '(Invest / Receita)', monthlyPercentReceita, totalPercentReceita, true)}
                    {renderInputRow('investimentos', 'midiaPaga', 'Mídia Paga (R$)', 'Ads')}
                    {renderInputRow('investimentos', 'conteudo', 'Conteúdo (R$)', 'Blog, vídeos')}

                    {/* PERFORMANCE DE MARKETING DIGITAL */}
                    <tr className="bg-green-50"><td colSpan={15} className="p-2 font-bold text-green-800">PERFORMANCE DE MARKETING DIGITAL</td></tr>
                    {renderInputRow('performance', 'impressoes', 'Impressões', 'Nº de vezes que o anúncio foi visto', false)}
                    {renderInputRow('performance', 'cliques', 'Cliques', 'Nº de cliques nos anúncios', false)}
                    {renderCalculatedRow('CTR (%)', '(Cliques / Impressões)', monthlyCtr, totalCtr, true)}
                    {renderCalculatedRow('CPC (R$)', '(Custo Mídia Paga / Cliques)', monthlyCpc, totalCpc)}
                    {renderInputRow('performance', 'conversoes', 'Conversões (Leads)', 'Leads gerados via marketing', false)}
                    {renderCalculatedRow('CPA (R$)', '(Custo Mídia Paga / Conversões)', monthlyCpa, totalCpa)}

                    {/* PERFORMANCE GERAL */}
                    <tr className="bg-blue-50"><td colSpan={15} className="p-2 font-bold text-blue-800">PERFORMANCE GERAL</td></tr>
                    {renderPerformanceRow('CAC (R$)', 'Invest. Total / Novos Clientes (Comercial)', summary.cac, monthlyCac, formatCurrency)}
                    {renderPerformanceRow('Relação LTV/CAC', 'Ideal: >3', summary.relacaoLtvCac, monthlyLtvCac, (v) => `${formatNumber(v, false)}x`)}
                    {renderPerformanceRow('ROI Marketing (%)', '(Receita - Invest) / Invest', summary.roiMarketing * 100, monthlyRoi, (v) => formatPercentage(v))}
                </tbody>
            </table>
        </div>
    );
};

export default MarketingDataSheet;
