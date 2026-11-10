
import React, { useState, useMemo } from 'react';
import { usePlan } from '../hooks/usePlanData';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import { MonthlyData } from '../types';
import { irpjCsllAnual } from '../utils/calculos/impostos';

const sumMonthlyData = (data: MonthlyData): number => data ? Object.values(data).reduce((s, v) => s + (v || 0), 0) : 0;

const SensitivityAnalysis: React.FC = () => {
    const { calculateSensitivityAnalysis, scenarios2026, baseScenario, taxes } = usePlan();
    const [range, setRange] = useState(20); 

    const projection = scenarios2026[baseScenario].projection;
    
    const baseRevenue = sumMonthlyData(projection.receitaBruta) - sumMonthlyData(projection.impostosSobreFaturamento);
    
    const baseVariableCost = sumMonthlyData(projection.cmv) + sumMonthlyData(projection.comissoes) + sumMonthlyData(projection.fretes) + 
        (projection.customCustosVariaveis || []).reduce((s, i) => s + sumMonthlyData(i.values), 0);
        
    const baseFixedCost = sumMonthlyData(projection.folhaPagamento) + sumMonthlyData(projection.aluguel) + 
        sumMonthlyData(projection.despesasOperacionais) + sumMonthlyData(projection.marketingFixo) + 
        sumMonthlyData(projection.administrativo) + 
        (projection.customCustosFixos || []).reduce((s, i) => s + sumMonthlyData(i.values), 0);

    const baseEbit = baseRevenue - baseVariableCost - baseFixedCost;
    const baseNetProfit = baseEbit - irpjCsllAnual(taxes || {}, sumMonthlyData(projection.receitaBruta), baseEbit);

    const contributionMarginRatio = baseRevenue > 0 ? (baseRevenue - baseVariableCost) / baseRevenue : 0;
    const breakevenRevenue = contributionMarginRatio > 0 ? baseFixedCost / contributionMarginRatio : 0;
    const safetyMarginValue = baseRevenue - breakevenRevenue;
    const safetyMarginPercent = baseRevenue > 0 ? (safetyMarginValue / baseRevenue) * 100 : 0;

    const matrix = useMemo(() => {
        if (calculateSensitivityAnalysis) {
            return calculateSensitivityAnalysis(baseRevenue, baseVariableCost, baseFixedCost, range);
        }
        return [];
    }, [calculateSensitivityAnalysis, baseRevenue, baseVariableCost, baseFixedCost, range]);

    const steps = [-range, -range/2, 0, range/2, range];

    const getCellColor = (value: number, baseValue: number) => {
        if (value < 0) return 'bg-red-100 text-red-800 font-bold border-red-200';
        if (value > baseValue * 1.1) return 'bg-green-100 text-green-800 font-bold border-green-200';
        if (value >= baseValue * 0.9 && value <= baseValue * 1.1) return 'bg-blue-50 text-blue-800 border-blue-200';
        if (value < baseValue) return 'bg-yellow-50 text-yellow-800 border-yellow-200';
        return 'bg-white text-gray-800';
    };

    // Gerar insights automáticos
    const insights = useMemo(() => {
        if (!matrix || matrix.length === 0) return [];
        const result: { icon: string; text: string; type: 'good' | 'warning' | 'danger' }[] = [];
        
        // Pior cenário (preço e volume caem no máximo)
        const worstCase = matrix[0]?.[0]?.netProfit || 0;
        const bestCase = matrix[4]?.[4]?.netProfit || 0;
        
        // Cenário de preço cai mas volume sobe
        const priceDownVolumeUp = matrix[4]?.[0]?.netProfit || 0;
        // Cenário de preço sobe mas volume cai
        const priceUpVolumeDown = matrix[0]?.[4]?.netProfit || 0;
        
        if (safetyMarginPercent > 30) {
            result.push({ icon: '🛡️', text: `Margem de segurança robusta (${safetyMarginPercent.toFixed(0).replace('.', ',')}%). Sua empresa tem boa resiliência a quedas de receita.`, type: 'good' });
        } else if (safetyMarginPercent > 15) {
            result.push({ icon: '⚠️', text: `Margem de segurança moderada (${safetyMarginPercent.toFixed(0).replace('.', ',')}%). Monitore de perto variações de receita.`, type: 'warning' });
        } else {
            result.push({ icon: '🚨', text: `Margem de segurança baixa (${safetyMarginPercent.toFixed(0).replace('.', ',')}%). Qualquer queda significativa pode gerar prejuízo.`, type: 'danger' });
        }
        
        if (priceUpVolumeDown > priceDownVolumeUp) {
            result.push({ icon: '💡', text: `Preço tem mais impacto que volume no seu lucro. Estratégia de valor agregado é mais eficaz que desconto para ganhar volume.`, type: 'good' });
        }
        
        if (worstCase < 0) {
            result.push({ icon: '🔴', text: `No pior cenário (-${range}% preço e -${range}% volume), sua empresa teria prejuízo de ${formatCurrency(Math.abs(worstCase), true)}.`, type: 'danger' });
        }
        
        if (bestCase > 0) {
            result.push({ icon: '🟢', text: `No melhor cenário (+${range}% preço e +${range}% volume), o lucro chegaria a ${formatCurrency(bestCase, true)}.`, type: 'good' });
        }

        return result;
    }, [matrix, safetyMarginPercent, range]);

    if (!matrix || matrix.length === 0) return <div className="p-6 text-center text-gray-500">Carregando análise ou dados insuficientes. Certifique-se de ter dados no cenário base.</div>;

    return (
        <div className="space-y-8">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gradient-border">
                <h1 className="text-4xl font-bold text-gray-900">Análise de Sensibilidade</h1>
                <p className="text-lg text-gray-600 mt-2">
                    Simule o impacto cruzado de variações de <strong>Preço</strong> e <strong>Volume</strong> no seu Lucro Líquido e entenda os riscos do seu negócio.
                </p>
            </header>

            {/* Resumo Executivo */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Resumo Executivo</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Receita Líquida Base</p>
                        <p className="text-2xl font-extrabold text-gray-900 mt-1">{formatCurrency(baseRevenue, true)}</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Lucro Líquido Base</p>
                        <p className={`text-2xl font-extrabold mt-1 ${baseNetProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(baseNetProfit, true)}</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Ponto de Equilíbrio</p>
                        <p className="text-2xl font-extrabold text-gray-900 mt-1">{formatCurrency(breakevenRevenue, true)}</p>
                    </div>
                    <div className={`text-center p-4 rounded-lg ${safetyMarginPercent > 20 ? 'bg-green-50' : safetyMarginPercent > 10 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Margem de Segurança</p>
                        <p className={`text-2xl font-extrabold mt-1 ${safetyMarginPercent > 20 ? 'text-green-700' : safetyMarginPercent > 10 ? 'text-yellow-700' : 'text-red-700'}`}>{formatPercentage(safetyMarginPercent)}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Queda máxima de receita antes do prejuízo</p>
                    </div>
                </div>

                {/* Insights automáticos */}
                <div className="space-y-2">
                    <h3 className="text-sm font-bold text-gray-600">Interpretação Automática:</h3>
                    {insights.map((insight, i) => (
                        <div key={i} className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                            insight.type === 'good' ? 'bg-green-50 text-green-800' :
                            insight.type === 'warning' ? 'bg-yellow-50 text-yellow-800' :
                            'bg-red-50 text-red-800'
                        }`}>
                            <span className="text-lg flex-shrink-0">{insight.icon}</span>
                            <span>{insight.text}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Controles */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-brand-blue mb-4">Como Ler a Matriz</h3>
                        <div className="space-y-3 text-sm text-gray-600">
                            <p><strong>Linhas (vertical):</strong> Variação no <strong>volume de vendas</strong> (quantidade vendida).</p>
                            <p><strong>Colunas (horizontal):</strong> Variação no <strong>preço</strong> praticado.</p>
                            <p><strong>Cada célula:</strong> Mostra o lucro líquido estimado para aquela combinação de preço e volume.</p>
                            <p><strong>Centro (0%/0%):</strong> É o seu cenário base atual, destacado em laranja.</p>
                        </div>
                        <hr className="my-4" />
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center gap-2"><span className="w-4 h-4 bg-green-100 border border-green-200 rounded"></span> Lucro acima do plano</div>
                            <div className="flex items-center gap-2"><span className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></span> Próximo do plano (±10%)</div>
                            <div className="flex items-center gap-2"><span className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded"></span> Abaixo do plano (mas com lucro)</div>
                            <div className="flex items-center gap-2"><span className="w-4 h-4 bg-red-100 border border-red-200 rounded"></span> Prejuízo</div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                        <label className="font-bold text-gray-700 block mb-2">Amplitude da Simulação</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="range" 
                                min="5" 
                                max="50" 
                                step="5" 
                                value={range} 
                                onChange={e => setRange(e.target.valueAsNumber)} 
                                className="w-full accent-brand-orange"
                            />
                            <span className="font-mono font-bold text-brand-orange text-lg w-12 text-right">{range}%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Arraste para simular cenários mais ou menos extremos.
                        </p>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
                        <h4 className="text-sm font-bold text-blue-800">Dica de Consultor</h4>
                        <p className="text-xs text-blue-700 mt-1">
                            A alavancagem operacional mostra que aumentar <strong>preço</strong> é sempre mais lucrativo que aumentar <strong>volume</strong> na mesma proporção. Isso porque o volume traz custos variáveis junto, enquanto o preço vai direto para a margem.
                        </p>
                        <p className="text-xs text-blue-700 mt-2">
                            Use esta análise para definir sua estratégia: se a margem de segurança é baixa, priorize ações que protejam o preço antes de buscar volume.
                        </p>
                    </div>
                </div>

                {/* Matrix Table */}
                <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <h3 className="text-lg font-bold text-brand-blue mb-1">Matriz de Impacto no Lucro Líquido</h3>
                    <p className="text-xs text-gray-500 mb-4">Cenário base: {baseScenario} | Valores em R$</p>
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="p-3 bg-white text-right font-medium text-gray-500 border-b border-r" rowSpan={2}>
                                        <div className="text-xs">Volume de</div>
                                        <div className="text-xs">Vendas ↓</div>
                                    </th>
                                    <th className="p-3 bg-brand-blue text-white text-center font-bold rounded-t-lg" colSpan={5}>
                                        Variação de Preço →
                                    </th>
                                </tr>
                                <tr>
                                    {steps.map(step => (
                                        <th key={step} className={`p-3 bg-gray-50 text-center min-w-[110px] border-b ${step === 0 ? 'border-x-2 border-x-brand-orange/30 bg-orange-50 font-bold text-brand-orange' : 'font-semibold'}`}>
                                            {step > 0 ? '+' : ''}{step}%
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {matrix.map((row, rowIndex) => {
                                    const volStep = steps[rowIndex];
                                    return (
                                        <tr key={rowIndex}>
                                            <td className={`p-3 bg-gray-50 font-bold text-right border-r ${volStep === 0 ? 'border-y-2 border-y-brand-orange/30 bg-orange-50 text-brand-orange' : ''}`}>
                                                {volStep > 0 ? '+' : ''}{volStep}%
                                            </td>
                                            {row.map((cell, colIndex) => {
                                                const priceStep = steps[colIndex];
                                                const isCenter = volStep === 0 && priceStep === 0;
                                                return (
                                                    <td key={colIndex} className={`p-3 border text-right transition-colors hover:brightness-95 ${getCellColor(cell.netProfit, baseNetProfit)} ${isCenter ? 'ring-2 ring-brand-orange ring-inset' : ''}`}>
                                                        <div className="text-sm font-semibold">{formatCurrency(cell.netProfit, true)}</div>
                                                        <div className="text-[10px] opacity-70 mt-0.5">Margem {formatPercentage(cell.margin)}</div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SensitivityAnalysis;
