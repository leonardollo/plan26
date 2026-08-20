
import React, { useState, useMemo } from 'react';
import { usePlan } from '../hooks/usePlanData';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';
import CurrencyInput from './shared/CurrencyInput';
import clsx from 'clsx';

const KpiCard: React.FC<{
    title: string;
    value: string;
    icon: React.ReactNode;
    color: 'orange' | 'blue' | 'green' | 'red' | 'purple' | 'yellow';
    note?: string;
}> = ({ title, value, icon, color, note }) => {
    const colorMap = {
        orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600', border: 'border-orange-100' },
        blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', border: 'border-blue-100' },
        green: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', border: 'border-emerald-100' },
        red: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600', border: 'border-red-100' },
        purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', border: 'border-purple-100' },
        yellow: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', border: 'border-amber-100' },
    };
    const c = colorMap[color];
    return (
        <div className={clsx("bg-white p-5 rounded-2xl shadow-sm border hover:shadow-lg transition-all duration-300 card-hover gradient-border", c.border)}>
            <div className="flex items-center justify-between mb-3">
                <div className={clsx("p-2.5 rounded-xl", c.icon)}>
                    {icon}
                </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}</p>
            <p className="text-sm font-medium text-gray-500 mt-1">{title}</p>
            {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
        </div>
    );
};

const MarketComparison: React.FC = () => {
    const { summary2025 } = usePlan();

    const benchmarks = [
        { 
            label: 'Margem EBITDA', 
            user: summary2025.margemEbitda, 
            avg: 25, top10: 40, 
            format: (v: number) => formatPercentage(v),
            higherBetter: true 
        },
        { 
            label: 'Custo de Aquisição (CAC)', 
            user: summary2025.cac, 
            avg: 1200, top10: 800, 
            format: (v: number) => formatCurrency(v),
            higherBetter: false 
        },
        { 
            label: 'LTV / CAC', 
            user: summary2025.relacaoLtvCac, 
            avg: 3, top10: 10, 
            format: (v: number) => `${formatNumber(v)}x`,
            higherBetter: true 
        },
    ];

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Desempenho vs. Mercado</h2>
            <p className="text-xs text-gray-400 mb-5">Compare seus indicadores com benchmarks do setor</p>
            <div className="space-y-5">
                {benchmarks.map(b => {
                    const maxVal = Math.max(b.user, b.avg, b.top10) * 1.2 || 1;
                    const userPct = (Math.abs(b.user) / maxVal) * 100;
                    const avgPct = (Math.abs(b.avg) / maxVal) * 100;
                    const isGood = b.higherBetter ? b.user >= b.avg : b.user <= b.avg;
                    
                    return (
                        <div key={b.label}>
                            <div className="flex justify-between items-baseline mb-1.5">
                                <span className="text-sm font-semibold text-gray-700">{b.label}</span>
                                <span className={clsx("text-sm font-bold", isGood ? "text-emerald-600" : "text-red-500")}>
                                    {b.format(b.user)}
                                </span>
                            </div>
                            <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    className={clsx("absolute h-full rounded-full transition-all", isGood ? "bg-emerald-400" : "bg-red-400")}
                                    style={{ width: `${Math.min(userPct, 100)}%` }}
                                />
                                <div 
                                    className="absolute h-full w-0.5 bg-gray-400"
                                    style={{ left: `${Math.min(avgPct, 100)}%` }}
                                    title={`Media: ${b.format(b.avg)}`}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                                <span>Media do setor: {b.format(b.avg)}</span>
                                <span>Top 10%: {b.format(b.top10)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SimInput: React.FC<{ label: string, value: number, onChange: (v: number) => void, prefix?: string, suffix?: string, disabled: boolean }> = ({ label, value, onChange, prefix, suffix, disabled }) => (
    <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
        <div className="relative">
            {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm z-10">{prefix}</span>}
            <CurrencyInput value={value} onChange={(v) => onChange(parseFloat(v) || 0)} disabled={disabled} className={clsx("w-full p-2.5 border border-gray-200 rounded-xl text-sm text-center bg-white disabled:bg-gray-50 disabled:cursor-not-allowed focus:border-brand-orange", prefix && 'pl-8', suffix && 'pr-12')} />
            {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs z-10">{suffix}</span>}
        </div>
    </div>
);

const ResultRow: React.FC<{ label: string, baseValue: string, simValue: string, growth: number, higherIsBetter: boolean }> = ({ label, baseValue, simValue, growth, higherIsBetter }) => {
     const isPositive = growth >= 0;
     const isGood = (higherIsBetter && isPositive) || (!higherIsBetter && !isPositive);
     return (
         <tr className="border-t border-gray-100">
            <td className="py-3 font-medium text-gray-600 text-sm">{label}</td>
            <td className="py-3 text-right text-gray-400 text-sm">{baseValue}</td>
            <td className="py-3 text-right font-bold text-gray-900 text-sm">{simValue}</td>
            <td className={clsx("py-3 text-right font-bold text-sm", isGood ? 'text-emerald-600' : 'text-red-500')}>
                {isPositive ? '+' : ''}{formatPercentage(growth)}
            </td>
         </tr>
     );
};

const WhatIfSimulator: React.FC = () => {
    const { summary2025 } = usePlan();

    const [simTicket, setSimTicket] = useState(0);
    const [simNewHires, setSimNewHires] = useState(0);
    const [simMarketing, setSimMarketing] = useState(0);
    const [simVarCostReduction, setSimVarCostReduction] = useState(0);
    
    const isEnabled = summary2025 && summary2025.receitaBrutaTotal > 0;

    const simulation = useMemo(() => {
        if (!isEnabled) return null;
        const base = summary2025;
        const newCustomersFromMarketing = base.cac > 0 ? simMarketing / base.cac : 0;
        const newTicketMedio = base.ticketMedio * (1 + simTicket / 100);
        const simulatedGrossRevenue = base.receitaBrutaTotal * (1 + simTicket / 100) + (newCustomersFromMarketing * newTicketMedio);
        const baseVarCostRate = base.custosVariaveisTotal / base.receitaBrutaTotal;
        const newVarCostRate = baseVarCostRate * (1 - simVarCostReduction / 100);
        const simulatedVarCosts = simulatedGrossRevenue * newVarCostRate;
        const simulatedFixedCosts = base.custosFixosTotal + (simNewHires * (base.custoColaboradorAno || 90000)) + simMarketing;
        const taxRate = base.receitaBrutaTotal > 0 ? (base.receitaBrutaTotal - base.receitaTotal) / base.receitaBrutaTotal : 0;
        const simulatedNetRevenue = simulatedGrossRevenue * (1 - taxRate);
        const simulatedEBITDA = simulatedNetRevenue - simulatedVarCosts - simulatedFixedCosts;
        const simulatedEBITDAMargin = simulatedNetRevenue > 0 ? (simulatedEBITDA / simulatedNetRevenue) * 100 : 0;
        const totalNewCustomers = base.novosClientesTotal + newCustomersFromMarketing;
        const totalMarketingInvestment = base.investimentoMarketingTotal + simMarketing;
        const simulatedCAC = totalNewCustomers > 0 ? totalMarketingInvestment / totalNewCustomers : 0;
        return { simulatedNetRevenue, simulatedEBITDA, simulatedEBITDAMargin, simulatedCAC, totalNewCustomers };
    }, [isEnabled, summary2025, simTicket, simNewHires, simMarketing, simVarCostReduction]);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-purple-100 rounded-xl">
                    <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Simulador What-If</h2>
                    <p className="text-xs text-gray-400">Análise o impacto de diferentes alavancas no resultado de 2026</p>
                </div>
            </div>
            {!isEnabled && (
                <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 mt-4">
                    <svg className="h-10 w-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="font-semibold text-gray-600">Preencha os dados de Receita de 2025</p>
                    <p className="text-sm text-gray-400 mt-1">Va para "Coleta de Dados" e insira a Receita Bruta</p>
                </div>
            )}
            <div className={clsx("grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4", !isEnabled && "opacity-30 pointer-events-none")}>
                <div className="space-y-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="font-bold text-sm text-gray-700">Alavancas de Crescimento</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <SimInput label="Aumentar Ticket Medio" value={simTicket} onChange={setSimTicket} suffix="%" disabled={!isEnabled} />
                        <SimInput label="Reduzir Custo Variavel" value={simVarCostReduction} onChange={setSimVarCostReduction} suffix="%" disabled={!isEnabled} />
                        <SimInput label="Novas Contratações" value={simNewHires} onChange={setSimNewHires} suffix="pessoas" disabled={!isEnabled} />
                        <SimInput label="Investimento em Marketing" value={simMarketing} onChange={setSimMarketing} prefix="R$" disabled={!isEnabled} />
                    </div>
                </div>
                 <div>
                    <h3 className="font-bold text-sm text-gray-700 mb-2">Resultados Projetados</h3>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-400 text-xs">
                                <th className="text-left font-medium py-2">Metrica</th>
                                <th className="text-right font-medium py-2">2025</th>
                                <th className="text-right font-medium py-2">Simulado</th>
                                <th className="text-right font-medium py-2">Variacao</th>
                            </tr>
                        </thead>
                        <tbody>
                            {simulation && (
                                <>
                                    <ResultRow label="Receita Liquida" baseValue={formatCurrency(summary2025.receitaTotal, true)} simValue={formatCurrency(simulation.simulatedNetRevenue, true)} growth={summary2025.receitaTotal > 0 ? (simulation.simulatedNetRevenue / summary2025.receitaTotal - 1) * 100 : 0} higherIsBetter={true} />
                                    <ResultRow label="EBITDA" baseValue={formatCurrency(summary2025.ebitda, true)} simValue={formatCurrency(simulation.simulatedEBITDA, true)} growth={summary2025.ebitda !== 0 ? (simulation.simulatedEBITDA / summary2025.ebitda - 1) * 100 : 0} higherIsBetter={true} />
                                    <ResultRow label="Margem EBITDA" baseValue={formatPercentage(summary2025.margemEbitda)} simValue={formatPercentage(simulation.simulatedEBITDAMargin)} growth={simulation.simulatedEBITDAMargin - summary2025.margemEbitda} higherIsBetter={true} />
                                    <ResultRow label="Novos Clientes" baseValue={formatNumber(summary2025.novosClientesTotal)} simValue={formatNumber(simulation.totalNewCustomers)} growth={summary2025.novosClientesTotal > 0 ? (simulation.totalNewCustomers / summary2025.novosClientesTotal - 1) * 100 : 0} higherIsBetter={true} />
                                    <ResultRow label="CAC" baseValue={formatCurrency(summary2025.cac)} simValue={formatCurrency(simulation.simulatedCAC)} growth={summary2025.cac > 0 ? (simulation.simulatedCAC / summary2025.cac - 1) * 100 : 0} higherIsBetter={false} />
                                </>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );
};

const FinancialAlerts: React.FC = () => {
    const { summary2025 } = usePlan();
    
    const alerts = useMemo(() => {
        const list: { type: 'danger' | 'warning' | 'success'; title: string; message: string; }[] = [];
        const hasData = summary2025.receitaBrutaTotal > 0;
        if (!hasData) return list;

        // Margem EBITDA
        if (summary2025.margemEbitda < 5) {
            list.push({ type: 'danger', title: 'Margem EBITDA Critica', message: `Sua margem EBITDA esta em ${formatPercentage(summary2025.margemEbitda)}. Abaixo de 5% indica risco operacional grave. Revise custos fixos e variaveis urgentemente.` });
        } else if (summary2025.margemEbitda < 10) {
            list.push({ type: 'warning', title: 'Margem EBITDA Baixa', message: `Sua margem EBITDA esta em ${formatPercentage(summary2025.margemEbitda)}. O ideal e acima de 15%. Busque otimizar custos ou aumentar precos.` });
        } else if (summary2025.margemEbitda >= 20) {
            list.push({ type: 'success', title: 'Margem EBITDA Saudavel', message: `Sua margem EBITDA de ${formatPercentage(summary2025.margemEbitda)} esta excelente. Continue monitorando para manter esse nivel.` });
        }

        // LTV/CAC
        if (summary2025.relacaoLtvCac > 0 && summary2025.relacaoLtvCac < 2) {
            list.push({ type: 'danger', title: 'LTV/CAC Insustentavel', message: `Relação LTV/CAC de ${formatNumber(summary2025.relacaoLtvCac)}x. Abaixo de 2x significa que você gasta mais para adquirir clientes do que eles geram de valor.` });
        } else if (summary2025.relacaoLtvCac >= 2 && summary2025.relacaoLtvCac < 3) {
            list.push({ type: 'warning', title: 'LTV/CAC Precisa Melhorar', message: `Relação LTV/CAC de ${formatNumber(summary2025.relacaoLtvCac)}x. O ideal e acima de 3x. Invista em retencao ou reduza o custo de aquisição.` });
        }

        // Ponto de Equilibrio (mensal) vs Receita Media mensal — ambos no mesmo período
        const receitaMediaMensal = summary2025.receitaTotal / 12;
        if (summary2025.pontoEquilibrioContabil > 0 && receitaMediaMensal > 0) {
            const peRatio = summary2025.pontoEquilibrioContabil / receitaMediaMensal;
            if (peRatio > 1) {
                list.push({ type: 'danger', title: 'Abaixo do Ponto de Equilibrio', message: `Sua receita media mensal (${formatCurrency(receitaMediaMensal, true)}) esta abaixo do ponto de equilibrio (${formatCurrency(summary2025.pontoEquilibrioContabil, true)}). A empresa esta operando no prejuízo.` });
            } else if (peRatio > 0.85) {
                list.push({ type: 'warning', title: 'Proximo do Ponto de Equilibrio', message: `Sua receita media mensal esta apenas ${formatPercentage((1 - peRatio) * 100)} acima do ponto de equilibrio. Margem de seguranca muito baixa.` });
            }
        }

        // Concentracao de custos fixos
        if (summary2025.receitaTotal > 0) {
            const fixedCostRatio = (summary2025.despesasTotal / summary2025.receitaTotal) * 100;
            if (fixedCostRatio > 60) {
                list.push({ type: 'danger', title: 'Custos Fixos Elevados', message: `Custos fixos representam ${formatPercentage(fixedCostRatio)} da receita liquida. Acima de 60% reduz drasticamente a flexibilidade financeira.` });
            } else if (fixedCostRatio > 45) {
                list.push({ type: 'warning', title: 'Custos Fixos Altos', message: `Custos fixos representam ${formatPercentage(fixedCostRatio)} da receita liquida. Considere renegociar contratos ou terceirizar atividades nao-essenciais.` });
            }
        }

        return list;
    }, [summary2025]);

    if (alerts.length === 0) return null;

    const iconMap = {
        danger: <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>,
        warning: <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        success: <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    };
    const bgMap = { danger: 'bg-red-50 border-red-100', warning: 'bg-amber-50 border-amber-100', success: 'bg-emerald-50 border-emerald-100' };
    const titleColorMap = { danger: 'text-red-700', warning: 'text-amber-700', success: 'text-emerald-700' };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                <h3 className="text-sm font-bold text-gray-600">Alertas Financeiros</h3>
            </div>
            {alerts.map((alert, i) => (
                <div key={i} className={clsx("flex items-start gap-3 p-3.5 rounded-xl border", bgMap[alert.type])}>
                    <div className="flex-shrink-0 mt-0.5">{iconMap[alert.type]}</div>
                    <div>
                        <p className={clsx("text-sm font-bold", titleColorMap[alert.type])}>{alert.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{alert.message}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

const Dashboard: React.FC = () => {
    const { summary2025, planData, generateBenchmarkAnalysis } = usePlan();
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateAnalysis = async () => {
        setIsLoading(true);
        await generateBenchmarkAnalysis();
        setIsLoading(false);
    };

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header */}
            <header className="flex items-end justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gradient-border">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard Estratégico</h1>
                    <p className="text-gray-500 mt-1">Visão consolidada da performance de 2025 e insights para 2026</p>
                </div>
                <div className="text-right">
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-brand-dark rounded-xl">
                        <span className="text-xs text-gray-400">Ano base</span>
                        <span className="text-lg font-bold text-brand-orange">2025</span>
                    </span>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard 
                    title="Receita Liquida 2025" 
                    value={formatCurrency(summary2025.receitaTotal, true)} 
                    note="Faturamento total do ano" 
                    color="blue" 
                    icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1" /></svg>} 
                />
                <KpiCard 
                    title="Margem EBITDA" 
                    value={formatPercentage(summary2025.margemEbitda)} 
                    note={`EBITDA: ${formatCurrency(summary2025.ebitda, true)}`} 
                    color="green" 
                    icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} 
                />
                <KpiCard 
                    title="LTV / CAC" 
                    value={`${formatNumber(summary2025.relacaoLtvCac)}x`} 
                    note="Ideal: acima de 3x" 
                    color="orange" 
                    icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} 
                />
                <KpiCard 
                    title="Ponto de Equilibrio" 
                    value={formatCurrency(summary2025.pontoEquilibrioContabil, true)} 
                    note="Receita minima mensal" 
                    color="yellow" 
                    icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2" /></svg>} 
                />
            </div>

            {/* Financial Alerts */}
            <FinancialAlerts />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Performance Mensal 2025</h2>
                    <p className="text-xs text-gray-400 mb-4">Receita, custos e EBITDA ao longo do ano</p>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            <AreaChart data={summary2025.monthlySummary} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ea580c" stopOpacity={0.15}/>
                                        <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorEbitda" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15}/>
                                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tickFormatter={(value) => formatCurrency(value, true)} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Area type="monotone" dataKey="receita" name="Receita" stroke="#ea580c" strokeWidth={2} fill="url(#colorReceita)" />
                                <Area type="monotone" dataKey="ebitda" name="EBITDA" stroke="#16a34a" strokeWidth={2} fill="url(#colorEbitda)" />
                                <Line type="monotone" dataKey="custos" name="Custos" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <MarketComparison />
            </div>
            
            {/* What-If Simulator */}
            <WhatIfSimulator />

            {/* AI Analysis */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-xl">
                            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Análise de Mercado com Inteligência Artificial</h2>
                            <p className="text-xs text-gray-400">Compare seus indicadores com o mercado. Preencha o Ramo de Atividade nas Configurações.</p>
                        </div>
                    </div>
                    <button onClick={handleGenerateAnalysis} disabled={isLoading || !planData.companyProfile.industry} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-orange rounded-xl hover:bg-orange-700 shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                        {isLoading ? (
                            <><span className="animate-spin">&#9696;</span> Analisando...</>
                        ) : (
                            <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Gerar Análise</>
                        )}
                    </button>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-5 rounded-2xl border border-gray-100 min-h-[120px] leading-relaxed">
                    {planData.analysis?.benchmarkAnalysis || "A análise da Inteligência Artificial sobre seu posicionamento de mercado aparecerá aqui apos clicar em 'Gerar Análise'."}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
