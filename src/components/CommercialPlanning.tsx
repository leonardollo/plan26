
import React, { useState, useMemo, useEffect } from 'react';
import { usePlan } from '../hooks/usePlanData';
import { SalesFunnelData, HiringProjectionItem, DriverBasedPlanningData, Month, MONTHS, MONTH_LABELS, MonthlyData, DemandChannel } from '../types';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';
import CurrencyInput from './shared/CurrencyInput';
import clsx from 'clsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area } from 'recharts';


type CommercialPlanningTab = 'demand' | 'funnel' | 'execution' | 'hiring' | 'driver-based' | 'people-analytics';

// --- HELPER FUNCTIONS (LOCAL) ---
const sumMonthlyData = (data?: MonthlyData): number => data ? Object.values(data).reduce((sum, val) => sum + (Number(val) || 0), 0) : 0;
const avgMonthlyData = (data?: MonthlyData): number => {
    if (!data) return 0;
    const values = Object.values(data).filter(v => v !== undefined && v !== null);
    return values.length > 0 ? values.reduce((sum, val) => sum + (val || 0), 0) / values.length : 0;
};


// --- SUB-COMPONENTS ---
const InfoBox: React.FC<{ label: string; value: string; hint: string; color?: string }> = ({ label, value, hint, color }) => (
    <div className="bg-gray-50 p-4 rounded-lg text-center border">
        <p className="text-sm text-gray-500">{label}</p>
        <p className={clsx("text-2xl font-bold my-1", color || "text-gray-900")}>{value}</p>
        <p className="text-xs text-gray-500">{hint}</p>
    </div>
);

const InputField: React.FC<{
    label: string;
    value: number | undefined;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    prefix?: string;
    suffix?: string;
    hint: string;
}> = ({ label, value, onChange, prefix, suffix, hint }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="mt-1 relative rounded-md shadow-sm">
            {prefix && <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><span className="text-gray-500 sm:text-sm">{prefix}</span></div>}
            <CurrencyInput
                value={value ?? null}
                onChange={(v) => onChange({ target: { value: v } } as any)}
                className={`block w-full rounded-xl border border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm p-2 ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-12' : ''}`}
                placeholder="0"
            />
            {suffix && <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"><span className="text-gray-500 sm:text-sm">{suffix}</span></div>}
        </div>
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
);

// --- EXECUTION PLAN COMPONENT ---
const ExecutionPlanTab: React.FC = () => {
    const { planData, goals2026, summary2025 } = usePlan();
    const { salesFunnel, demandPlanning, driverBasedPlanning } = planData.commercialPlanning || {};

    const executionData = useMemo(() => {
        const channels = demandPlanning?.channels || [];
        const totalLeads = channels.reduce((sum, ch) => sum + (ch.leads || 0), 0);
        const totalRevenue = channels.reduce((sum, ch) => sum + (ch.expectedRevenue || 0), 0);
        const totalBudget = channels.reduce((sum, ch) => sum + (ch.budget || 0), 0);

        const txLeadToMql = (salesFunnel?.conversionRateLeadToMql || 0) / 100;
        const txMqlToSql = (salesFunnel?.conversionRateMqlToSql || 0) / 100;
        const txSqlToSale = (salesFunnel?.conversionRateSqlToSale || 0) / 100;
        const fullConversion = txLeadToMql * txMqlToSql * txSqlToSale;

        const salesNeeded = totalLeads * fullConversion;
        const avgTicket = salesNeeded > 0 ? totalRevenue / salesNeeded : (summary2025.ticketMedio || 0);
        const workingDays = salesFunnel?.workingDays || 252;
        const activitiesPerRep = salesFunnel?.activitiesPerRep || 10;

        // Monthly breakdown
        const monthlyLeads = totalLeads / 12;
        const monthlySales = salesNeeded / 12;
        const monthlyRevenue = totalRevenue / 12;
        const weeklyLeads = monthlyLeads / 4.3;
        const dailyLeads = monthlyLeads / (workingDays / 12);
        const dailySales = monthlySales / (workingDays / 12);
        const dailyRevenue = monthlyRevenue / (workingDays / 12);

        // Reps calculation
        const commercialDept = (planData.hiringProjection || []).find(d => (d.department || '').toLowerCase() === 'comercial');
        const totalReps = (commercialDept?.currentHeadcount || 0) + (commercialDept?.newHires || 0);
        const leadsPerRep = totalReps > 0 ? dailyLeads / totalReps : dailyLeads;
        const salesPerRep = totalReps > 0 ? monthlySales / totalReps : monthlySales;
        const revenuePerRep = totalReps > 0 ? monthlyRevenue / totalReps : monthlyRevenue;

        // CAC
        const cac = salesNeeded > 0 ? totalBudget / salesNeeded : 0;
        const ltv = avgTicket * 12; // Simplified LTV (1 year)
        const ltvCacRatio = cac > 0 ? ltv / cac : 0;

        // Scorecard metrics
        const metaReceita = goals2026.financeiras?.metaReceita || {};
        const totalMetaReceita = sumMonthlyData(metaReceita);
        const driverRevenue = driverBasedPlanning ? MONTHS.reduce((sum, month) => {
            const leads = driverBasedPlanning.leadsQualificados[month] || 0;
            const txConv = (driverBasedPlanning.taxaConversao[month] || 0) / 100;
            const recorrentes = driverBasedPlanning.clientesRecorrentes[month] || 0;
            const ticket = driverBasedPlanning.ticketMedio[month] || 0;
            return sum + ((recorrentes + (leads * txConv)) * ticket);
        }, 0) : 0;

        const gap = totalMetaReceita - driverRevenue;
        const gapPercent = totalMetaReceita > 0 ? (gap / totalMetaReceita) * 100 : 0;

        // Monthly targets for chart
        const monthlyTargets = MONTHS.map((m, i) => {
            const metaRec = metaReceita[m] || 0;
            const driverRec = driverBasedPlanning ? (() => {
                const leads = driverBasedPlanning.leadsQualificados[m] || 0;
                const txConv = (driverBasedPlanning.taxaConversao[m] || 0) / 100;
                const recorrentes = driverBasedPlanning.clientesRecorrentes[m] || 0;
                const ticket = driverBasedPlanning.ticketMedio[m] || 0;
                return (recorrentes + (leads * txConv)) * ticket;
            })() : 0;
            return {
                name: MONTH_LABELS[m].substring(0, 3),
                meta: metaRec,
                projecao: driverRec,
            };
        });

        return {
            totalLeads, totalRevenue, totalBudget, salesNeeded, avgTicket,
            workingDays, activitiesPerRep, fullConversion,
            monthlyLeads, monthlySales, monthlyRevenue,
            weeklyLeads, dailyLeads, dailySales, dailyRevenue,
            totalReps, leadsPerRep, salesPerRep, revenuePerRep,
            cac, ltv, ltvCacRatio,
            totalMetaReceita, driverRevenue, gap, gapPercent,
            monthlyTargets,
        };
    }, [planData, goals2026, summary2025, salesFunnel, demandPlanning, driverBasedPlanning]);

    // Radar data for scorecard
    const radarData = useMemo(() => {
        const maxLeads = executionData.totalLeads || 1;
        const maxConv = 100;
        const maxTicket = executionData.avgTicket * 2 || 1;
        const maxReps = executionData.totalReps * 1.5 || 1;
        const maxLtv = executionData.ltv * 1.5 || 1;

        return [
            { subject: 'Volume Leads', A: Math.min(100, (executionData.totalLeads / maxLeads) * 100), fullMark: 100 },
            { subject: 'Conversao', A: Math.min(100, executionData.fullConversion * 100 * 10), fullMark: 100 },
            { subject: 'Ticket Medio', A: Math.min(100, (executionData.avgTicket / maxTicket) * 100), fullMark: 100 },
            { subject: 'Equipe', A: Math.min(100, (executionData.totalReps / maxReps) * 100), fullMark: 100 },
            { subject: 'LTV/CAC', A: Math.min(100, (executionData.ltvCacRatio / 5) * 100), fullMark: 100 },
        ];
    }, [executionData]);

    return (
        <div className="space-y-6 mt-6">
            {/* Header KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-gradient-to-br from-brand-orange to-orange-600 text-white p-4 rounded-2xl shadow-lg">
                    <p className="text-xs font-medium opacity-80 uppercase">Meta Receita Anual</p>
                    <p className="text-xl font-extrabold mt-1">{formatCurrency(executionData.totalMetaReceita, true)}</p>
                </div>
                <div className="bg-gradient-to-br from-brand-dark to-gray-800 text-white p-4 rounded-2xl shadow-lg">
                    <p className="text-xs font-medium opacity-80 uppercase">Vendas Necessarias</p>
                    <p className="text-xl font-extrabold mt-1">{formatNumber(executionData.salesNeeded)}</p>
                    <p className="text-[10px] opacity-60">{formatNumber(executionData.monthlySales)}/mes</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border">
                    <p className="text-xs font-medium text-gray-500 uppercase">Ticket Medio</p>
                    <p className="text-xl font-extrabold text-gray-900 mt-1">{formatCurrency(executionData.avgTicket, true)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border">
                    <p className="text-xs font-medium text-gray-500 uppercase">CAC</p>
                    <p className="text-xl font-extrabold text-red-600 mt-1">{formatCurrency(executionData.cac, true)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border">
                    <p className="text-xs font-medium text-gray-500 uppercase">LTV (12m)</p>
                    <p className="text-xl font-extrabold text-green-600 mt-1">{formatCurrency(executionData.ltv, true)}</p>
                </div>
                <div className={clsx("p-4 rounded-2xl shadow-sm border", executionData.ltvCacRatio >= 3 ? "bg-green-50 border-green-200" : executionData.ltvCacRatio >= 1 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200")}>
                    <p className="text-xs font-medium text-gray-500 uppercase">LTV/CAC</p>
                    <p className={clsx("text-xl font-extrabold mt-1", executionData.ltvCacRatio >= 3 ? "text-green-700" : executionData.ltvCacRatio >= 1 ? "text-yellow-700" : "text-red-700")}>{formatNumber(executionData.ltvCacRatio)}x</p>
                    <p className="text-[10px] text-gray-500">{executionData.ltvCacRatio >= 3 ? 'Saudavel' : executionData.ltvCacRatio >= 1 ? 'Atencao' : 'Critico'}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rotina Diária do Vendedor */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-brand-orange/10 rounded-lg flex items-center justify-center text-brand-orange">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                        Rotina Diaria do Vendedor
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">O que cada vendedor precisa entregar <strong>TODO DIA</strong> para bater a meta:</p>
                    
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">1</div>
                                <div>
                                    <p className="font-semibold text-gray-900">Prospectar / Contatar Leads</p>
                                    <p className="text-xs text-gray-500">Ligacoes, emails, mensagens</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-extrabold text-blue-700">{formatNumber(Math.ceil(executionData.leadsPerRep))}</p>
                                <p className="text-[10px] text-gray-500">contatos/dia</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl border border-purple-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">2</div>
                                <div>
                                    <p className="font-semibold text-gray-900">Reunioes / Apresentacoes</p>
                                    <p className="text-xs text-gray-500">Qualificar e apresentar solucao</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-extrabold text-purple-700">{formatNumber(Math.ceil(executionData.leadsPerRep * (salesFunnel?.conversionRateLeadToMql || 30) / 100))}</p>
                                <p className="text-[10px] text-gray-500">reunioes/dia</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-brand-orange rounded-xl flex items-center justify-center text-white font-bold text-sm">3</div>
                                <div>
                                    <p className="font-semibold text-gray-900">Propostas Enviadas</p>
                                    <p className="text-xs text-gray-500">Propostas comerciais formais</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-extrabold text-brand-orange">{formatNumber(Math.max(1, Math.ceil(executionData.salesPerRep * 1.5 / (executionData.workingDays / 12))))}</p>
                                <p className="text-[10px] text-gray-500">propostas/dia</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">4</div>
                                <div>
                                    <p className="font-semibold text-gray-900">Fechamentos (Vendas)</p>
                                    <p className="text-xs text-gray-500">Meta de conversao final</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-extrabold text-green-700">{formatNumber(executionData.salesPerRep, false)}</p>
                                <p className="text-[10px] text-gray-500">vendas/mes</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-gray-50 rounded-xl border text-center">
                        <p className="text-sm text-gray-600">Meta de Faturamento por Vendedor</p>
                        <p className="text-2xl font-extrabold text-gray-900">{formatCurrency(executionData.revenuePerRep, true)}<span className="text-sm font-normal text-gray-500">/mes</span></p>
                    </div>
                </div>

                {/* Scorecard Radar */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-brand-dark/10 rounded-lg flex items-center justify-center text-brand-dark">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </span>
                        Scorecard Comercial
                    </h3>

                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="#e5e7eb" />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6b7280' }} />
                                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar name="Performance" dataKey="A" stroke="#EE7533" fill="#EE7533" fillOpacity={0.3} strokeWidth={2} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="p-3 bg-gray-50 rounded-lg text-center">
                            <p className="text-xs text-gray-500">Equipe Comercial</p>
                            <p className="text-xl font-extrabold text-gray-900">{executionData.totalReps}</p>
                            <p className="text-[10px] text-gray-500">vendedores</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg text-center">
                            <p className="text-xs text-gray-500">Conversao Total</p>
                            <p className="text-xl font-extrabold text-gray-900">{formatPercentage(executionData.fullConversion * 100)}</p>
                            <p className="text-[10px] text-gray-500">lead-to-sale</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg text-center">
                            <p className="text-xs text-gray-500">Leads Necessarios</p>
                            <p className="text-xl font-extrabold text-gray-900">{formatNumber(executionData.totalLeads)}</p>
                            <p className="text-[10px] text-gray-500">no ano</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg text-center">
                            <p className="text-xs text-gray-500">Investimento Mkt</p>
                            <p className="text-xl font-extrabold text-gray-900">{formatCurrency(executionData.totalBudget, true)}</p>
                            <p className="text-[10px] text-gray-500">no ano</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Meta vs Projeção Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </span>
                    Meta vs Projecao de Receita (Mensal)
                </h3>
                
                <div className={clsx("mb-4 p-4 rounded-xl border", executionData.gap > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200")}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">
                                {executionData.gap > 0 ? 'GAP: Sua projeção esta abaixo da meta' : 'Sua projeção supera a meta'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                Meta: {formatCurrency(executionData.totalMetaReceita)} | Projecao: {formatCurrency(executionData.driverRevenue)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className={clsx("text-2xl font-extrabold", executionData.gap > 0 ? "text-red-600" : "text-green-600")}>
                                {executionData.gap > 0 ? '-' : '+'}{formatCurrency(Math.abs(executionData.gap), true)}
                            </p>
                            <p className="text-xs text-gray-500">{formatPercentage(Math.abs(executionData.gapPercent))}</p>
                        </div>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={executionData.monthlyTargets} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(val) => `R$${Math.round(val / 1000).toLocaleString('pt-BR')}k`} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                            <Area type="monotone" dataKey="meta" name="Meta" stroke="#EE7533" fill="#EE7533" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 5" />
                            <Area type="monotone" dataKey="projeção" name="Projeção" stroke="#213242" fill="#213242" fillOpacity={0.15} strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Plano de Execução Semanal */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    </span>
                    Plano de Execucao - Desdobramento de Metas
                </h3>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-brand-dark text-white">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Indicador</th>
                                <th className="px-4 py-3 text-right font-semibold">Anual</th>
                                <th className="px-4 py-3 text-right font-semibold">Trimestral</th>
                                <th className="px-4 py-3 text-right font-semibold">Mensal</th>
                                <th className="px-4 py-3 text-right font-semibold">Semanal</th>
                                <th className="px-4 py-3 text-right font-semibold">Diario</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">Receita (R$)</td>
                                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(executionData.totalRevenue, true)}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(executionData.totalRevenue / 4, true)}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(executionData.monthlyRevenue, true)}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(executionData.monthlyRevenue / 4.3, true)}</td>
                                <td className="px-4 py-3 text-right font-bold text-brand-orange">{formatCurrency(executionData.dailyRevenue, true)}</td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">Vendas (un.)</td>
                                <td className="px-4 py-3 text-right font-semibold">{formatNumber(executionData.salesNeeded)}</td>
                                <td className="px-4 py-3 text-right">{formatNumber(executionData.salesNeeded / 4)}</td>
                                <td className="px-4 py-3 text-right">{formatNumber(executionData.monthlySales)}</td>
                                <td className="px-4 py-3 text-right">{formatNumber(executionData.monthlySales / 4.3)}</td>
                                <td className="px-4 py-3 text-right font-bold text-brand-orange">{formatNumber(executionData.dailySales)}</td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">Leads Necessarios</td>
                                <td className="px-4 py-3 text-right font-semibold">{formatNumber(executionData.totalLeads)}</td>
                                <td className="px-4 py-3 text-right">{formatNumber(executionData.totalLeads / 4)}</td>
                                <td className="px-4 py-3 text-right">{formatNumber(executionData.monthlyLeads)}</td>
                                <td className="px-4 py-3 text-right">{formatNumber(executionData.weeklyLeads)}</td>
                                <td className="px-4 py-3 text-right font-bold text-brand-orange">{formatNumber(executionData.dailyLeads)}</td>
                            </tr>
                            <tr className="bg-brand-orange/5 hover:bg-brand-orange/10">
                                <td className="px-4 py-3 font-bold text-brand-orange">Meta por Vendedor (R$/mes)</td>
                                <td className="px-4 py-3 text-right font-bold">{formatCurrency(executionData.revenuePerRep * 12, true)}</td>
                                <td className="px-4 py-3 text-right font-bold">{formatCurrency(executionData.revenuePerRep * 3, true)}</td>
                                <td className="px-4 py-3 text-right font-bold text-brand-orange">{formatCurrency(executionData.revenuePerRep, true)}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(executionData.revenuePerRep / 4.3, true)}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(executionData.revenuePerRep / (executionData.workingDays / 12), true)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Checklist de Execução */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    </span>
                    Como o Empresario Deve Executar (Passo a Passo)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <h4 className="font-bold text-brand-dark text-sm uppercase tracking-wider">Gestão Diaria</h4>
                        {[
                            { title: 'Reuniao de 15min com a equipe', desc: 'Alinhar metas do dia, revisar pipeline e tirar bloqueios.' },
                            { title: 'Monitorar atividades no CRM', desc: 'Verificar se cada vendedor esta cumprindo a meta de contatos diarios.' },
                            { title: 'Acompanhar propostas em aberto', desc: 'Follow-up em propostas com mais de 48h sem resposta.' },
                            { title: 'Registrar todas as interacoes', desc: 'Garantir que o time registra cada contato, reuniao e proposta.' },
                        ].map((item, i) => (
                            <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl border">
                                <div className="w-6 h-6 bg-brand-orange rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                                <div>
                                    <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                                    <p className="text-xs text-gray-500">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3">
                        <h4 className="font-bold text-brand-dark text-sm uppercase tracking-wider">Gestão Semanal</h4>
                        {[
                            { title: 'Reuniao de pipeline (30min)', desc: 'Revisar todas as oportunidades em aberto e definir prioridades.' },
                            { title: 'Análise de conversao por etapa', desc: 'Identificar onde o funil esta travando e agir na causa raiz.' },
                            { title: 'Treinamento/Roleplay', desc: 'Praticar objecoes, pitch e tecnicas de fechamento com o time.' },
                            { title: 'Revisar metas vs realizado', desc: 'Comparar resultado semanal com a meta e ajustar rota se necessario.' },
                        ].map((item, i) => (
                            <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl border">
                                <div className="w-6 h-6 bg-brand-dark rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                                <div>
                                    <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                                    <p className="text-xs text-gray-500">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-6 p-4 bg-brand-orange/5 border border-brand-orange/20 rounded-xl">
                    <h4 className="font-bold text-brand-orange text-sm uppercase tracking-wider mb-3">Gestão Mensal (Fechamento)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { title: 'Análise de Resultado', desc: 'Comparar meta x realizado, identificar desvios e documentar aprendizados.' },
                            { title: 'Ranking de Performance', desc: 'Reconhecer os melhores vendedores e criar plano de ação para os que ficaram abaixo.' },
                            { title: 'Ajuste de Rota', desc: 'Recalibrar metas, investimento em marketing e estrategia de canais para o proximo mes.' },
                        ].map((item, i) => (
                            <div key={i} className="p-3 bg-white rounded-lg border">
                                <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                                <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const PeopleAnalyticsDashboard: React.FC = () => {
    const { planData, goals2026, summary2025 } = usePlan();
    
    const revenuePerEmployee2025 = summary2025.headcountMedio > 0 ? summary2025.receitaTotal / summary2025.headcountMedio : 0;
    const { productivityGainFactor, projectedRevenue } = planData.analysis.peopleAnalytics;
    const revenuePerEmployee2026 = revenuePerEmployee2025 * (1 + productivityGainFactor / 100);
    const headcount2026 = goals2026.pessoas.metaHeadcount || 0;
    const salarioMedio2025 = summary2025.salarioMedioMensal || 0;
    const custoAnualColab2025 = summary2025.custoColaboradorAno || 0;
    const turnover2025 = summary2025.turnoverPercent || 0;
    const turnoverMeta2026 = goals2026.pessoas.metaTurnover || 0;
    const roi2025 = summary2025.roiTreinamento || 0;
    const roiMeta2026 = goals2026.pessoas.metaRoiTreinamento || 0;
    const absenteismoMeta = goals2026.pessoas.metaAbsenteismo || 0;

    // Custo estimado de turnover (SHRM: 50-200% do salario anual)
    const custoTurnoverPorPessoa = custoAnualColab2025 * 0.75;
    const pessoasPerdidas2025 = Math.round(summary2025.headcountMedio * (turnover2025 / 100));
    const custoTurnoverTotal2025 = pessoasPerdidas2025 * custoTurnoverPorPessoa;
    const pessoasPerdidas2026Meta = Math.round(headcount2026 * (turnoverMeta2026 / 100));
    const custoTurnoverTotal2026Meta = pessoasPerdidas2026Meta * custoTurnoverPorPessoa;
    const economiaTurnover = custoTurnoverTotal2025 - custoTurnoverTotal2026Meta;

    // Comparativo chart data
    const comparisonData = [
        { name: 'Receita/Colab.', atual: revenuePerEmployee2025, meta: revenuePerEmployee2026 },
    ];

    const headcountData = [
        { name: '2025', value: summary2025.headcountFinal || summary2025.headcountMedio, fill: '#94a3b8' },
        { name: '2026', value: headcount2026, fill: '#f97316' },
    ];

    const turnoverData = [
        { name: '2025', value: turnover2025, fill: '#ef4444' },
        { name: 'Meta 2026', value: turnoverMeta2026, fill: '#10b981' },
    ];

    const getStatusColor = (current: number, target: number, lowerIsBetter: boolean) => {
        if (lowerIsBetter) return current <= target ? 'text-green-600' : 'text-red-600';
        return current >= target ? 'text-green-600' : 'text-amber-600';
    };

    const getStatusBg = (current: number, target: number, lowerIsBetter: boolean) => {
        if (lowerIsBetter) return current <= target ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
        return current >= target ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200';
    };

    return (
        <div className="space-y-6 mt-6">
            {/* SECTION 1: KPI Cards */}
            <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </span>
                    Indicadores de Pessoas
                </h2>
                <p className="text-sm text-gray-500 mb-4">Visão geral da equipe: produtividade, custos e metas de gestão de pessoas.</p>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-4 rounded-2xl shadow-lg">
                        <p className="text-xs font-medium opacity-80 uppercase">Headcount 2025</p>
                        <p className="text-2xl font-extrabold mt-1">{formatNumber(summary2025.headcountFinal || summary2025.headcountMedio)}</p>
                        <p className="text-xs opacity-60">colaboradores</p>
                    </div>
                    <div className="bg-gradient-to-br from-brand-orange to-orange-600 text-white p-4 rounded-2xl shadow-lg">
                        <p className="text-xs font-medium opacity-80 uppercase">Meta Headcount 2026</p>
                        <p className="text-2xl font-extrabold mt-1">{formatNumber(headcount2026)}</p>
                        <p className="text-xs opacity-60">colaboradores</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border">
                        <p className="text-xs font-medium text-gray-500 uppercase">Salario Medio</p>
                        <p className="text-xl font-extrabold text-gray-900 mt-1">{formatCurrency(salarioMedio2025)}</p>
                        <p className="text-xs text-gray-400">/mes por colaborador</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border">
                        <p className="text-xs font-medium text-gray-500 uppercase">Custo Anual/Colab.</p>
                        <p className="text-xl font-extrabold text-gray-900 mt-1">{formatCurrency(custoAnualColab2025, true)}</p>
                        <p className="text-xs text-gray-400">salario + encargos + beneficios</p>
                    </div>
                </div>
            </div>

            {/* SECTION 2: Produtividade */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </span>
                    Produtividade da Equipe
                </h3>
                <p className="text-sm text-gray-500 mb-6">Quanto cada colaborador gera de receita e como isso evolui com as metas de RH.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 p-5 rounded-xl border text-center">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Receita/Colaborador 2025</p>
                        <p className="text-2xl font-extrabold text-gray-900">{formatCurrency(revenuePerEmployee2025, true)}</p>
                        <p className="text-xs text-gray-400 mt-1">Linha de base atual</p>
                    </div>
                    <div className="bg-green-50 p-5 rounded-xl border border-green-200 text-center">
                        <p className="text-xs font-bold text-green-700 uppercase mb-1">Bonus de Produtividade</p>
                        <p className="text-2xl font-extrabold text-green-600">+{formatPercentage(productivityGainFactor)}</p>
                        <p className="text-xs text-green-600/70 mt-1">Ganho estimado com metas de RH</p>
                    </div>
                    <div className="bg-brand-orange/5 p-5 rounded-xl border border-brand-orange/20 text-center">
                        <p className="text-xs font-bold text-brand-orange uppercase mb-1">Receita/Colaborador 2026</p>
                        <p className="text-2xl font-extrabold text-brand-orange">{formatCurrency(revenuePerEmployee2026, true)}</p>
                        <p className="text-xs text-gray-400 mt-1">Base + Bonus de produtividade</p>
                    </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <div className="flex items-start gap-3">
                        <svg className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <div className="text-sm text-blue-800">
                            <p><strong>Como funciona:</strong> O bonus de produtividade e calculado com base nas suas metas de redução de turnover, aumento do ROI de treinamento e redução de absenteismo. Menos rotatividade = equipe mais experiente. Mais treinamento = equipe mais eficiente.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 3: Metas de RH - Comparativo */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </span>
                    Metas de Gestao de Pessoas (2025 vs 2026)
                </h3>
                <p className="text-sm text-gray-500 mb-6">Comparativo entre o realizado em 2025 e as metas definidas para 2026.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Turnover */}
                    <div className={clsx("p-5 rounded-xl border", getStatusBg(turnoverMeta2026, turnover2025, true))}>
                        <div className="flex justify-between items-start mb-3">
                            <p className="text-sm font-bold text-gray-800">Turnover</p>
                            <span className="text-xs bg-white px-2 py-0.5 rounded-full border">Menor = Melhor</span>
                        </div>
                        <div className="flex items-end gap-4">
                            <div>
                                <p className="text-xs text-gray-500">2025</p>
                                <p className="text-xl font-bold text-red-500">{formatPercentage(turnover2025)}</p>
                            </div>
                            <svg className="h-5 w-5 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            <div>
                                <p className="text-xs text-gray-500">Meta 2026</p>
                                <p className={clsx("text-xl font-bold", getStatusColor(turnoverMeta2026, turnover2025, true))}>{formatPercentage(turnoverMeta2026)}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Redução de {formatPercentage(turnover2025 - turnoverMeta2026)} pontos</p>
                    </div>

                    {/* ROI Treinamento */}
                    <div className={clsx("p-5 rounded-xl border", getStatusBg(roiMeta2026, roi2025, false))}>
                        <div className="flex justify-between items-start mb-3">
                            <p className="text-sm font-bold text-gray-800">ROI de Treinamento</p>
                            <span className="text-xs bg-white px-2 py-0.5 rounded-full border">Maior = Melhor</span>
                        </div>
                        <div className="flex items-end gap-4">
                            <div>
                                <p className="text-xs text-gray-500">2025</p>
                                <p className="text-xl font-bold text-gray-600">{formatNumber(roi2025)}x</p>
                            </div>
                            <svg className="h-5 w-5 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            <div>
                                <p className="text-xs text-gray-500">Meta 2026</p>
                                <p className={clsx("text-xl font-bold", getStatusColor(roiMeta2026, roi2025, false))}>{formatNumber(roiMeta2026)}x</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Cada R$1 investido retorna R${formatNumber(roiMeta2026)}</p>
                    </div>

                    {/* Absenteismo */}
                    <div className="p-5 rounded-xl border bg-gray-50 border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                            <p className="text-sm font-bold text-gray-800">Absenteismo</p>
                            <span className="text-xs bg-white px-2 py-0.5 rounded-full border">Menor = Melhor</span>
                        </div>
                        <div className="flex items-end gap-4">
                            <div>
                                <p className="text-xs text-gray-500">Meta 2026</p>
                                <p className="text-xl font-bold text-gray-700">{formatPercentage(absenteismoMeta)}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Meta de faltas e atrasos</p>
                    </div>
                </div>
            </div>

            {/* SECTION 4: Impacto Financeiro do Turnover */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1" /></svg>
                    </span>
                    Impacto Financeiro do Turnover
                </h3>
                <p className="text-sm text-gray-500 mb-6">Quanto custa perder pessoas e quanto você economiza reduzindo o turnover.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-red-50 p-5 rounded-xl border border-red-200 text-center">
                        <p className="text-xs font-bold text-red-700 uppercase mb-1">Custo do Turnover 2025</p>
                        <p className="text-xl font-extrabold text-red-600">{formatCurrency(custoTurnoverTotal2025, true)}</p>
                        <p className="text-xs text-red-500/70 mt-1">{formatNumber(pessoasPerdidas2025)} pessoas x {formatCurrency(custoTurnoverPorPessoa, true)}</p>
                    </div>
                    <div className="bg-amber-50 p-5 rounded-xl border border-amber-200 text-center">
                        <p className="text-xs font-bold text-amber-700 uppercase mb-1">Custo Projetado 2026</p>
                        <p className="text-xl font-extrabold text-amber-600">{formatCurrency(custoTurnoverTotal2026Meta, true)}</p>
                        <p className="text-xs text-amber-500/70 mt-1">{formatNumber(pessoasPerdidas2026Meta)} pessoas (com meta de {formatPercentage(turnoverMeta2026)})</p>
                    </div>
                    <div className="bg-green-50 p-5 rounded-xl border border-green-200 text-center">
                        <p className="text-xs font-bold text-green-700 uppercase mb-1">Economia Estimada</p>
                        <p className="text-xl font-extrabold text-green-600">{formatCurrency(Math.max(0, economiaTurnover), true)}</p>
                        <p className="text-xs text-green-500/70 mt-1">ao reduzir turnover de {formatPercentage(turnover2025)} para {formatPercentage(turnoverMeta2026)}</p>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border">
                    <p className="text-xs text-gray-600">
                        <strong>Referencia:</strong> Segundo a SHRM (Society for Human Resource Management), o custo de substituicao de um colaborador varia entre 50% e 200% do salario anual. Usamos 75% como estimativa conservadora, incluindo recrutamento, treinamento, perda de produtividade e impacto na equipe.
                    </p>
                </div>
            </div>

            {/* SECTION 5: Projecao Bottom-Up */}
            <div className="bg-gradient-to-br from-brand-dark to-gray-800 p-6 rounded-2xl shadow-lg text-white">
                <h3 className="text-lg font-bold border-b border-white/20 pb-2 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </span>
                    Projecao de Receita Bottom-Up (pela Equipe)
                </h3>
                <p className="text-sm text-white/60 mb-6">Se cada colaborador gerar a receita projetada, qual seria o faturamento total?</p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 p-4 rounded-xl text-center">
                        <p className="text-xs font-medium text-white/60 uppercase">Receita/Colab. 2026</p>
                        <p className="text-xl font-extrabold mt-1">{formatCurrency(revenuePerEmployee2026, true)}</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl text-center">
                        <p className="text-xs font-medium text-white/60 uppercase">x</p>
                        <p className="text-xl font-extrabold mt-1 text-white/40">x</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl text-center">
                        <p className="text-xs font-medium text-white/60 uppercase">Headcount 2026</p>
                        <p className="text-xl font-extrabold mt-1">{formatNumber(headcount2026)}</p>
                    </div>
                    <div className="bg-brand-orange p-4 rounded-xl text-center shadow-lg">
                        <p className="text-xs font-medium text-white/80 uppercase">= Receita Projetada</p>
                        <p className="text-2xl font-extrabold mt-1">{formatCurrency(projectedRevenue, true)}</p>
                    </div>
                </div>

                <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-xs text-white/50">
                        <strong>Bottom-Up vs Top-Down:</strong> Compare este valor com a meta de receita definida nas Metas 2026. Se a projecao Bottom-Up for menor que a meta Top-Down, voce precisa aumentar o headcount ou a produtividade. Se for maior, sua equipe tem capacidade de sobra.
                    </p>
                </div>
            </div>
        </div>
    );
};


// --- MAIN COMPONENT ---
const CommercialPlanning: React.FC = () => {
    const { planData, goals2026, updateCommercialPlanning, addDemandChannel, removeDemandChannel, updateDemandChannel, generateChannelAnalysis, updateHiringProjectionItem, addHiringProjectionItem, removeHiringProjectionItem, generateFunnelSuggestions, summary2025, updateDriverBasedPlanning } = usePlan();
    const [activeTab, setActiveTab] = useState<CommercialPlanningTab>('demand');
    const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

    const { demandPlanning, salesFunnel, driverBasedPlanning } = planData.commercialPlanning || {};

    // --- Demand Planning Tab Calculations ---
    const demandTotals = useMemo(() => {
        const channels = demandPlanning?.channels || [];
        const totalBudget = channels.reduce((sum, ch) => sum + (ch.budget || 0), 0);
        const totalLeads = channels.reduce((sum, ch) => sum + (ch.leads || 0), 0);
        const totalRevenue = channels.reduce((sum, ch) => sum + (ch.expectedRevenue || 0), 0);
        const avgCpl = totalLeads > 0 ? totalBudget / totalLeads : 0;
        const totalRoi = totalBudget > 0 ? (totalRevenue - totalBudget) / totalBudget : 0;
        return { totalBudget, totalLeads, totalRevenue, avgCpl, totalRoi };
    }, [demandPlanning]);

    // --- Sales Funnel Tab Calculations ---
    const funnelCalculations = useMemo(() => {
        if (!salesFunnel) return { totalLeadsGoal: 0, totalRevenueGoal: 0, mqlsNeeded: 0, sqlsNeeded: 0, salesNeeded: 0, dailyActivitiesNeeded: 0, repsNeeded: 0, avgTicket: 0 };
        
        const totalLeadsGoal = demandTotals.totalLeads;
        const totalRevenueGoal = demandTotals.totalRevenue;

        const txLeadToMql = (salesFunnel.conversionRateLeadToMql || 0) / 100;
        const txMqlToSql = (salesFunnel.conversionRateMqlToSql || 0) / 100;
        const txSqlToSale = (salesFunnel.conversionRateSqlToSale || 0) / 100;

        const mqlsNeeded = totalLeadsGoal * txLeadToMql;
        const sqlsNeeded = mqlsNeeded * txMqlToSql;
        const salesNeeded = sqlsNeeded * txSqlToSale;
        
        const avgTicket = salesNeeded > 0 ? totalRevenueGoal / salesNeeded : (salesFunnel.avgTicket || 0);

        const dailyActivitiesNeeded = salesFunnel.workingDays ? totalLeadsGoal / salesFunnel.workingDays : 0;

        const activitiesPerSenior = (salesFunnel.activitiesPerRep || 0) * (salesFunnel.workingDays || 0);
        const rampUpMonths = salesFunnel.rampUpTime || 0;
        const productivityLossFactor = (rampUpMonths / 12) / 2;
        const activitiesPerNewbie = activitiesPerSenior * (1 - productivityLossFactor);
        
        const commercialDept = (planData.hiringProjection || []).find(d => (d.department || '').toLowerCase() === 'comercial');
        const currentReps = commercialDept?.currentHeadcount || 0;
        
        const activitiesFromSeniors = currentReps * activitiesPerSenior;
        const activityDeficit = totalLeadsGoal - activitiesFromSeniors;
        
        let newRepsNeeded = 0;
        if (activityDeficit > 0 && activitiesPerNewbie > 0) {
            newRepsNeeded = activityDeficit / activitiesPerNewbie;
        }

        return { totalLeadsGoal, totalRevenueGoal, mqlsNeeded, sqlsNeeded, salesNeeded, dailyActivitiesNeeded, repsNeeded: newRepsNeeded + currentReps, avgTicket };
    }, [demandTotals, salesFunnel, planData.hiringProjection]);

     // Suggest sales headcount in hiring projection
    useEffect(() => {
        const repsNeeded = Math.ceil(funnelCalculations.repsNeeded);
        const commercialDept = (planData.hiringProjection || []).find(d => (d.department || '').toLowerCase() === 'comercial');
        if (commercialDept && repsNeeded > 0) {
            const current = commercialDept.currentHeadcount || 0;
            const toHire = Math.max(0, repsNeeded - current);
            if (commercialDept.newHires !== toHire) {
               updateHiringProjectionItem(commercialDept.id, 'newHires', String(toHire));
            }
        }
    }, [funnelCalculations.repsNeeded, planData.hiringProjection, updateHiringProjectionItem]);
    
    // --- Hiring Tab Calculations ---
    const hiringTotals = useMemo(() => {
        const hiringProjection = planData.hiringProjection || [];
        const totalCurrent = hiringProjection.reduce((sum, item) => sum + (item.currentHeadcount || 0), 0);
        const totalNew = hiringProjection.reduce((sum, item) => sum + (item.newHires || 0), 0);
        const totalBudget = hiringProjection.reduce((sum, item) => {
            const headcount2026 = (item.currentHeadcount || 0) + (item.newHires || 0);
            return sum + (headcount2026 * (item.avgAnnualCost || 0));
        }, 0);
        return { totalCurrent, totalNew, totalBudget };
    }, [planData.hiringProjection]);

    // --- Driver-Based Planning Calculations ---
    const driverCalculations = useMemo(() => {
        if (!driverBasedPlanning) return { monthlyResults: [], totals: { leadsQualificados: 0, clientesRecorrentes: 0, novosClientes: 0, totalClientes: 0, receitaTotal: 0, taxaConversao: 0, ticketMedio: 0 }};

        const monthlyResults = MONTHS.map(month => {
            const leads = driverBasedPlanning.leadsQualificados[month] || 0;
            const txConversao = (driverBasedPlanning.taxaConversao[month] || 0) / 100;
            const recorrentes = driverBasedPlanning.clientesRecorrentes[month] || 0;
            const ticket = driverBasedPlanning.ticketMedio[month] || 0;

            const novosClientes = leads * txConversao;
            const totalClientes = recorrentes + novosClientes;
            const receitaTotal = totalClientes * ticket;
            return { novosClientes, totalClientes, receitaTotal };
        });

        const totals = {
            leadsQualificados: sumMonthlyData(driverBasedPlanning.leadsQualificados),
            clientesRecorrentes: sumMonthlyData(driverBasedPlanning.clientesRecorrentes),
            novosClientes: monthlyResults.reduce((s, r) => s + r.novosClientes, 0),
            totalClientes: monthlyResults.reduce((s, r) => s + r.totalClientes, 0),
            receitaTotal: monthlyResults.reduce((s, r) => s + r.receitaTotal, 0),
            taxaConversao: 0,
            ticketMedio: 0
        };
        
        totals.taxaConversao = totals.leadsQualificados > 0 ? (totals.novosClientes / totals.leadsQualificados) * 100 : 0;
        totals.ticketMedio = totals.totalClientes > 0 ? totals.receitaTotal / totals.totalClientes : 0;
        
        return { monthlyResults, totals };
    }, [driverBasedPlanning]);


    // --- AI HANDLERS ---
    const handleGenerateFunnelSuggestions = async () => {
        setIsLoading(prev => ({ ...prev, funnel: true }));
        await generateFunnelSuggestions();
        setIsLoading(prev => ({ ...prev, funnel: false }));
    };

    const handleGenerateChannelAnalysis = async () => {
        setIsLoading(prev => ({ ...prev, channel: true }));
        await generateChannelAnalysis();
        setIsLoading(prev => ({ ...prev, channel: false }));
    };

    /**
     * Pré-preenche os drivers com o que 2025 realmente foi.
     *
     * Antes, quando não havia conversão medida, a função chutava 5% e derivava
     * os leads desse chute (leads = novos clientes ÷ 0,05), entregando um
     * número 20× inventado com cara de "veio de 2025". Se o dado não existe, o
     * campo fica em branco — em branco a pessoa percebe e preenche; número
     * errado ela usa.
     */
    const handlePrefillDrivers = () => {
        const leadsMedidos = Object.values(planData.commercial.funilComercial.leadsGerados || {})
            .reduce<number>((a, v) => a + (v || 0), 0);
        const conversao = summary2025.temBaseConversao ? summary2025.taxaConversaoLeadCliente : null;
        const ticket = summary2025.ticketMedio || null;
        const clientesFim = summary2025.monthlySummary[11]?.receita && ticket
            ? summary2025.monthlySummary[11].receita / ticket
            : null;

        MONTHS.forEach(m => {
            if (leadsMedidos > 0) updateDriverBasedPlanning('leadsQualificados', m, (leadsMedidos / 12).toFixed(0));
            if (conversao !== null) updateDriverBasedPlanning('taxaConversao', m, conversao.toFixed(1).replace('.', ','));
            if (ticket !== null) updateDriverBasedPlanning('ticketMedio', m, ticket.toFixed(2).replace('.', ','));
            if (clientesFim !== null) updateDriverBasedPlanning('clientesRecorrentes', m, clientesFim.toFixed(0));
        });
    };

    const handleImportFromFunnel = () => {
        const annualLeads = demandTotals.totalLeads || 0;
        const monthlyLeads = annualLeads / 12;

        let aggregateRate = 0;
        const funnel = planData.commercialPlanning.salesFunnel;
        if (funnel) {
            const r1 = (funnel.conversionRateLeadToMql || 0) / 100;
            const r2 = (funnel.conversionRateMqlToSql || 0) / 100;
            const r3 = (funnel.conversionRateSqlToSale || 0) / 100;
            aggregateRate = (r1 * r2 * r3) * 100;
        }
        if (aggregateRate === 0) {
             aggregateRate = summary2025.taxaConversaoLeadCliente || 1;
        }

        const ticket = funnelCalculations.avgTicket || summary2025.ticketMedio || 0;

        const estimatedActiveClients = summary2025.receitaTotal > 0 && (summary2025.ticketMedio || 1) > 0 
            ? (summary2025.receitaTotal / 12) / (summary2025.ticketMedio || 1)
            : 0;

        MONTHS.forEach(m => {
            updateDriverBasedPlanning('leadsQualificados', m, monthlyLeads.toFixed(0));
            updateDriverBasedPlanning('taxaConversao', m, aggregateRate.toFixed(2).replace('.', ','));
            updateDriverBasedPlanning('ticketMedio', m, ticket.toFixed(2).replace('.', ','));
            
            const currentRecurrent = driverBasedPlanning?.clientesRecorrentes[m];
            if (currentRecurrent === undefined || currentRecurrent === null || Number(currentRecurrent) === 0) {
                 updateDriverBasedPlanning('clientesRecorrentes', m, estimatedActiveClients.toFixed(0));
            }
        });
    };

    // --- RENDER FUNCTIONS FOR TABS ---
    const renderDemandPlanningTab = () => {
        const channels = demandPlanning?.channels || [];
        const COLORS = ['#EE7533', '#213242', '#28A745', '#FFC107', '#6f42c1', '#dc3545'];
        const chartData = channels.map(ch => ({ name: ch.name, value: ch.expectedRevenue || 0}));
        
        return (
            <div className="space-y-6 mt-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                     <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4">Planejamento de Demanda por Canal</h3>
                     <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium text-gray-600 w-1/4">Canal de Aquisição</th>
                                    <th className="px-4 py-2 text-right font-medium text-gray-600">Orçamento (R$)</th>
                                    <th className="px-4 py-2 text-right font-medium text-gray-600">N Leads</th>
                                    <th className="px-4 py-2 text-right font-medium text-gray-600">Receita Esperada (R$)</th>
                                    <th className="px-4 py-2 text-right font-medium text-gray-600">CPL (R$)</th>
                                    <th className="px-4 py-2 text-right font-medium text-gray-600">ROI</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {channels.map(ch => {
                                    const cpl = (ch.leads || 0) > 0 ? (ch.budget || 0) / ch.leads! : 0;
                                    const roi = (ch.budget || 0) > 0 ? ((ch.expectedRevenue || 0) - ch.budget!) / ch.budget! : 0;
                                    return (
                                        <tr key={ch.id}>
                                            <td><input type="text" value={ch.name} onChange={e => updateDemandChannel(ch.id, 'name', e.target.value)} className="w-full p-2 bg-transparent border-0 focus:ring-1 focus:ring-brand-orange rounded-md"/></td>
                                            <td><CurrencyInput value={ch.budget ?? null} onChange={(v) => updateDemandChannel(ch.id, 'budget', v)} className="w-full p-2 text-right border-0 focus:ring-1 focus:ring-brand-orange rounded-md"/></td>
                                            <td><CurrencyInput value={ch.leads ?? null} onChange={(v) => updateDemandChannel(ch.id, 'leads', v)} className="w-full p-2 text-right border-0 focus:ring-1 focus:ring-brand-orange rounded-md"/></td>
                                            <td><CurrencyInput value={ch.expectedRevenue ?? null} onChange={(v) => updateDemandChannel(ch.id, 'expectedRevenue', v)} className="w-full p-2 text-right border-0 focus:ring-1 focus:ring-brand-orange rounded-md"/></td>
                                            <td className="px-4 py-2 text-right text-gray-600 font-semibold">{formatCurrency(cpl)}</td>
                                            <td className="px-4 py-2 text-right text-gray-600 font-semibold">{formatNumber(roi)}x</td>
                                            <td className="text-center"><button onClick={() => removeDemandChannel(ch.id)} className="text-red-400 hover:text-red-600">&times;</button></td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                             <tfoot className="bg-gray-100 font-bold">
                                <tr>
                                    <td className="px-4 py-2 text-left">TOTAIS</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(demandTotals.totalBudget)}</td>
                                    <td className="px-4 py-2 text-right">{formatNumber(demandTotals.totalLeads)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(demandTotals.totalRevenue)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(demandTotals.avgCpl)}</td>
                                    <td className="px-4 py-2 text-right">{formatNumber(demandTotals.totalRoi)}x</td>
                                    <td></td>
                                </tr>
                             </tfoot>
                        </table>
                     </div>
                     <button onClick={addDemandChannel} className="mt-2 text-brand-orange font-semibold hover:text-orange-700 text-sm">+ Adicionar Canal</button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                        <h3 className="text-lg font-bold text-brand-blue mb-4">Mix de Receita por Canal</h3>
                        <div style={{width: '100%', height: 250}}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''}: ${formatCurrency(value ?? 0, true)}`}>
                                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                     </div>
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-brand-blue">Análise de Canais com IA</h3>
                            <button onClick={handleGenerateChannelAnalysis} disabled={isLoading.channel} className="flex items-center px-3 py-2 text-xs font-semibold text-white bg-brand-orange rounded-xl hover:bg-orange-700 shadow-md shadow-orange-200 btn-glow transition-colors shadow-sm disabled:bg-gray-400">
                                {isLoading.channel ? 'Analisando...' : 'Gerar Análise'}
                            </button>
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-md min-h-[220px]">
                            {demandPlanning?.analysis || "A IA analisara seu mix de canais, eficiencia (CPL, ROI) e sugerira otimizacoes de orçamento."}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    const renderFunnelTab = () => {
        if (!salesFunnel) return <div className="p-4 text-center text-gray-500">Carregando dados do funil...</div>;
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                         <h3 className="text-lg font-bold text-brand-blue">Premissas do Funil Granular</h3>
                         <InputField label="Tx. Conversao (Lead > MQL)" value={salesFunnel.conversionRateLeadToMql} onChange={e => updateCommercialPlanning('salesFunnel', 'conversionRateLeadToMql', e.target.value)} hint="Marketing Qualified Lead" suffix="%" />
                         <InputField label="Tx. Conversao (MQL > SQL)" value={salesFunnel.conversionRateMqlToSql} onChange={e => updateCommercialPlanning('salesFunnel', 'conversionRateMqlToSql', e.target.value)} hint="Sales Qualified Lead" suffix="%" />
                         <InputField label="Tx. Conversao (SQL > Venda)" value={salesFunnel.conversionRateSqlToSale} onChange={e => updateCommercialPlanning('salesFunnel', 'conversionRateSqlToSale', e.target.value)} hint="Taxa de Fechamento" suffix="%" />
                         <InputField label="Atividades/Dia por Vendedor" value={salesFunnel.activitiesPerRep} onChange={e => updateCommercialPlanning('salesFunnel', 'activitiesPerRep', e.target.value)} hint="N de prospecoes, etc." />
                         <InputField label="Dias Uteis em 2026" value={salesFunnel.workingDays} onChange={e => updateCommercialPlanning('salesFunnel', 'workingDays', e.target.value)} hint="Ex: 252 dias" />
                         <InputField label="Tempo de Ramp-up (meses)" value={salesFunnel.rampUpTime} onChange={e => updateCommercialPlanning('salesFunnel', 'rampUpTime', e.target.value)} hint="Tempo para um novo vendedor ser 100% produtivo." suffix="meses" />
                    </div>
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                         <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-brand-blue">Otimizacao do Funil com IA</h3>
                            <button onClick={handleGenerateFunnelSuggestions} disabled={isLoading.funnel} className="flex items-center px-3 py-2 text-xs font-semibold text-white bg-brand-orange rounded-xl hover:bg-orange-700 shadow-md shadow-orange-200 btn-glow transition-colors shadow-sm disabled:bg-gray-400">
                                 {isLoading.funnel ? 'Gerando...' : 'Gerar Sugestoes'}
                             </button>
                         </div>
                         <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-md min-h-[150px]">
                            {planData.commercialPlanning?.funnelSuggestions || "Clique no botao para que a IA (atuando como um especialista em Growth) análise seu funil e sugira melhorias."}
                         </div>
                     </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <h3 className="text-lg font-bold text-brand-blue">Projeção do Funil</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InfoBox label="Meta Anual de Leads" value={formatNumber(funnelCalculations.totalLeadsGoal)} hint="Vinda do Plano de Demanda" />
                            <InfoBox label="Meta Anual de Receita" value={formatCurrency(funnelCalculations.totalRevenueGoal)} hint="Vinda do Plano de Demanda" />
                            <InfoBox label="MQLs Necessarios" value={formatNumber(funnelCalculations.mqlsNeeded)} hint="Marketing Qualified" />
                            <InfoBox label="SQLs Necessarios" value={formatNumber(funnelCalculations.sqlsNeeded)} hint="Sales Qualified" />
                            <InfoBox label="Vendas Necessarias" value={formatNumber(funnelCalculations.salesNeeded)} hint="Total no ano" />
                            <InfoBox label="Ticket Medio Implicito" value={formatCurrency(funnelCalculations.avgTicket)} hint="Receita / Vendas" />
                        </div>
                    </div>
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <h3 className="text-lg font-bold text-brand-blue">Meta de Comportamento</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <InfoBox label="Leads Necessarios / Dia" value={formatNumber(funnelCalculations.dailyActivitiesNeeded)} hint="Para alimentar o funil" />
                             <InfoBox label="Atividades de Vendas / Dia" value={formatNumber((funnelCalculations.repsNeeded || 0) * (salesFunnel.activitiesPerRep || 0))} hint="Total da equipe" />
                        </div>
                    </div>
                    <div className="bg-brand-blue text-white p-6 rounded-2xl shadow-sm border">
                        <h3 className="text-lg font-bold">Headcount de Vendas Necessario</h3>
                         <p className="text-5xl font-extrabold my-2 text-center">{formatNumber(Math.ceil(funnelCalculations.repsNeeded))}</p>
                         <p className="text-sm text-center opacity-80">Vendedores necessarios para gerar o volume de leads diarios.</p>
                    </div>
                </div>
            </div>
        );
    }

    const renderHiringTab = () => (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4">Projeção de Contratações e Orçamento de Pessoal 2026</h2>
            
            <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800 text-sm rounded-r-lg">
                <h4 className="font-bold flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    O que e o Custo Medio?
                </h4>
                <p className="mt-2">
                    Este valor e <strong>Unitario (por colaborador)</strong> e <strong>Anual</strong>.
                </p>
                <p className="mt-1">
                    O sistema multiplica este valor pelo <strong>Headcount Final (Atuais + Contratações)</strong> para calcular o orcamento total do departamento.
                </p>
                <p className="mt-2 text-xs text-blue-600">
                    <strong>Como calcular (Estimativa):</strong> (Salario Bruto + Encargos + Beneficios) x 13,3 (inclui 13o e Ferias).
                </p>
                <div className="mt-3 pt-3 border-t border-blue-200 text-blue-900 font-medium">
                    Referencia 2025: O custo medio geral da sua empresa foi de {formatCurrency(summary2025.custoColaboradorAno)}/ano.
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                     <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departamento</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Headcount Atual</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Novas Contratações</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Headcount 2026</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Custo Medio Unitario (R$/ano)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Budget Total R$</th>
                            <th className="px-2 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {(planData.hiringProjection || []).map(item => {
                            const headcount2026 = (item.currentHeadcount || 0) + (item.newHires || 0);
                            const budgetTotal = headcount2026 * (item.avgAnnualCost || 0);
                            return (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2"><input type="text" value={item.department} onChange={(e) => updateHiringProjectionItem(item.id, 'department', e.target.value)} className="w-full bg-transparent border-b border-transparent focus:border-brand-orange focus:outline-none" /></td>
                                    <td className="px-4 py-2"><CurrencyInput value={item.currentHeadcount ?? null} onChange={(v) => updateHiringProjectionItem(item.id, 'currentHeadcount', v)} className="w-28 p-2 text-right border-none bg-transparent focus:ring-2 focus:ring-brand-orange focus:ring-inset rounded-md" /></td>
                                    <td className="px-4 py-2"><CurrencyInput value={item.newHires ?? null} onChange={(v) => updateHiringProjectionItem(item.id, 'newHires', v)} className="w-28 p-2 text-right border-none bg-transparent focus:ring-2 focus:ring-brand-orange focus:ring-inset rounded-md" /></td>
                                    <td className="px-4 py-2 text-right font-semibold text-gray-700">{formatNumber(headcount2026)}</td>
                                    <td className="px-4 py-2"><CurrencyInput value={item.avgAnnualCost ?? null} onChange={(v) => updateHiringProjectionItem(item.id, 'avgAnnualCost', v)} className="w-32 p-2 text-right border-none bg-transparent focus:ring-2 focus:ring-brand-orange focus:ring-inset rounded-md" /></td>
                                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(budgetTotal, true)}</td>
                                    <td className="px-2 py-2 text-center"><button onClick={() => removeHiringProjectionItem(item.id)} className="text-red-400 hover:text-red-600 font-bold text-lg">&times;</button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="bg-gray-100">
                        <tr className="font-bold text-sm text-gray-800">
                            <td className="px-4 py-3">TOTAL</td>
                            <td className="px-4 py-3 text-right">{formatNumber(hiringTotals.totalCurrent)}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(hiringTotals.totalNew)}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(hiringTotals.totalCurrent + hiringTotals.totalNew)}</td>
                            <td className="px-4 py-3"></td>
                            <td className="px-4 py-3 text-right">{formatCurrency(hiringTotals.totalBudget, true)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
             <div className="mt-4"><button onClick={addHiringProjectionItem} className="text-brand-orange font-semibold hover:text-orange-700">+ Adicionar Departamento</button></div>
        </div>
    );
    
    const renderDriverBasedPlanningTab = () => {
        const metaReceita = goals2026.financeiras?.metaReceita || {};
        const totalMetaReceita = sumMonthlyData(metaReceita);
        const diff = totalMetaReceita - driverCalculations.totals.receitaTotal;
        const diffPercent = totalMetaReceita > 0 ? (diff / totalMetaReceita) * 100 : 0;
        
        const currentLeads = driverCalculations.totals.leadsQualificados;
        const currentTicket = driverCalculations.totals.ticketMedio;
        const currentConversion = driverCalculations.totals.taxaConversao / 100;
        const currentRecurrentClients = driverCalculations.totals.clientesRecorrentes;
        
        const recurrentRevenue = currentRecurrentClients * currentTicket;
        const requiredTotalNewRevenue = totalMetaReceita - recurrentRevenue;
        
        let requiredLeads = 0;
        let requiredConversion = 0;
        
        if (currentTicket > 0 && currentConversion > 0) {
             requiredLeads = requiredTotalNewRevenue / (currentTicket * currentConversion);
        }
        
        if (currentTicket > 0 && currentLeads > 0) {
            requiredConversion = (requiredTotalNewRevenue / (currentTicket * currentLeads)) * 100;
        }

        const isGap = diff > 0;

        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6 space-y-4">
                <div className="flex flex-wrap gap-4 justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">Driver-Based Planning - Projeção 2026</h2>
                    <div className="flex gap-2">
                        <button onClick={handleImportFromFunnel} className="text-sm text-brand-orange bg-orange-50 px-3 py-1 rounded hover:bg-orange-100 border border-orange-200 font-medium">
                            Importar do Funil & Demanda 2026
                        </button>
                        <button onClick={handlePrefillDrivers} className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded hover:bg-gray-100 border border-gray-200">
                            Carregar Base Historica 2025
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl">
                    <p className="font-bold">Como funciona a correlacao?</p>
                    <p className="text-sm mt-1">
                        Aqui comparamos sua <strong>Meta (Desejo)</strong> com seu <strong>Plano Operacional (Realidade)</strong>. Se houver um GAP, use os Drivers abaixo para encontrar o caminho (aumentar leads? melhorar conversao?).
                    </p>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                     <table className="min-w-full text-sm">
                        <thead className="bg-brand-blue text-white">
                            <tr>
                                <th className="p-3 text-left font-semibold sticky left-0 bg-brand-blue z-10 w-[200px]">Direcionador</th>
                                {MONTHS.map(m => <th key={m} className="p-2 text-center font-medium">{MONTH_LABELS[m].substring(0,3)}</th>)}
                                <th className="p-3 text-right font-semibold sticky right-0 bg-brand-blue z-10 w-[120px]">Total/Media</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {(['leadsQualificados', 'taxaConversao', 'clientesRecorrentes', 'ticketMedio'] as const).map(key => {
                                const isPercent = key === 'taxaConversao';
                                const isCurrency = key === 'ticketMedio';
                                const totalVal = driverCalculations.totals[key];
                                const formatFn = isCurrency ? formatCurrency : (isPercent ? formatPercentage : formatNumber);
                                const labelMap = {
                                    leadsQualificados: 'Leads Qualificados (#)',
                                    taxaConversao: 'Taxa de Conversao (%)',
                                    clientesRecorrentes: 'Clientes Recorrentes (#)',
                                    ticketMedio: 'Ticket Medio (R$)',
                                };
                                return (
                                    <tr key={key}>
                                        <td className="p-3 font-medium sticky left-0 bg-white z-10">{labelMap[key]}</td>
                                        {MONTHS.map(m => (
                                            <td key={m} className="p-0 text-right">
                                                <CurrencyInput
                                                    value={driverBasedPlanning?.[key]?.[m] ?? null}
                                                    onChange={(v) => updateDriverBasedPlanning(key, m, v)}
                                                    className="w-24 p-2 text-right border-none bg-transparent focus:ring-2 focus:ring-brand-orange focus:ring-inset"
                                                    placeholder="0"
                                                />
                                            </td>
                                        ))}
                                        <td className="p-3 text-right font-bold sticky right-0 bg-white z-10">{formatFn(totalVal)}</td>
                                    </tr>
                                )
                            })}
                             <tr className="bg-gray-50 font-semibold">
                                <td className="p-3 sticky left-0 bg-gray-50 z-10">(=) Novos Clientes (#)</td>
                                {driverCalculations.monthlyResults.map((r, i) => <td key={i} className="p-2 text-right">{formatNumber(r.novosClientes)}</td>)}
                                <td className="p-3 text-right font-bold sticky right-0 bg-gray-50 z-10">{formatNumber(driverCalculations.totals.novosClientes)}</td>
                            </tr>
                            <tr className="bg-gray-100 font-bold text-gray-900">
                                <td className="p-3 sticky left-0 bg-gray-50 z-10">(=) Receita Projetada (R$)</td>
                                {driverCalculations.monthlyResults.map((r, i) => <td key={i} className="p-2 text-right">{formatCurrency(r.receitaTotal)}</td>)}
                                <td className="p-3 text-right sticky right-0 bg-gray-50 z-10">{formatCurrency(driverCalculations.totals.receitaTotal)}</td>
                            </tr>
                        </tbody>
                     </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoBox label="Meta de Receita (Top-Down)" value={formatCurrency(totalMetaReceita)} hint="Definida na aba de Metas." />
                    <div className={clsx("p-4 rounded-lg text-center border", diff > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200")}>
                        <p className="text-sm font-medium">{diff > 0 ? "GAP (Falta Atingir)" : "Excedente (Acima da Meta)"}</p>
                        <p className={clsx("text-2xl font-bold my-1", diff > 0 ? "text-red-700" : "text-green-700")}>{formatCurrency(Math.abs(diff))}</p>
                        <p className="text-xs">{formatPercentage(Math.abs(diffPercent))} da meta</p>
                    </div>
                </div>
                
                <div className={clsx("mt-4 p-4 border rounded-lg", isGap ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200")}>
                    <h4 className={clsx("font-bold mb-2", isGap ? "text-orange-800" : "text-green-800")}>
                        {isGap ? 'Calculadora de Correcao de Rota (GAP)' : 'Análise de Sensibilidade (O que e necessario para a meta exata?)'}
                    </h4>
                    <p className="text-sm text-gray-700 mb-3">
                        {isGap
                            ? `Para fechar o GAP de ${formatCurrency(diff)} e atingir a meta, você precisa ajustar seus drivers. Veja as opcoes:`
                            : `Você ja superou a meta em ${formatCurrency(Math.abs(diff))}. Para manter a meta exata (ponto de equilibrio da meta), você precisaria apenas de:`
                        }
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className={clsx("bg-white p-3 rounded border", isGap ? "border-orange-100" : "border-green-100")}>
                            <p className="text-xs text-gray-500 font-semibold uppercase">Opcao A: Volume de Leads</p>
                            <p className="text-sm mt-1">Gerar <strong className="text-gray-900">{formatNumber(requiredLeads)} leads</strong> no ano.</p>
                            <p className="text-xs text-gray-400">({formatNumber(requiredLeads - currentLeads)} em relação ao atual)</p>
                        </div>
                        <div className={clsx("bg-white p-3 rounded border", isGap ? "border-orange-100" : "border-green-100")}>
                            <p className="text-xs text-gray-500 font-semibold uppercase">Opcao B: Eficiencia (Conversao)</p>
                            <p className="text-sm mt-1">Taxa de Conversao de <strong className="text-gray-900">{formatPercentage(requiredConversion)}</strong>.</p>
                            <p className="text-xs text-gray-400">({formatPercentage(requiredConversion - driverCalculations.totals.taxaConversao)} pontos percentuais)</p>
                        </div>
                    </div>
                </div>

            </div>
        )
    };

    const TABS: { id: CommercialPlanningTab; label: string; }[] = [
        { id: 'demand', label: '1. Demanda' },
        { id: 'funnel', label: '2. Funil de Vendas' },
        { id: 'execution', label: '3. Plano de Execução' },
        { id: 'hiring', label: '4. Contratacoes' },
        { id: 'people-analytics', label: '5. People Analytics' },
        { id: 'driver-based', label: '6. Drivers' },
    ];

    return (
        <div className="space-y-8">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gradient-border">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Planejamento Comercial & RH</h1>
                <p className="text-gray-500 mt-2">
                    Defina sua estrategia de geracao de demanda, estruture seu funil de vendas, crie o plano de execucao e projete as contratacoes para 2026.
                </p>
            </header>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as CommercialPlanningTab)}
                            className={clsx(
                                'whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm',
                                activeTab === tab.id
                                ? 'border-brand-orange text-brand-orange'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div>
                {activeTab === 'demand' && renderDemandPlanningTab()}
                {activeTab === 'funnel' && renderFunnelTab()}
                {activeTab === 'execution' && <ExecutionPlanTab />}
                {activeTab === 'hiring' && renderHiringTab()}
                {activeTab === 'driver-based' && renderDriverBasedPlanningTab()}
                {activeTab === 'people-analytics' && <PeopleAnalyticsDashboard />}
            </div>
        </div>
    );
};

export default CommercialPlanning;
