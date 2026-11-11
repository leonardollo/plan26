
import React from 'react';
import { CommercialData2025, Month, MONTHS, MONTH_LABELS } from '../../types';
import { formatCurrency, formatNumber, formatPercentage } from '../../utils/formatters';
import CurrencyInput from './CurrencyInput';
import { usePlan } from '../../hooks/usePlanData';

interface CommercialDataSheetProps {
  data: CommercialData2025;
  onUpdate: (section: keyof CommercialData2025, metric: string, month: Month, value: string) => void;
}

const CommercialDataSheet: React.FC<CommercialDataSheetProps> = ({ data, onUpdate }) => {
    const { anoBase } = usePlan();
    
    const sumMonthlyData = (monthlyData: { [key: string]: number | undefined }) => Object.values(monthlyData || {}).reduce((sum, val) => sum + (val || 0), 0);

    const renderInputRow = (section: keyof CommercialData2025, metric: string, label: string, hint: string) => {
        const metricData = (data[section] as any)[metric] || {};
        const total = sumMonthlyData(metricData);
        return (
            <tr className="hover:bg-gray-50">
                <td className="sticky left-0 bg-inherit z-10 p-3 text-gray-800">{label}</td>
                <td className="p-3 text-gray-500 text-xs italic">{hint}</td>
                <td className="p-3 text-right font-semibold text-gray-600">{formatNumber(total)}</td>
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
        const formatFn = isPercentage ? formatPercentage : formatNumber;
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

    // --- Calculations ---
    const monthlyRetention = MONTHS.map(m => {
        const total = data.clientes?.totalClientesAtivos?.[m] || 0;
        const lost = data.clientes?.clientesPerdidos?.[m] || 0;
        return total > 0 ? ((total - lost) / total) * 100 : undefined;
    });
    const totalClientesSum = sumMonthlyData(data.clientes?.totalClientesAtivos);
    const totalPerdidosSum = sumMonthlyData(data.clientes?.clientesPerdidos);
    const totalRetention = totalClientesSum > 0 ? ((totalClientesSum - totalPerdidosSum) / totalClientesSum) * 100 : 100;

    const monthlyConversion = MONTHS.map(m => {
        const leads = data.funilComercial?.leadsGerados?.[m] || 0;
        const sales = data.funilComercial?.vendasFechadas?.[m] || 0;
        return leads > 0 ? (sales / leads) * 100 : undefined;
    });
    const totalLeads = sumMonthlyData(data.funilComercial?.leadsGerados);
    const totalSales = sumMonthlyData(data.funilComercial?.vendasFechadas);
    const totalConversion = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;


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
                    {/* CLIENTES */}
                    <tr className="bg-orange-50"><td colSpan={15} className="p-2 font-bold text-orange-800">CLIENTES</td></tr>
                    {renderInputRow('clientes', 'totalClientesAtivos', 'Nº Total Clientes Ativos', 'Quantos clientes p/ mês')}
                    {renderInputRow('clientes', 'novosClientes', 'Nº Clientes Novos', 'Conquistados no mês')}
                    {renderInputRow('clientes', 'clientesPerdidos', 'Nº Clientes Perdidos', 'Churn')}
                    {renderCalculatedRow('Taxa de Retenção (%)', '(Ficaram / Total) * 100', monthlyRetention, totalRetention, true)}

                    {/* FUNIL COMERCIAL */}
                    <tr className="bg-blue-50"><td colSpan={15} className="p-2 font-bold text-blue-800">FUNIL COMERCIAL</td></tr>
                    {renderInputRow('funilComercial', 'leadsGerados', 'Nº Leads Gerados', 'Total de leads')}
                    {renderInputRow('funilComercial', 'leadsQualificados', 'Nº Leads Qualificados', 'Leads com fit')}
                    {renderInputRow('funilComercial', 'propostasEnviadas', 'Nº Propostas Enviadas', '')}
                    {renderInputRow('funilComercial', 'vendasFechadas', 'Nº Vendas Fechadas', '')}
                    {renderCalculatedRow('Taxa Conversão Lead->Cliente (%)', '(Vendas / Leads) * 100', monthlyConversion, totalConversion, true)}
                    
                    {/* PIPELINE */}
                    <tr className="bg-yellow-50"><td colSpan={15} className="p-2 font-bold text-yellow-800">PIPELINE</td></tr>
                    {renderInputRow('pipeline', 'pipelineAtual', 'Pipeline Atual (R$)', 'Valor em aberto')}
                    {renderInputRow('pipeline', 'ticketMedioPipeline', 'Ticket Médio Pipeline (R$)', '')}
                    {renderInputRow('pipeline', 'cicloVendas', 'Ciclo de Vendas (dias)', 'Lead até fechar')}
                </tbody>
            </table>
        </div>
    );
};

export default CommercialDataSheet;
