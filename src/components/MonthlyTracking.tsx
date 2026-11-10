

import React, { useState, useMemo } from 'react';
import { usePlan } from '../hooks/usePlanData';
import { Month, MONTHS, MONTH_LABELS } from '../types';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import CurrencyInput from './shared/CurrencyInput';
import clsx from 'clsx';
import { resumoDoCenario } from '../utils/calculos/resumo';

const ForecastCard: React.FC<{ title: string; subtitle: string; value: number; ebitda: number; margin: number; color: string }> = ({ title, subtitle, value, ebitda, margin, color }) => (
    <div className={`p-5 rounded-2xl border-2 ${color} text-center`}>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        <p className="text-3xl font-extrabold text-gray-900 my-3">{formatCurrency(value, true)}</p>
        <div className="flex justify-center gap-4 text-sm text-gray-600">
            <div>
                <span className="text-xs text-gray-400">EBITDA</span>
                <p className="font-semibold">{formatCurrency(ebitda, true)}</p>
            </div>
            <div className="border-l border-gray-200 pl-4">
                <span className="text-xs text-gray-400">Margem</span>
                <p className="font-semibold">{formatPercentage(margin)}</p>
            </div>
        </div>
    </div>
);

const BarComparison: React.FC<{ label: string; projected: number; actual: number | null | undefined }> = ({ label, projected, actual }) => {
    const maxVal = Math.max(projected || 0, actual || 0, 1);
    const projWidth = projected > 0 ? (projected / maxVal) * 100 : 0;
    const actWidth = (actual || 0) > 0 ? ((actual || 0) / maxVal) * 100 : 0;
    
    return (
        <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span className="font-medium">{label}</span>
                <span>{actual != null ? formatCurrency(actual, true) : '-'} / {formatCurrency(projected, true)}</span>
            </div>
            <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                <div className="absolute h-full bg-blue-200 rounded-full transition-all" style={{ width: `${projWidth}%` }} />
                <div className={`absolute h-full rounded-full transition-all ${(actual || 0) > projected ? 'bg-green-400' : 'bg-orange-400'}`} style={{ width: `${actWidth}%` }} />
            </div>
            <div className="flex gap-3 text-[10px] text-gray-400 mt-0.5">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-200 rounded-full inline-block"></span>Projetado</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-400 rounded-full inline-block"></span>Realizado</span>
            </div>
        </div>
    );
};

const MonthlyTracking: React.FC = () => {
    const { tracking2026, scenarios2026, baseScenario, updateTracking2026, generateMonthlyAnalysis } = usePlan();
    const [selectedMonth, setSelectedMonth] = useState<Month>(MONTHS[0]);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

    const actual = tracking2026[selectedMonth] || { receitaRealizada: null, custosRealizados: null, despesasRealizadas: null, analysisText: null };
    const resumo = useMemo(() => resumoDoCenario(scenarios2026[baseScenario]?.projection), [scenarios2026, baseScenario]);
    const hasScenarioData = MONTHS.reduce((s, m) => s + (resumo.receita[m] || 0), 0) > 0;

    const projected = {
        receita: resumo.receita[selectedMonth] || 0,
        custos: resumo.custos[selectedMonth] || 0,
        despesas: resumo.despesas[selectedMonth] || 0,
    };
    
    const projectedEbitda = projected.receita - projected.custos - projected.despesas;
    const actualEbitda = (actual.receitaRealizada || 0) - (actual.custosRealizados || 0) - (actual.despesasRealizadas || 0);

    const getVariance = (actualVal?: number | null, projectedVal?: number | null) => {
        if (actualVal === undefined || actualVal === null || projectedVal === undefined || projectedVal === null) return { value: undefined, status: 'nodata' };
        if (projectedVal === 0) return { value: actualVal > 0 ? Infinity : 0, status: actualVal > 0 ? 'good' : 'neutral' };
        
        const variance = ((actualVal - projectedVal) / Math.abs(projectedVal)) * 100;
        let status: 'good' | 'bad' | 'neutral' = 'neutral';
        if (Math.abs(variance) <= 5) status = 'neutral';
        else if (variance > 5) status = 'good';
        else status = 'bad';

        return { value: variance, status };
    };
    
    const varianceReceita = getVariance(actual.receitaRealizada, projected.receita);
    const varianceCustos = getVariance(actual.custosRealizados, projected.custos);
    if (varianceCustos.status === 'good') varianceCustos.status = 'bad'; else if (varianceCustos.status === 'bad') varianceCustos.status = 'good';
    
    const varianceDespesas = getVariance(actual.despesasRealizadas, projected.despesas);
    if (varianceDespesas.status === 'good') varianceDespesas.status = 'bad'; else if (varianceDespesas.status === 'bad') varianceDespesas.status = 'good';

    const varianceEbitda = getVariance(actualEbitda, projectedEbitda);

    const projectedMC = projected.receita - projected.custos;
    const actualMC = (actual.receitaRealizada || 0) - (actual.custosRealizados || 0);
    const varianceMC = getVariance(actualMC, projectedMC);

    const projectedIMC = projected.receita > 0 ? projectedMC / projected.receita : 0;
    const projectedPE = projectedIMC > 0 ? projected.despesas / projectedIMC : 0;

    const actualIMC = (actual.receitaRealizada || 0) > 0 ? actualMC / (actual.receitaRealizada || 1) : 0;
    const actualPE = actualIMC > 0 ? (actual.despesasRealizadas || 0) / actualIMC : 0;
    const variancePE = getVariance(actualPE, projectedPE);
    if (variancePE.status === 'good') variancePE.status = 'bad'; else if (variancePE.status === 'bad') variancePE.status = 'good';


    const rows = [
        { label: 'Receita', actual: actual.receitaRealizada, projected: projected.receita, variance: varianceReceita },
        { label: 'Custos variáveis e impostos', actual: actual.custosRealizados, projected: projected.custos, variance: varianceCustos },
        { label: 'Margem de Contribuição', actual: actualMC, projected: projectedMC, variance: varianceMC, isBold: true },
        { label: 'Despesas Fixas', actual: actual.despesasRealizadas, projected: projected.despesas, variance: varianceDespesas },
        { label: 'EBITDA', actual: actualEbitda, projected: projectedEbitda, variance: varianceEbitda, isBold: true },
        { label: 'Ponto de Equilíbrio', actual: actualPE, projected: projectedPE, variance: variancePE },
    ];
    
    const yearEndSummary = useMemo(() => {
        const proj = { receita: 0, custos: 0, despesas: 0 };
        const actualYTD = { receita: 0, custos: 0, despesas: 0 };
        const forecast = { receita: 0, custos: 0, despesas: 0 };
        const selectedMonthIndex = MONTHS.indexOf(selectedMonth);

        if (!hasScenarioData) {
             const zeroMetrics = { ebitda: 0, margin: 0 };
             return {
                projected: { ...proj, ...zeroMetrics },
                actualYTD: { ...actualYTD, ...zeroMetrics },
                forecast: { ...forecast, ...zeroMetrics }
            };
        }

        MONTHS.forEach((month, index) => {
            const trackingMonthData = tracking2026[month];

            proj.receita += resumo.receita[month] || 0;
            proj.custos += resumo.custos[month] || 0;
            proj.despesas += resumo.despesas[month] || 0;

            if (trackingMonthData?.receitaRealizada != null) {
                 actualYTD.receita += trackingMonthData.receitaRealizada || 0;
                 actualYTD.custos += trackingMonthData.custosRealizados || 0;
                 actualYTD.despesas += trackingMonthData.despesasRealizadas || 0;
            }

            if (index <= selectedMonthIndex && trackingMonthData?.receitaRealizada != null) {
                forecast.receita += trackingMonthData.receitaRealizada || 0;
                forecast.custos += trackingMonthData.custosRealizados || 0;
                forecast.despesas += trackingMonthData.despesasRealizadas || 0;
            } else {
                forecast.receita += resumo.receita[month] || 0;
                forecast.custos += resumo.custos[month] || 0;
                forecast.despesas += resumo.despesas[month] || 0;
            }
        });

        const calcMetrics = (data: { receita: number, custos: number, despesas: number }) => {
            const ebitda = data.receita - data.custos - data.despesas;
            const margin = data.receita > 0 ? (ebitda / data.receita) * 100 : 0;
            return { ebitda, margin };
        };

        return {
            projected: { ...proj, ...calcMetrics(proj) },
            actualYTD: { ...actualYTD, ...calcMetrics(actualYTD) },
            forecast: { ...forecast, ...calcMetrics(forecast) }
        };

    }, [selectedMonth, tracking2026, resumo, hasScenarioData]);

    const handleGenerateAnalysis = async () => {
        setIsAnalysisLoading(true);
        await generateMonthlyAnalysis(selectedMonth);
        setIsAnalysisLoading(false);
    };

    // Conta quantos meses têm dados preenchidos
    const monthsWithData = MONTHS.filter(m => tracking2026[m]?.receitaRealizada != null).length;

    return (
        <div className="space-y-8">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gradient-border">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">12. Acompanhamento & Forecast</h1>
                <p className="text-gray-500 mt-2">
                    Acompanhe o realizado vs. projetado (cenário <span className="font-bold text-brand-orange">{baseScenario}</span>), analise desvios e crie uma previsão (Forecast) para o restante do ano.
                </p>
            </header>

            {/* Alerta se não há dados de cenário */}
            {!hasScenarioData && (
                <div className="p-6 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
                    <h3 className="text-lg font-bold text-yellow-800">Dados de cenário não encontrados</h3>
                    <p className="text-sm text-yellow-700 mt-2">
                        Para usar o acompanhamento, você precisa primeiro configurar os cenários na aba <strong>"9. Orçamento & Cenários"</strong>. 
                        Defina o crescimento e clique em "Recalcular Projeção" para gerar os dados projetados que serão comparados com o realizado aqui.
                    </p>
                </div>
            )}

            {/* Status dos meses preenchidos */}
            <div className="bg-white p-4 rounded-2xl shadow border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-600">Progresso de Preenchimento</h3>
                    <span className="text-xs text-gray-400">{monthsWithData} de 12 meses preenchidos</span>
                </div>
                <div className="flex gap-1">
                    {MONTHS.map(m => {
                        const hasData = tracking2026[m]?.receitaRealizada != null;
                        return (
                            <button 
                                key={m} 
                                onClick={() => setSelectedMonth(m)}
                                className={clsx(
                                    "flex-1 py-2 text-xs font-medium rounded transition-all",
                                    m === selectedMonth && "ring-2 ring-brand-orange ring-offset-1",
                                    hasData ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                                )}
                            >
                                {MONTH_LABELS[m].substring(0, 3)}
                            </button>
                        );
                    })}
                </div>
            </div>
            
            {/* Forecast Cards */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                <h2 className="text-lg font-bold text-gray-900 mb-2">Forecast Anual 2026</h2>
                <p className="text-sm text-gray-500 mb-4">O Forecast combina os dados realizados (até o mês selecionado) com os projetados (meses futuros) para estimar como o ano terminará.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ForecastCard title="Projetado (Ano)" subtitle="Meta do cenário base" value={yearEndSummary.projected.receita} ebitda={yearEndSummary.projected.ebitda} margin={yearEndSummary.projected.margin} color="border-blue-200 bg-blue-50/30" />
                    <ForecastCard title="Realizado (Acumulado)" subtitle={`${monthsWithData} meses preenchidos`} value={yearEndSummary.actualYTD.receita} ebitda={yearEndSummary.actualYTD.ebitda} margin={yearEndSummary.actualYTD.margin} color="border-green-200 bg-green-50/30" />
                    <ForecastCard title="Forecast (Ano)" subtitle="Realizado + Projeção futura" value={yearEndSummary.forecast.receita} ebitda={yearEndSummary.forecast.ebitda} margin={yearEndSummary.forecast.margin} color="border-orange-300 bg-orange-50/30" />
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                <div className="mb-6">
                    <label htmlFor="month-select" className="block text-sm font-medium text-gray-700">Selecione o Mês para Análise e Inserção de Dados</label>
                    <select
                        id="month-select"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value as Month)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-orange focus:border-brand-orange sm:text-sm rounded-md"
                    >
                        {MONTHS.map(m => <option key={m} value={m}>{MONTH_LABELS[m]}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Data Input */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">Dados Realizados de {MONTH_LABELS[selectedMonth]}</h2>
                        <p className="text-xs text-gray-500">Preencha os valores reais do mês. Use o formato brasileiro (ex: 1.500,00).</p>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Receita Realizada</label>
                            <CurrencyInput value={actual.receitaRealizada} onChange={v => updateTracking2026(selectedMonth, 'receitaRealizada', v)} className="mt-1 w-full p-2 border border-gray-300 rounded-md" placeholder="0" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Custos Variáveis Realizados</label>
                            {/* O projetado soma os impostos sobre vendas aos custos; o realizado precisa da mesma base. */}
                            <p className="text-xs text-gray-500">inclui impostos sobre vendas</p>
                            <CurrencyInput value={actual.custosRealizados} onChange={v => updateTracking2026(selectedMonth, 'custosRealizados', v)} className="mt-1 w-full p-2 border border-gray-300 rounded-md" placeholder="0" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Despesas Fixas Realizadas</label>
                            <CurrencyInput value={actual.despesasRealizadas} onChange={v => updateTracking2026(selectedMonth, 'despesasRealizadas', v)} className="mt-1 w-full p-2 border border-gray-300 rounded-md" placeholder="0" />
                        </div>

                        {/* Gráfico visual de barras */}
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                            <h3 className="text-sm font-bold text-gray-600 mb-3">Comparativo Visual - {MONTH_LABELS[selectedMonth]}</h3>
                            <BarComparison label="Receita" projected={projected.receita} actual={actual.receitaRealizada} />
                            <BarComparison label="Custos variáveis e impostos"projected={projected.custos} actual={actual.custosRealizados} />
                            <BarComparison label="Despesas Fixas" projected={projected.despesas} actual={actual.despesasRealizadas} />
                        </div>
                    </div>

                    {/* Comparison Table */}
                    <div>
                         <h2 className="text-lg font-bold text-gray-900 mb-4">Análise de Desvios Mensal</h2>
                         <table className="min-w-full">
                            <thead>
                                <tr className="border-b-2 border-gray-200">
                                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Métrica</th>
                                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Projetado</th>
                                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Realizado</th>
                                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Variação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {rows.map(row => (
                                    <tr key={row.label} className={clsx(row.isBold && "font-bold bg-gray-50")}>
                                        <td className="py-2 text-sm">{row.label}</td>
                                        <td className="text-right py-2 text-sm">{formatCurrency(row.projected)}</td>
                                        <td className="text-right py-2 text-sm">{row.actual != null ? formatCurrency(row.actual) : <span className="text-gray-300">-</span>}</td>
                                        <td className={clsx("text-right py-2 font-semibold text-sm", {
                                            'text-green-600': row.variance.status === 'good',
                                            'text-red-600': row.variance.status === 'bad',
                                            'text-gray-600': row.variance.status === 'neutral',
                                        })}>
                                            {row.variance.value !== undefined ? (row.variance.value === Infinity ? 'N/A' : formatPercentage(row.variance.value)) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>
                </div>

                 <div className="mt-8 border-t pt-6 space-y-4">
                    <div className="flex flex-wrap gap-4 justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900">Análise de Performance com IA</h2>
                        <button onClick={handleGenerateAnalysis} disabled={isAnalysisLoading} className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-brand-orange rounded-xl hover:bg-orange-700 transition-colors shadow-sm disabled:bg-gray-400">
                            {isAnalysisLoading ? 'Analisando...' : 'Gerar Análise com IA'}
                        </button>
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-md min-h-[150px] font-sans leading-relaxed">
                         {actual.analysisText || "Preencha os dados realizados do mês e clique em \"Gerar Análise com IA\" para que a IA (atuando como um CFO) análise o desempenho e sugira ações corretivas."}
                    </div>
                 </div>

            </div>
        </div>
    );
};

export default MonthlyTracking;
