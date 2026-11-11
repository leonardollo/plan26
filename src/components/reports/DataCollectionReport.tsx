
import React from 'react';
import { usePlan } from '../../hooks/usePlanData';
import ReportSection from './ReportSection';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

const DataCollectionReport: React.FC = () => {
    const { summary2025, anoBase } = usePlan();

    const metrics = [
        { label: "Receita Bruta Total", value: formatCurrency(summary2025.receitaBrutaTotal) },
        { label: "Receita Líquida Total", value: formatCurrency(summary2025.receitaTotal) },
        { label: "Custos Variáveis Totais", value: formatCurrency(summary2025.custosVariaveisTotal) },
        { label: "Custos Fixos Totais (Despesas)", value: formatCurrency(summary2025.custosFixosTotal) },
        { label: "Lucro Bruto", value: formatCurrency(summary2025.margemBruta) },
        { label: "Margem Bruta", value: formatPercentage(summary2025.margemBrutaPercent) },
        { label: "EBITDA", value: formatCurrency(summary2025.ebitda) },
        { label: "Margem EBITDA", value: formatPercentage(summary2025.margemEbitda) },
    ];

    return (
        <ReportSection title={`Resumo Financeiro ${anoBase}`}>
            <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-200">
                    {metrics.map(metric => (
                        <tr key={metric.label}>
                            <td className="py-3 font-medium text-gray-700 w-1/2">{metric.label}</td>
                            <td className="py-3 font-semibold text-gray-900 text-right">{metric.value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </ReportSection>
    );
};

export default DataCollectionReport;
