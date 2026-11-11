
import React, { useState, useMemo } from 'react';
import { usePlan } from '../hooks/usePlanData';
import { ScenarioName, ScenarioData, Month, MONTHS, MONTH_LABELS, ScenarioInputMode, MonthlyData } from '../types';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import CurrencyInput from './shared/CurrencyInput';
import clsx from 'clsx';
import FinancialDataRow from './shared/FinancialDataRow';

const sumMonthlyData = (data: MonthlyData): number => data ? Object.values(data).reduce((s, v) => s + (v || 0), 0) : 0;

const ScenarioPlanning: React.FC = () => {
    const { 
        scenarios2026, 
        planData,
        updateScenarioGrowthPercentage,
        updateScenarioInputMode,
        updateScenarioProjectionValue,
        updateScenarioProjectionAllValues,
        updateScenarioCustomItem,
        updateScenarioCustomItemAllValues,
        addScenarioCustomItem,
        removeScenarioCustomItem,
        updateDecisionTrigger,
        updateStrategicAction,
        generateDecisionTriggers,
        getStrategicScoreAnalysis,
        recalculateScenario,
        recalculateAllScenarios,
        anoPlano,
        anoBase
    } = usePlan();

    const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
    const { productivityGainFactor } = planData.analysis.peopleAnalytics;


    const handleGenerateTriggers = async (scenario: ScenarioName) => {
        setIsLoading(prev => ({ ...prev, [`triggers-${scenario}`]: true }));
        await generateDecisionTriggers(scenario);
        setIsLoading(prev => ({ ...prev, [`triggers-${scenario}`]: false }));
    };

    const handleGenerateAnalysis = async (scenarioName: ScenarioName) => {
        setIsLoading(prev => ({...prev, [`analysis-${scenarioName}`]: true}));
        await getStrategicScoreAnalysis(scenarioName);
        setIsLoading(prev => ({...prev, [`analysis-${scenarioName}`]: false}));
    }

    const renderBudgetTable = (scenarioName: ScenarioName) => {
        const scenario = scenarios2026[scenarioName];
        if (!scenario || !scenario.projection) {
            return <div className="p-4 text-center text-gray-500">Carregando dados do cenário...</div>;
        }
        const { projection } = scenario;
        const isManual = planData.scenariosInputMode[scenarioName] === 'manual';

        // --- CALCULATIONS for display ---
        const receitaBrutaTotal = sumMonthlyData(projection.receitaBruta);
        const impostosTotal = sumMonthlyData(projection.impostosSobreFaturamento);
        const receitaLiquidaTotal = receitaBrutaTotal - impostosTotal;
        
        const customFixosTotal = (projection.customCustosFixos || []).reduce((s, i) => s + sumMonthlyData(i.values), 0);
        const custosFixosTotal = sumMonthlyData(projection.folhaPagamento) + sumMonthlyData(projection.aluguel) + sumMonthlyData(projection.despesasOperacionais) + sumMonthlyData(projection.marketingFixo) + sumMonthlyData(projection.administrativo) + customFixosTotal;
        
        const customVariaveisTotal = (projection.customCustosVariaveis || []).reduce((s, i) => s + sumMonthlyData(i.values), 0);
        const custosVariaveisTotal = sumMonthlyData(projection.cmv) + sumMonthlyData(projection.comissoes) + sumMonthlyData(projection.fretes) + customVariaveisTotal;
        
        const margemContribuicaoTotal = receitaLiquidaTotal - custosVariaveisTotal;
        const ebitdaTotal = margemContribuicaoTotal - custosFixosTotal;
        const margemEbitda = receitaLiquidaTotal > 0 ? (ebitdaTotal / receitaLiquidaTotal) * 100 : 0;

        const monthlyReceitaLiquida = MONTHS.reduce((acc, m) => ({...acc, [m]: (projection.receitaBruta?.[m] || 0) - (projection.impostosSobreFaturamento?.[m] || 0)}), {} as MonthlyData);
        const monthlyMargemContribuicao = MONTHS.reduce((acc, m) => {
            const customVar = (projection.customCustosVariaveis || []).reduce((s, i) => s + (i.values?.[m] || 0), 0);
            return {...acc, [m]: (monthlyReceitaLiquida[m] || 0) - ((projection.cmv?.[m] || 0) + (projection.comissoes?.[m] || 0) + (projection.fretes?.[m] || 0) + customVar)}
        }, {} as MonthlyData);
         const monthlyEbitda = MONTHS.reduce((acc, m) => {
            const customFix = (projection.customCustosFixos || []).reduce((s, i) => s + (i.values?.[m] || 0), 0);
            return {...acc, [m]: (monthlyMargemContribuicao[m] || 0) - ((projection.folhaPagamento?.[m] || 0) + (projection.aluguel?.[m] || 0) + (projection.despesasOperacionais?.[m] || 0) + (projection.marketingFixo?.[m] || 0) + (projection.administrativo?.[m] || 0) + customFix)}
        }, {} as MonthlyData);

        const handleAddItem = (type: 'customCustosFixos' | 'customCustosVariaveis') => {
            if (!isManual) {
                updateScenarioInputMode(scenarioName, 'manual');
            }
            addScenarioCustomItem(scenarioName, type);
        };

        return (
             <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                        <tr>
                            <th className="sticky left-0 bg-gray-50 z-10 p-3 text-left font-semibold" style={{width: '250px'}}>Indicador</th>
                            <th className="p-3 text-left font-semibold">Instruções</th>
                            <th className="p-3 text-right font-semibold">Total {anoPlano}</th>
                            {MONTHS.map(m => <th key={m} className="p-2 text-center font-medium">{MONTH_LABELS[m]}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        <tr className="bg-orange-50/50"><td colSpan={15} className="p-2.5 font-bold text-orange-700 text-sm">RECEITA</td></tr>
                        <FinancialDataRow label="Receita Bruta Total (R$)" rowData={{values: projection.receitaBruta}} onUpdate={isManual ? (m,v) => updateScenarioProjectionValue(scenarioName, 'receitaBruta', m, v) : undefined} onUpdateAll={isManual ? (v) => updateScenarioProjectionAllValues(scenarioName, 'receitaBruta', v) : undefined} seasonalReference={planData.financialSheet.receitaBruta.values2025} hint="Faturamento total"/>
                        <FinancialDataRow label="(-) Impostos (R$)" rowData={{values: projection.impostosSobreFaturamento}} onUpdate={isManual ? (m,v) => updateScenarioProjectionValue(scenarioName, 'impostosSobreFaturamento', m, v) : undefined} onUpdateAll={isManual ? (v) => updateScenarioProjectionAllValues(scenarioName, 'impostosSobreFaturamento', v) : undefined} seasonalReference={planData.financialSheet.impostosSobreFaturamento.values2025} hint="Com base na receita"/>
                        <FinancialDataRow label="(=) Receita Líquida (R$)" rowData={{values: monthlyReceitaLiquida}} calculatedValue={receitaLiquidaTotal} isTotal={true} />
                        
                        <tr className="bg-blue-50/50"><td colSpan={15} className="p-2.5 font-bold text-blue-700 text-sm">CUSTOS FIXOS</td></tr>
                        <FinancialDataRow label="Folha de Pagamento (R$)" rowData={{values: projection.folhaPagamento}} onUpdate={isManual ? (m,v) => updateScenarioProjectionValue(scenarioName, 'folhaPagamento', m, v) : undefined} onUpdateAll={isManual ? (v) => updateScenarioProjectionAllValues(scenarioName, 'folhaPagamento', v) : undefined} seasonalReference={planData.financialSheet.folhaPagamento.values2025} hint="Salários + Encargos"/>
                        <FinancialDataRow label="Aluguel (R$)" rowData={{values: projection.aluguel}} onUpdate={isManual ? (m,v) => updateScenarioProjectionValue(scenarioName, 'aluguel', m, v) : undefined} onUpdateAll={isManual ? (v) => updateScenarioProjectionAllValues(scenarioName, 'aluguel', v) : undefined} seasonalReference={planData.financialSheet.aluguel.values2025} hint="Infraestrutura"/>
                        <FinancialDataRow label="Despesas Operacionais (R$)" rowData={{values: projection.despesasOperacionais}} onUpdate={isManual ? (m,v) => updateScenarioProjectionValue(scenarioName, 'despesasOperacionais', m, v) : undefined} onUpdateAll={isManual ? (v) => updateScenarioProjectionAllValues(scenarioName, 'despesasOperacionais', v) : undefined} seasonalReference={planData.financialSheet.despesasOperacionais.values2025} hint="Água, luz, internet"/>
                        <FinancialDataRow label="Marketing (R$)" rowData={{values: projection.marketingFixo}} onUpdate={isManual ? (m,v) => updateScenarioProjectionValue(scenarioName, 'marketingFixo', m, v) : undefined} onUpdateAll={isManual ? (v) => updateScenarioProjectionAllValues(scenarioName, 'marketingFixo', v) : undefined} seasonalReference={planData.financialSheet.marketingFixo.values2025} hint="Marketing fixo"/>
                        <FinancialDataRow label="Administrativo (R$)" rowData={{values: projection.administrativo}} onUpdate={isManual ? (m,v) => updateScenarioProjectionValue(scenarioName, 'administrativo', m, v) : undefined} onUpdateAll={isManual ? (v) => updateScenarioProjectionAllValues(scenarioName, 'administrativo', v) : undefined} seasonalReference={planData.financialSheet.administrativo.values2025} hint="Contabilidade, juri"/>
                        {(projection.customCustosFixos || []).map(item => (
                            <FinancialDataRow key={item.id} label={item.name} rowData={{values: item.values}} onUpdateName={isManual ? (v) => updateScenarioCustomItem(scenarioName, 'customCustosFixos', item.id, 'name', v) : undefined} onUpdate={isManual ? (m,v) => updateScenarioCustomItem(scenarioName, 'customCustosFixos', item.id, m, v) : undefined} onUpdateAll={isManual ? (v) => updateScenarioCustomItemAllValues(scenarioName, 'customCustosFixos', item.id, v) : undefined} onRemove={isManual ? () => removeScenarioCustomItem(scenarioName, 'customCustosFixos', item.id) : undefined} isCustom={true} seasonalReference={planData.financialSheet.customCustosFixos.find(c => c.id === item.id)?.values2025} />
                        ))}
                        <tr>
                            <td className="sticky left-0 bg-white z-10 p-3">
                                <button 
                                    onClick={() => handleAddItem('customCustosFixos')} 
                                    className="text-brand-orange font-semibold hover:text-orange-700 no-print flex items-center gap-1"
                                >
                                    + Adicionar Custo Fixo
                                    {!isManual && <span className="text-[10px] bg-orange-100 text-orange-800 px-1 rounded border border-orange-200">(Muda para Manual)</span>}
                                </button>
                            </td>
                            <td colSpan={14}></td>
                        </tr>
                        <FinancialDataRow label="(=) Total Custos Fixos (R$)" calculatedValue={custosFixosTotal} isTotal={true}/>

                        <tr className="bg-amber-50/50"><td colSpan={15} className="p-2.5 font-bold text-amber-700 text-sm">CUSTOS VARIÁVEIS</td></tr>
                        <FinancialDataRow label="CMV (R$)" rowData={{values: projection.cmv}} onUpdate={isManual ? (m,v) => updateScenarioProjectionValue(scenarioName, 'cmv', m, v) : undefined} onUpdateAll={isManual ? (v) => updateScenarioProjectionAllValues(scenarioName, 'cmv', v) : undefined} seasonalReference={planData.financialSheet.cmv.values2025} hint="Custo direto prod."/>
                        <FinancialDataRow label="Comissões (R$)" rowData={{values: projection.comissoes}} onUpdate={isManual ? (m,v) => updateScenarioProjectionValue(scenarioName, 'comissoes', m, v) : undefined} onUpdateAll={isManual ? (v) => updateScenarioProjectionAllValues(scenarioName, 'comissoes', v) : undefined} seasonalReference={planData.financialSheet.comissoes.values2025} hint="Comissão de vendas"/>
                        <FinancialDataRow label="Fretes (R$)" rowData={{values: projection.fretes}} onUpdate={isManual ? (m,v) => updateScenarioProjectionValue(scenarioName, 'fretes', m, v) : undefined} onUpdateAll={isManual ? (v) => updateScenarioProjectionAllValues(scenarioName, 'fretes', v) : undefined} seasonalReference={planData.financialSheet.fretes.values2025} hint="Logística"/>
                        {(projection.customCustosVariaveis || []).map(item => (
                            <FinancialDataRow key={item.id} label={item.name} rowData={{values: item.values}} onUpdateName={isManual ? (v) => updateScenarioCustomItem(scenarioName, 'customCustosVariaveis', item.id, 'name', v) : undefined} onUpdate={isManual ? (m,v) => updateScenarioCustomItem(scenarioName, 'customCustosVariaveis', item.id, m, v) : undefined} onUpdateAll={isManual ? (v) => updateScenarioCustomItemAllValues(scenarioName, 'customCustosVariaveis', item.id, v) : undefined} onRemove={isManual ? () => removeScenarioCustomItem(scenarioName, 'customCustosVariaveis', item.id) : undefined} isCustom={true} seasonalReference={planData.financialSheet.customCustosVariaveis.find(c => c.id === item.id)?.values2025}/>
                        ))}
                        <tr>
                            <td className="sticky left-0 bg-white z-10 p-3">
                                <button 
                                    onClick={() => handleAddItem('customCustosVariaveis')}
                                    className="text-brand-orange font-semibold hover:text-orange-700 no-print flex items-center gap-1"
                                >
                                    + Adicionar Custo Variável
                                    {!isManual && <span className="text-[10px] bg-orange-100 text-orange-800 px-1 rounded border border-orange-200">(Muda para Manual)</span>}
                                </button>
                            </td>
                            <td colSpan={14}></td>
                        </tr>
                         <FinancialDataRow label="(=) Total Custos Variáveis (R$)" calculatedValue={custosVariaveisTotal} isTotal={true}/>
                        
                        <tr className="bg-emerald-50/50"><td colSpan={15} className="p-2.5 font-bold text-emerald-700 text-sm">RESULTADOS</td></tr>
                        <FinancialDataRow label="Margem de Contribuição (R$)" rowData={{values: monthlyMargemContribuicao}} calculatedValue={margemContribuicaoTotal} isTotal={true} hint="Receita Líquida - Custos Variáveis"/>
                        <FinancialDataRow label="EBITDA (R$)" rowData={{values: monthlyEbitda}} calculatedValue={ebitdaTotal} isTotal={true} hint="Margem de Contrib. - Custos Fixos"/>
                        <FinancialDataRow label="Margem EBITDA (%)" calculatedValue={margemEbitda} isPercentage={true} isTotal={true} hint="(EBITDA / Receita Líquida)"/>
                    </tbody>
                </table>
            </div>
        );
    }


    // Dados resumidos para comparacao
    const scenarioSummary = useMemo(() => {
        return (['Otimista', 'Conservador', 'Disruptivo'] as ScenarioName[]).map(name => {
            const s = scenarios2026[name];
            if (!s?.projection) return { name, receita: 0, ebitda: 0, margem: 0, crescimento: 0 };
            const p = s.projection;
            const recBruta = sumMonthlyData(p.receitaBruta);
            const impostos = sumMonthlyData(p.impostosSobreFaturamento);
            const recLiq = recBruta - impostos;
            const custFixos = sumMonthlyData(p.folhaPagamento) + sumMonthlyData(p.aluguel) + sumMonthlyData(p.despesasOperacionais) + sumMonthlyData(p.marketingFixo) + sumMonthlyData(p.administrativo) + (p.customCustosFixos || []).reduce((sum, i) => sum + sumMonthlyData(i.values), 0);
            const custVar = sumMonthlyData(p.cmv) + sumMonthlyData(p.comissoes) + sumMonthlyData(p.fretes) + (p.customCustosVariaveis || []).reduce((sum, i) => sum + sumMonthlyData(i.values), 0);
            const ebitda = recLiq - custVar - custFixos;
            const margem = recLiq > 0 ? (ebitda / recLiq) * 100 : 0;
            const crescimento = (s.growthPercentage || 0) + planData.analysis.strategicScore.total + productivityGainFactor;
            return { name, receita: recLiq, ebitda, margem, crescimento };
        });
    }, [scenarios2026, planData.analysis.strategicScore.total, productivityGainFactor]);

    const scenarioColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
        'Otimista': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100' },
        'Conservador': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100' },
        'Disruptivo': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100' },
    };

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Orçamento e Cenários {anoPlano}</h1>
                    <p className="text-gray-500 mt-1">
                        Projete o orcamento para {anoPlano} em diferentes cenarios e defina gatilhos e acoes estrategicas.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => recalculateAllScenarios()}
                        className="flex items-center gap-2 px-5 py-2.5 font-semibold text-white bg-brand-orange rounded-xl hover:bg-orange-700 shadow-md shadow-orange-200 btn-glow shadow-sm text-sm no-print transition-colors"
                        title={`Recalcular todos os cenários com base nos dados atuais de ${anoBase}`}
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Recalcular Todos
                    </button>
                    <button 
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-5 py-2.5 font-semibold text-white bg-gray-800 rounded-xl hover:bg-gray-700 shadow-sm text-sm no-print transition-colors"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Imprimir
                    </button>
                </div>
            </header>

            {/* COMPARACAO LADO A LADO DOS 3 CENARIOS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Comparativo de Cenários</h2>
                <p className="text-xs text-gray-400 mb-5">Visão rapida dos 3 cenários lado a lado</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {scenarioSummary.map(s => {
                        const colors = scenarioColors[s.name] || scenarioColors['Conservador'];
                        return (
                            <div key={s.name} className={clsx("p-5 rounded-2xl border", colors.bg, colors.border)}>
                                <div className="flex items-center justify-between mb-4">
                                    <span className={clsx("text-lg font-extrabold", colors.text)}>{s.name}</span>
                                    <span className={clsx("px-2.5 py-1 rounded-full text-xs font-bold", colors.badge, colors.text)}>
                                        {formatPercentage(s.crescimento, 1)} crescimento
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-gray-500">Receita Liquida Projetada</p>
                                        <p className="text-xl font-extrabold text-gray-900">{formatCurrency(s.receita, true)}</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-500">EBITDA</p>
                                            <p className={clsx("text-base font-bold", s.ebitda >= 0 ? 'text-emerald-600' : 'text-red-500')}>{formatCurrency(s.ebitda, true)}</p>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-500">Margem EBITDA</p>
                                            <p className={clsx("text-base font-bold", s.margem >= 15 ? 'text-emerald-600' : s.margem >= 5 ? 'text-amber-600' : 'text-red-500')}>{formatPercentage(s.margem, 1)}</p>
                                        </div>
                                    </div>
                                    {/* Barra visual de margem */}
                                    <div>
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div className={clsx("h-full rounded-full transition-all", s.margem >= 15 ? 'bg-emerald-500' : s.margem >= 5 ? 'bg-amber-500' : 'bg-red-400')} style={{ width: `${Math.min(Math.max(s.margem, 0), 50) * 2}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {(['Otimista', 'Conservador', 'Disruptivo'] as ScenarioName[]).map(scenarioName => (
                <div key={scenarioName} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h2 className={clsx("text-2xl font-extrabold", scenarioColors[scenarioName]?.text || 'text-blue-700')}>{`Cenário ${scenarioName}`}</h2>
                    
                    <div className="flex items-center gap-4 no-print">
                        <label className="text-sm font-medium">Modo de projeção:</label>
                        <div className="flex rounded-md shadow-sm">
                            <button onClick={() => updateScenarioInputMode(scenarioName, 'percentage')} className={clsx("px-3 py-1 text-sm font-semibold rounded-l-md", planData.scenariosInputMode[scenarioName] === 'percentage' ? 'bg-brand-orange text-white' : 'bg-gray-200 text-gray-700')}>% Crescimento</button>
                            <button onClick={() => updateScenarioInputMode(scenarioName, 'manual')} className={clsx("px-3 py-1 text-sm font-semibold rounded-r-md", planData.scenariosInputMode[scenarioName] === 'manual' ? 'bg-brand-orange text-white' : 'bg-gray-200 text-gray-700')}>Manual</button>
                        </div>
                    </div>

                    {planData.scenariosInputMode[scenarioName] === 'percentage' && (
                        <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 text-center">Crescimento Base</label>
                                    <div className="relative mt-1">
                                        <CurrencyInput
                                            value={scenarios2026[scenarioName].growthPercentage ?? null}
                                            onChange={(v) => updateScenarioGrowthPercentage(scenarioName, v)}
                                            className="w-28 p-2 text-center border border-gray-300 rounded-xl focus:ring-brand-orange focus:border-brand-orange bg-white text-gray-900"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                    </div>
                                </div>
                                <div className="text-2xl font-light text-gray-500 pt-4">+</div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 text-center">Fator Estratégico</label>
                                    <div className="relative mt-1">
                                        <div className="w-28 p-2 border border-gray-200 rounded-md bg-gray-200 text-center font-bold text-gray-900">
                                            {formatPercentage(planData.analysis.strategicScore.total, 1)}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-2xl font-light text-gray-500 pt-4">+</div>
                                <div>
                                    <label className="block text-xs font-medium text-green-600 text-center">Bônus Produtividade</label>
                                    <div className="relative mt-1">
                                        <div className="w-28 p-2 border border-green-200 rounded-md bg-green-100 text-center font-bold text-green-700">
                                            {formatPercentage(productivityGainFactor, 1)}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-2xl font-light text-gray-500 pt-4">=</div>
                                <div className="flex-1 min-w-[150px]">
                                    <label className="block text-xs font-medium text-brand-blue text-center">Crescimento Total</label>
                                    <div className="relative mt-1">
                                        <div className="w-full p-2 border-2 border-brand-orange rounded-md bg-orange-50 text-center font-bold text-brand-orange text-lg">
                                            {formatPercentage((scenarios2026[scenarioName].growthPercentage || 0) + planData.analysis.strategicScore.total + productivityGainFactor, 1)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-end pb-1">
                                    <button 
                                        onClick={() => {
                                            if(window.confirm(`Isso irá sobrescrever todos os valores manuais deste cenário com base no crescimento ajustado sobre ${anoBase}. Continuar?`)) {
                                                recalculateScenario(scenarioName);
                                            }
                                        }}
                                        className="px-3 py-2 bg-gray-800 text-white text-sm rounded-xl hover:bg-gray-700 transition-colors shadow-sm"
                                        title={`Recalcular com base nos dados atuais de ${anoBase}`}
                                    >
                                        Recalcular Projeção
                                    </button>
                                </div>
                            </div>
                            
                             <div className="p-4 bg-green-50 border border-green-200 rounded-lg mt-4">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0 bg-green-100 p-2 rounded-full text-green-600 mr-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-green-800">Como o Bônus de Produtividade é calculado:</p>
                                        <p className="text-xs text-green-700 mt-1">O bônus reflete o ganho de eficiência esperado da sua equipe, baseado em 3 fatores:</p>
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            <div className="bg-white p-2 rounded border border-green-200 text-center">
                                                <p className="text-[10px] text-gray-500 font-medium">Redução de Turnover</p>
                                                <p className="text-xs text-green-700 mt-0.5">Cada 1pp de redução = 0,5% de ganho (máx. 3%)</p>
                                            </div>
                                            <div className="bg-white p-2 rounded border border-green-200 text-center">
                                                <p className="text-[10px] text-gray-500 font-medium">ROI de Treinamento</p>
                                                <p className="text-xs text-green-700 mt-0.5">Melhoria no ROI de T&D = equipe mais produtiva (máx. 3%)</p>
                                            </div>
                                            <div className="bg-white p-2 rounded border border-green-200 text-center">
                                                <p className="text-[10px] text-gray-500 font-medium">Investimento em T&D</p>
                                                <p className="text-xs text-green-700 mt-0.5">% da folha investido em capacitação (máx. 2%)</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-green-600 mt-2 font-medium">Resultado: {formatPercentage(productivityGainFactor)} de ganho estimado por colaborador, já incluído no Crescimento Total acima.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {renderBudgetTable(scenarioName)}

                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl no-print">
                        <p className="font-bold">Como funciona a projeção?</p>
                        <p className="text-sm mt-1">
                           No modo <strong>% Crescimento</strong>, o sistema projeta {anoPlano} aplicando o "Crescimento Ajustado" sobre os dados de {anoBase}. Ao clicar em <strong>Adicionar Custo</strong> ou editar uma célula, o sistema mudará automaticamente para o modo <strong>Manual</strong>, permitindo personalização total.
                        </p>
                    </div>
                    
                    <div className="mt-4">
                        <h3 className="text-lg font-bold text-brand-blue mb-2">Análise e Ações Estratégicas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-700">Gatilhos de Decisão</label>
                                    <button onClick={() => handleGenerateTriggers(scenarioName)} disabled={isLoading[`triggers-${scenarioName}`]} className="text-xs px-2 py-1 bg-brand-orange text-white rounded hover:opacity-80 disabled:bg-gray-400 no-print">
                                        {isLoading[`triggers-${scenarioName}`] ? 'Gerando...' : 'Gerar com IA'}
                                    </button>
                                </div>
                                <textarea
                                    value={planData.scenarioRelatedData[scenarioName].decisionTriggers}
                                    onChange={e => updateDecisionTrigger(scenarioName, e.target.value)}
                                    rows={5}
                                    className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900"
                                    placeholder={`Ex: NPS > 75; Pipeline 20% acima da meta`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Ações Estratégicas</label>
                                <textarea
                                    value={planData.scenarioRelatedData[scenarioName].strategicActions}
                                    onChange={e => updateStrategicAction(scenarioName, e.target.value)}
                                    rows={5}
                                    className="w-full p-2 border border-gray-300 rounded-md mt-1 bg-white text-gray-900"
                                    placeholder={`Ex: Acelerar contratações em vendas; Aumentar budget de marketing.`}
                                />
                            </div>
                             <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg border">
                                <div className="flex flex-wrap gap-4 justify-between items-center">
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-800">Análise do Cenário com IA</h4>
                                    </div>
                                    <button onClick={() => handleGenerateAnalysis(scenarioName)} disabled={isLoading[`analysis-${scenarioName}`]} className="text-xs px-2 py-1 bg-brand-orange text-white rounded hover:opacity-80 disabled:bg-gray-400 no-print">
                                        {isLoading[`analysis-${scenarioName}`] ? 'Analisando...' : 'Analisar Impacto'}
                                    </button>
                                </div>
                                <div className="mt-2 text-xs text-gray-700 whitespace-pre-wrap bg-white p-3 rounded-md min-h-[70px] border">
                                    {planData.scenarioRelatedData[scenarioName].scenarioAnalysis || "Clique no botão para que a IA explique como sua pontuação estratégica influência este cenário."}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ScenarioPlanning;
