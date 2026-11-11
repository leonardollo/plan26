
import React from 'react';
import { usePlan } from '../../hooks/usePlanData';
import ReportSection from './ReportSection';
import { formatCurrency } from '../../utils/formatters';
import type { DRE2026, DFC2026, BP2026 } from '../../types';

const FinancialStatementReportTable = <T extends Record<string, any>>({
    title,
    data,
    rows,
}: {
    title: string;
    data: T;
    rows: { key: keyof T, label: string, isBold?: boolean }[];
}) => {
    const { anoPlano } = usePlan();
    const calculateTotal = (rowKey: keyof T) => {
        const rowData = data[rowKey];
        if (!rowData || typeof rowData !== 'object') return 0;
        return Object.values(rowData).reduce((sum, val) => sum + (val as number || 0), 0);
    };

    return (
        <div className="mb-8">
            <h3 className="text-xl font-bold text-brand-dark mb-4">{title}</h3>
            <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="py-2 px-3 text-left font-semibold text-gray-600 w-2/3">Indicador</th>
                        <th className="py-2 px-3 text-right font-semibold text-gray-600">Total {anoPlano}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {rows.map(({ key, label, isBold }) => (
                        <tr key={key as string} className={isBold ? 'font-bold bg-gray-50' : ''}>
                            <td className="py-2 px-3 text-gray-800">{label}</td>
                            <td className="py-2 px-3 text-right font-semibold text-brand-dark">{formatCurrency(calculateTotal(key))}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const FinancialPlanReport: React.FC = () => {
    const { planData, baseScenario, anoPlano } = usePlan();
    const { dre, dfc, bp } = planData.financialPlan2026;

    const DRE_ROWS: { key: keyof DRE2026, label: string, isBold?: boolean }[] = [
        { key: 'receitaLiquida', label: 'Receita Líquida', isBold: true },
        { key: 'lucroBruto', label: 'Lucro Bruto', isBold: true },
        { key: 'ebitda', label: 'EBITDA', isBold: true },
        { key: 'lucroLiquido', label: 'Lucro Líquido', isBold: true },
    ];
    
    const DFC_ROWS: { key: keyof DFC2026, label: string, isBold?: boolean }[] = [
        { key: 'fco', label: 'Fluxo de Caixa Operacional (FCO)', isBold: true },
        { key: 'saldoFinalCaixa', label: 'Saldo Final de Caixa', isBold: true },
    ];

     const BP_ROWS: { key: keyof BP2026, label: string, isBold?: boolean }[] = [
        { key: 'totalAtivos', label: 'Total de Ativos', isBold: true },
        { key: 'totalPassivoPL', label: 'Total Passivo + PL', isBold: true },
        { key: 'patrimonioLiquido', label: 'Patrimônio Líquido', isBold: true },
    ];


    return (
        <ReportSection title={`Projeções Financeiras ${anoPlano} (Cenário ${baseScenario})`}>
            <FinancialStatementReportTable title="DRE (Demonstrativo de Resultados)" data={dre} rows={DRE_ROWS} />
            <FinancialStatementReportTable title="DFC (Demonstrativo de Fluxo de Caixa)" data={dfc} rows={DFC_ROWS} />
            <FinancialStatementReportTable title="BP (Balanço Patrimonial)" data={bp} rows={BP_ROWS} />
        </ReportSection>
    );
};

export default FinancialPlanReport;
