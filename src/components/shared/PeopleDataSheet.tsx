
import React from 'react';
import { PeopleData2025, Month, MONTHS, MONTH_LABELS } from '../../types';
import { formatCurrency, formatNumber, formatPercentage } from '../../utils/formatters';
import CurrencyInput from './CurrencyInput';
import { usePlan } from '../../hooks/usePlanData';

interface PeopleDataSheetProps {
  data: PeopleData2025;
  onUpdate: (section: keyof PeopleData2025, metric: string, month: Month, value: string) => void;
}

const PeopleDataSheet: React.FC<PeopleDataSheetProps> = ({ data, onUpdate }) => {
    const { anoBase } = usePlan();
    
    const sumMonthlyData = (monthlyData: { [key: string]: number | undefined }) => Object.values(monthlyData || {}).reduce((sum, val) => sum + (val || 0), 0);
    
    const getLastFilledValue = (monthlyData: { [key: string]: number | undefined }) => {
        // Look from December backwards to find the first non-null/non-undefined value
        for (let i = MONTHS.length - 1; i >= 0; i--) {
            const m = MONTHS[i];
            if (monthlyData && monthlyData[m] !== undefined && monthlyData[m] !== null && monthlyData[m] !== 0) {
                return monthlyData[m] || 0;
            }
        }
        // Fallback to December if everything is zero or return 0
        return monthlyData?.['dez'] || 0;
    };

    const avgMonthlyData = (monthlyData: { [key: string]: number | undefined }) => {
        const values = Object.values(monthlyData || {}).filter(v => v !== undefined);
        return values.length > 0 ? sumMonthlyData(monthlyData) / values.length : 0;
    }

    const renderInputRow = (section: keyof PeopleData2025, metric: string, label: string, hint: string, isCurrency = false) => {
        const metricData = (data[section] as any)[metric] || {};
        
        // LOGIC FIX: If it's the total headcount, use the last value. Otherwise, use sum.
        const isStockMetric = metric === 'totalColaboradores';
        const total = isStockMetric ? getLastFilledValue(metricData) : sumMonthlyData(metricData);
        
        const formatFn = isCurrency ? formatCurrency : formatNumber;
        
        return (
            <tr className="hover:bg-gray-50">
                <td className="sticky left-0 bg-inherit z-10 p-3 text-gray-800">{label}</td>
                <td className="p-3 text-gray-500 text-xs italic">{hint}</td>
                <td className="p-3 text-right font-semibold text-brand-dark bg-gray-50">
                    <div className="flex flex-col items-end">
                        <span>{formatFn(total)}</span>
                        {isStockMetric && <span className="text-[10px] text-gray-400 font-normal">(Fechamento)</span>}
                    </div>
                </td>
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
    
    const renderCalculatedRow = (label: string, hint: string, monthlyValues: (number|undefined)[], totalValue: number, formatFn: (v: number | undefined) => string = formatNumber) => {
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
    const monthlyTurnover = MONTHS.map(m => {
        const headcount = data.headcount?.totalColaboradores?.[m] || 0;
        const desligamentos = (data.headcount?.desligamentosVoluntarios?.[m] || 0) + (data.headcount?.desligamentosInvoluntarios?.[m] || 0);
        return headcount > 0 ? (desligamentos / headcount) * 100 : undefined;
    });
    const totalDesligamentos = sumMonthlyData(data.headcount?.desligamentosVoluntarios) + sumMonthlyData(data.headcount?.desligamentosInvoluntarios);
    const avgHeadcount = avgMonthlyData(data.headcount?.totalColaboradores);
    const totalTurnover = avgHeadcount > 0 ? (totalDesligamentos / avgHeadcount) * 100 : 0;
    
    const monthlySalarioMedio = MONTHS.map(m => {
        const folha = data.custos?.folhaTotalAnual?.[m] || 0;
        const headcount = data.headcount?.totalColaboradores?.[m] || 0;
        return headcount > 0 ? folha / headcount : undefined;
    });
    const totalFolha = sumMonthlyData(data.custos?.folhaTotalAnual);
    const totalSalarioMedio = avgHeadcount > 0 ? totalFolha / avgHeadcount / 12 : 0;
    
    const monthlyCustoColaborador = MONTHS.map(m => {
        const folha = data.custos?.folhaTotalAnual?.[m] || 0;
        const headcount = data.headcount?.totalColaboradores?.[m] || 0;
        return headcount > 0 ? folha / headcount : undefined;
    });
    const totalCustoColaboradorAno = avgHeadcount > 0 ? totalFolha / avgHeadcount : 0;

    const monthlyRoiTreinamento = MONTHS.map(m => {
        const ganho = data.treinamento?.ganhoTreinamento?.[m] || 0;
        const investimento = data.treinamento?.investimentoTD?.[m] || 0;
        return investimento > 0 ? (ganho / investimento) * 100 : undefined;
    });
    const totalInvestimento = sumMonthlyData(data.treinamento?.investimentoTD);
    const totalGanho = sumMonthlyData(data.treinamento?.ganhoTreinamento);
    const totalRoi = totalInvestimento > 0 ? (totalGanho / totalInvestimento) * 100 : 0;


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
                    {/* HEADCOUNT */}
                    <tr className="bg-orange-50"><td colSpan={15} className="p-2 font-bold text-orange-800">HEADCOUNT</td></tr>
                    {renderInputRow('headcount', 'totalColaboradores', 'Nº Total Colaboradores', 'Ponto final do mês (Dezembro no Total)')}
                    {renderInputRow('headcount', 'contratações', 'Nº Contratações', 'Entraram no ano')}
                    {renderInputRow('headcount', 'desligamentosVoluntarios', 'Nº Desligamentos Voluntários', 'Pediram para sair')}
                    {renderInputRow('headcount', 'desligamentosInvoluntarios', 'Nº Desligamentos Involuntários', 'Foram desligados')}
                    {renderCalculatedRow('Taxa Turnover (%)', '(Total Deslig./Headcount Médio)', monthlyTurnover, totalTurnover, (v) => formatPercentage(v))}

                    {/* CUSTOS */}
                    <tr className="bg-blue-50"><td colSpan={15} className="p-2 font-bold text-blue-800">CUSTOS</td></tr>
                    {renderInputRow('custos', 'folhaTotalAnual', 'Folha Total Anual (R$)', 'Salários + Encargos', true)}
                    {renderCalculatedRow('Salário Médio Mensal (R$)', 'Folha / Headcount', monthlySalarioMedio, totalSalarioMedio, (v) => formatCurrency(v))}
                    {renderCalculatedRow('Custo/Colaborador/Ano (R$)', 'Folha Total / Headcount Médio', monthlyCustoColaborador, totalCustoColaboradorAno, (v) => formatCurrency(v))}
                    
                    {/* TREINAMENTO */}
                    <tr className="bg-yellow-50"><td colSpan={15} className="p-2 font-bold text-yellow-800">TREINAMENTO</td></tr>
                    {renderInputRow('treinamento', 'investimentoTD', 'Investimento T&D (R$)', 'Treinamentos', true)}
                    {renderInputRow('treinamento', 'horasTreinamento', 'Horas de Treinamento', 'Total horas')}
                    {renderInputRow('treinamento', 'ganhoTreinamento', 'Ganho/Resultado do T&D (R$)', 'Ganhos gerados pelo investimento', true)}
                    {renderCalculatedRow('ROI Treinamento', '(Ganho / Investimento) * 100', monthlyRoiTreinamento, totalRoi, (v) => formatPercentage(v))}
                    
                    {/* CLIMA */}
                    <tr className="bg-green-50"><td colSpan={15} className="p-2 font-bold text-green-800">CLIMA</td></tr>
                    {renderInputRow('clima', 'taxaAbsenteismo', 'Taxa Absenteísmo (%)', '% faltas')}
                    {renderInputRow('clima', 'eNPS', 'eNPS', 'Satisfação equipe')}
                </tbody>
            </table>
        </div>
    );
};

export default PeopleDataSheet;
