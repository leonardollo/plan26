

import React, { useState } from 'react';
import { usePlan } from '../hooks/usePlanData';
import type { OKR, KeyResult, KPI, OkrsAndKpis } from '../types';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';
import CurrencyInput from './shared/CurrencyInput';
import clsx from 'clsx';

type KpiDepartment = keyof OkrsAndKpis['kpis'];

const getUnitFormatter = (unit: KeyResult['unit']) => {
    switch (unit) {
        case 'currency': return (v: number | undefined) => formatCurrency(v, true);
        case 'percentage': return (v: number | undefined) => formatPercentage(v);
        default: return (v: number | undefined) => formatNumber(v, true);
    }
};

const KeyResultRow: React.FC<{
    okrId: string;
    kr: KeyResult;
    onUpdate: (okrId: string, krId: string, field: keyof Omit<KeyResult, 'id'>, value: string) => void;
    onRemove: (okrId: string, krId: string) => void;
}> = ({ okrId, kr, onUpdate, onRemove }) => {
    const start = kr.startValue ?? 0;
    const target = kr.targetValue ?? 0;
    const current = kr.currentValue ?? 0;
    let progress = 0;
    if (target > start) {
        progress = ((current - start) / (target - start)) * 100;
    } else if (target < start) { // for metrics where lower is better, e.g., reduce churn
        progress = ((start - current) / (start - target)) * 100;
    }
    progress = Math.max(0, Math.min(100, progress)); // Clamp between 0 and 100

    const formatter = getUnitFormatter(kr.unit);

    return (
        <div className="space-y-2 py-3 border-t border-gray-200">
            <div className="flex justify-between items-center">
                <input
                    type="text"
                    value={kr.name}
                    onChange={(e) => onUpdate(okrId, kr.id, 'name', e.target.value)}
                    className="w-full text-sm font-medium text-gray-700 bg-transparent border-0 focus:ring-1 focus:ring-brand-orange rounded-md"
                />
                 <button onClick={() => onRemove(okrId, kr.id)} className="text-red-400 hover:text-red-600 text-lg">&times;</button>
            </div>
            <div className="flex items-center space-x-2">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-brand-orange h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="text-xs font-semibold text-brand-orange">{Math.round(progress)}%</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                    <label className="font-semibold text-gray-500">Unidade</label>
                    <select value={kr.unit} onChange={(e) => onUpdate(okrId, kr.id, 'unit', e.target.value)} className="w-full p-1 border-gray-300 rounded-md">
                        <option value="number">Número</option>
                        <option value="currency">Moeda</option>
                        <option value="percentage">Percentual</option>
                    </select>
                </div>
                 <div>
                    <label className="font-semibold text-gray-500">Início</label>
                    <CurrencyInput value={kr.startValue ?? null} onChange={(v) => onUpdate(okrId, kr.id, 'startValue', v)} className="w-full p-1 border border-gray-300 rounded-md text-sm"/>
                 </div>
                 <div>
                    <label className="font-semibold text-gray-500">Atual</label>
                    <CurrencyInput value={kr.currentValue ?? null} onChange={(v) => onUpdate(okrId, kr.id, 'currentValue', v)} className="w-full p-1 border border-gray-300 rounded-md text-sm"/>
                 </div>
                 <div>
                    <label className="font-semibold text-gray-500">Meta</label>
                     <CurrencyInput value={kr.targetValue ?? null} onChange={(v) => onUpdate(okrId, kr.id, 'targetValue', v)} className="w-full p-1 border border-gray-300 rounded-md text-sm"/>
                 </div>
            </div>
        </div>
    );
};

const KpiDashboard: React.FC = () => {
    const { planData, addKpi, updateKpi, removeKpi, anoPlano, anoBase } = usePlan();
    const [activeTab, setActiveTab] = useState<KpiDepartment>('financeiro');
    const TABS: { id: KpiDepartment; label: string; }[] = [
        { id: 'financeiro', label: 'Financeiro' }, { id: 'comercial', label: 'Comercial' }, { id: 'pessoas', label: 'Pessoas' }, { id: 'operacoes', label: 'Operações' }
    ];

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
             <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={clsx("whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm", activeTab === tab.id ? 'border-brand-orange text-brand-orange' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="mt-4 overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200">
                     <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-600 w-2/5">Indicador (KPI)</th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600">Unidade</th>
                            <th className="px-4 py-2 text-right font-medium text-gray-600">Real {anoBase}</th>
                            <th className="px-4 py-2 text-right font-medium text-gray-600">Meta {anoPlano}</th>
                            <th></th>
                        </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                        {planData.okrsAndKpis.kpis[activeTab].map(kpi => {
                            const formatter = getUnitFormatter(kpi.unit);
                            return (
                                <tr key={kpi.id}>
                                    <td><input type="text" value={kpi.name} onChange={e => updateKpi(activeTab, kpi.id, 'name', e.target.value)} className="w-full bg-transparent p-2 border-0 focus:ring-1 focus:ring-brand-orange rounded-md"/></td>
                                    <td className="text-center">
                                         <select value={kpi.unit} onChange={(e) => updateKpi(activeTab, kpi.id, 'unit', e.target.value)} className="p-1 border-gray-300 rounded-md">
                                            <option value="number">Número</option>
                                            <option value="currency">Moeda</option>
                                            <option value="percentage">Percentual</option>
                                        </select>
                                    </td>
                                    <td className="text-right p-2 text-gray-600 font-semibold">{formatter(kpi.value2025)}</td>
                                    <td><CurrencyInput value={kpi.target2026 ?? null} onChange={(v) => updateKpi(activeTab, kpi.id, 'target2026', v)} className="w-full bg-transparent p-2 text-right border-0 focus:ring-1 focus:ring-brand-orange rounded-md"/></td>
                                    <td className="text-center"><button onClick={() => removeKpi(activeTab, kpi.id)} className="text-red-400 hover:text-red-600">&times;</button></td>
                                </tr>
                            )
                        })}
                     </tbody>
                 </table>
                 <button onClick={() => addKpi(activeTab)} className="mt-2 text-brand-orange font-semibold hover:text-orange-700 text-sm">+ Adicionar KPI</button>
            </div>
        </div>
    );
}

const OkrsAndKpis: React.FC = () => {
    const { planData, generateOkrKpiSuggestions, addOkr, updateOkr, removeOkr, addKeyResult, updateKeyResult, removeKeyResult, anoPlano } = usePlan();
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerate = async () => {
        setIsLoading(true);
        await generateOkrKpiSuggestions();
        setIsLoading(false);
    };

    return (
        <div className="space-y-8">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gradient-border">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">5. OKRs & KPIs</h1>
                <p className="text-gray-500 mt-2">
                    Defina seus Objetivos e Resultados-Chave (OKRs) e monitore seus Indicadores-Chave de Performance (KPIs).
                </p>
            </header>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                 <div className="flex justify-between items-center border-b pb-2">
                    <h2 className="text-lg font-bold text-gray-900">OKRs Estratégicos {anoPlano}</h2>
                     <button onClick={handleGenerate} disabled={isLoading} className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-brand-orange rounded-xl hover:bg-orange-700 shadow-md shadow-orange-200 btn-glow transition-colors shadow-sm disabled:bg-gray-400">
                        {isLoading ? 'Gerando...' : 'Gerar Sugestões com IA'}
                     </button>
                </div>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {planData.okrsAndKpis.okrs.map(okr => (
                        <div key={okr.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-2">
                            <div className="flex justify-between items-start">
                                <textarea value={okr.objective} onChange={e => updateOkr(okr.id, e.target.value)} rows={2} className="w-full font-bold text-brand-blue bg-transparent border-0 focus:ring-1 focus:ring-brand-orange rounded-md resize-none" />
                                <button onClick={() => removeOkr(okr.id)} className="text-red-400 hover:text-red-600 text-2xl font-bold">&times;</button>
                            </div>
                            {okr.keyResults.map(kr => <KeyResultRow key={kr.id} okrId={okr.id} kr={kr} onUpdate={updateKeyResult} onRemove={removeKeyResult}/>)}
                            <button onClick={() => addKeyResult(okr.id)} className="text-sm text-brand-orange font-semibold hover:text-orange-700">+ Adicionar Key Result</button>
                        </div>
                    ))}
                </div>
                 <button onClick={addOkr} className="mt-4 text-brand-orange font-semibold hover:text-orange-700">+ Adicionar Objetivo</button>
            </div>

             <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Dashboard de KPIs {anoPlano}</h2>
                <KpiDashboard />
             </div>
        </div>
    );
};

export default OkrsAndKpis;
