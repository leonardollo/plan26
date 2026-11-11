import React, { useMemo } from 'react';
import { usePlan } from '../hooks/usePlanData';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import CurrencyInput from './shared/CurrencyInput';
import clsx from 'clsx';

const ProductPortfolio: React.FC = () => {
    const { planData, updateProductPortfolioItem, addProductPortfolioItem, removeProductPortfolioItem, anoBase } = usePlan();

    // Calcular Curva ABC com Margem de Contribuicao
    const abcAnalysis = useMemo(() => {
        const products = planData.productPortfolio.filter(p => (p.revenue2025 || 0) > 0);
        if (products.length === 0) return { items: [], totalRevenue: 0, totalMargin: 0 };

        const totalRevenue = products.reduce((sum, p) => sum + (p.revenue2025 || 0), 0);
        const sorted = [...products].sort((a, b) => (b.revenue2025 || 0) - (a.revenue2025 || 0));
        
        let cumulative = 0;
        const items = sorted.map(p => {
            const revenue = p.revenue2025 || 0;
            const cost = p.cost2025 || 0;
            const margin = revenue - cost;
            const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;
            const percent = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
            cumulative += percent;
            let classification: 'A' | 'B' | 'C' = 'C';
            if (cumulative <= 80) classification = 'A';
            else if (cumulative <= 95) classification = 'B';
            
            return {
                id: p.id,
                name: p.name,
                revenue,
                cost,
                margin,
                marginPercent,
                percent,
                cumulative,
                classification
            };
        });

        const totalMargin = items.reduce((s, i) => s + i.margin, 0);
        return { items, totalRevenue, totalMargin };
    }, [planData.productPortfolio]);

    const classColors = {
        'A': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        'B': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
        'C': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', bar: 'bg-red-400', badge: 'bg-red-100 text-red-600 border-red-200' },
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
            <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-purple-100 rounded-xl">
                    <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Análise de Portfolio (Curva ABC)</h2>
                    <p className="text-xs text-gray-400">Liste seus produtos/servicos com receita e custo para ver a classificação ABC e margem de contribuição</p>
                </div>
            </div>
            
            {/* Tabela de entrada com Custo */}
            <div className="overflow-x-auto mt-4">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold text-gray-600 w-1/4">Produto/Servico</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-600">Receita {anoBase} (R$)</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-600">Custo Direto {anoBase} (R$)</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-600">Quantidade Vendida</th>
                            <th className="px-4 py-3 text-center font-semibold text-gray-600 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {planData.productPortfolio.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-2">
                                    <input 
                                        type="text" 
                                        value={item.name} 
                                        onChange={e => updateProductPortfolioItem(item.id, 'name', e.target.value)}
                                        placeholder="Nome do produto..."
                                        className="w-full bg-transparent p-2 border-0 focus:ring-1 focus:ring-brand-orange rounded-lg text-sm"
                                    />
                                </td>
                                <td className="px-2">
                                    <CurrencyInput 
                                        value={item.revenue2025 ?? null} 
                                        onChange={(v) => updateProductPortfolioItem(item.id, 'revenue2025', v)}
                                        placeholder="0"
                                        className="w-full bg-transparent p-2 text-right border-0 focus:ring-1 focus:ring-brand-orange rounded-lg text-sm"
                                    />
                                </td>
                                <td className="px-2">
                                    <CurrencyInput 
                                        value={item.cost2025 ?? null} 
                                        onChange={(v) => updateProductPortfolioItem(item.id, 'cost2025', v)}
                                        placeholder="0"
                                        className="w-full bg-transparent p-2 text-right border-0 focus:ring-1 focus:ring-brand-orange rounded-lg text-sm"
                                    />
                                </td>
                                <td className="px-2">
                                    <CurrencyInput 
                                        value={item.quantitySold2025 ?? null} 
                                        onChange={(v) => updateProductPortfolioItem(item.id, 'quantitySold2025', v)}
                                        placeholder="0"
                                        className="w-full bg-transparent p-2 text-right border-0 focus:ring-1 focus:ring-brand-orange rounded-lg text-sm"
                                    />
                                </td>
                                <td className="text-center px-2">
                                    <button onClick={() => removeProductPortfolioItem(item.id)} className="text-red-300 hover:text-red-500 transition-colors">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button onClick={addProductPortfolioItem} className="mt-3 flex items-center gap-1.5 text-brand-orange font-semibold hover:text-orange-700 text-sm transition-colors">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Adicionar Produto/Servico
                </button>
            </div>

            {/* Visualizacao da Curva ABC com Margem */}
            {abcAnalysis.items.length > 0 && (
                <div className="mt-8 space-y-5">
                    <h3 className="text-base font-bold text-gray-900">Resultado da Curva ABC + Margem de Contribuição</h3>
                    
                    {/* Legenda */}
                    <div className="flex flex-wrap gap-4 text-xs">
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-500 rounded-full"></span> <strong>Classe A</strong> (ate 80% da receita) - Prioridade maxima</div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-500 rounded-full"></span> <strong>Classe B</strong> (80-95%) - Atencao moderada</div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-400 rounded-full"></span> <strong>Classe C</strong> (95-100%) - Avaliar necessidade</div>
                    </div>

                    {/* Tabela detalhada com Margem */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 border-y border-gray-200">
                                <tr>
                                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Classe</th>
                                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Produto/Servico</th>
                                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Receita</th>
                                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Custo Direto</th>
                                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Margem de Contribuição</th>
                                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Margem %</th>
                                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">% Receita</th>
                                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Barra</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {abcAnalysis.items.map(item => {
                                    const colors = classColors[item.classification];
                                    const marginColor = item.marginPercent >= 40 ? 'text-emerald-600' : item.marginPercent >= 20 ? 'text-amber-600' : 'text-red-500';
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2.5">
                                                <span className={clsx("px-2.5 py-1 rounded-full text-xs font-bold border", colors.badge)}>
                                                    {item.classification}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 font-medium text-gray-800">{item.name}</td>
                                            <td className="px-3 py-2.5 text-right text-gray-700">{formatCurrency(item.revenue, true)}</td>
                                            <td className="px-3 py-2.5 text-right text-gray-500">{formatCurrency(item.cost, true)}</td>
                                            <td className="px-3 py-2.5 text-right font-bold text-gray-900">{formatCurrency(item.margin, true)}</td>
                                            <td className={clsx("px-3 py-2.5 text-right font-bold", marginColor)}>{formatPercentage(item.marginPercent, 1)}</td>
                                            <td className="px-3 py-2.5 text-right text-gray-500">{formatPercentage(item.percent, 1)}</td>
                                            <td className="px-3 py-2.5 w-32">
                                                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className={clsx("h-full rounded-full transition-all", colors.bar)} style={{ width: `${Math.min(item.percent * 1.25, 100)}%` }} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {/* Totais */}
                                <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                                    <td className="px-3 py-3" colSpan={2}>TOTAL</td>
                                    <td className="px-3 py-3 text-right">{formatCurrency(abcAnalysis.totalRevenue, true)}</td>
                                    <td className="px-3 py-3 text-right text-gray-500">{formatCurrency(abcAnalysis.items.reduce((s, i) => s + i.cost, 0), true)}</td>
                                    <td className="px-3 py-3 text-right">{formatCurrency(abcAnalysis.totalMargin, true)}</td>
                                    <td className="px-3 py-3 text-right">{abcAnalysis.totalRevenue > 0 ? formatPercentage((abcAnalysis.totalMargin / abcAnalysis.totalRevenue) * 100, 1) : '0%'}</td>
                                    <td className="px-3 py-3 text-right">100%</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Resumo por Classe */}
                    <div className="grid grid-cols-3 gap-4">
                        {(['A', 'B', 'C'] as const).map(cls => {
                            const items = abcAnalysis.items.filter(i => i.classification === cls);
                            const revenue = items.reduce((s, i) => s + i.revenue, 0);
                            const margin = items.reduce((s, i) => s + i.margin, 0);
                            const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
                            const revenuePct = abcAnalysis.totalRevenue > 0 ? (revenue / abcAnalysis.totalRevenue) * 100 : 0;
                            const colors = classColors[cls];
                            return (
                                <div key={cls} className={clsx("p-4 rounded-2xl border", colors.bg, colors.border)}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={clsx("text-xl font-extrabold", colors.text)}>Classe {cls}</span>
                                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-bold border", colors.badge)}>{items.length} {items.length === 1 ? 'produto' : 'produtos'}</span>
                                    </div>
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Receita:</span>
                                            <span className="font-bold text-gray-800">{formatCurrency(revenue, true)} ({formatPercentage(revenuePct, 0)})</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Margem de Contribuição:</span>
                                            <span className="font-bold text-gray-800">{formatCurrency(margin, true)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Margem %:</span>
                                            <span className={clsx("font-bold", marginPct >= 40 ? 'text-emerald-600' : marginPct >= 20 ? 'text-amber-600' : 'text-red-500')}>{formatPercentage(marginPct, 1)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Insight de Consultor */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-start gap-2">
                            <svg className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                            <div className="text-sm text-blue-800">
                                <p className="font-bold mb-1">Dica do Consultor</p>
                                <p className="leading-relaxed">
                                    {(() => {
                                        const classA = abcAnalysis.items.filter(i => i.classification === 'A');
                                        const lowMarginA = classA.filter(i => i.marginPercent < 25);
                                        const highMarginC = abcAnalysis.items.filter(i => i.classification === 'C' && i.marginPercent > 40);
                                        
                                        if (lowMarginA.length > 0) {
                                            return `Atencao: ${lowMarginA.map(i => `"${i.name}"`).join(', ')} ${lowMarginA.length === 1 ? 'e' : 'sao'} Classe A em receita mas ${lowMarginA.length === 1 ? 'tem' : 'tem'} margem baixa (abaixo de 25%). Considere renegociar custos ou reajustar precos desses produtos prioritarios.`;
                                        }
                                        if (highMarginC.length > 0) {
                                            return `Oportunidade: ${highMarginC.map(i => `"${i.name}"`).join(', ')} ${highMarginC.length === 1 ? 'e' : 'sao'} Classe C mas ${highMarginC.length === 1 ? 'tem' : 'tem'} margem alta (acima de 40%). Investir em vendas desses produtos pode ser muito lucrativo.`;
                                        }
                                        return 'Análise a relação entre classificação ABC e margem de contribuição. Produtos Classe A com margem baixa precisam de atencao urgente. Produtos Classe C com margem alta sao oportunidades de crescimento.';
                                    })()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductPortfolio;
