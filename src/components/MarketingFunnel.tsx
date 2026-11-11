
import React, { useMemo, useState } from 'react';
import { usePlan } from '../hooks/usePlanData';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';
import { MonthlyData } from '../types';

const sumMonthlyData = (data: MonthlyData): number => Object.values(data).reduce((sum, val) => sum + (val || 0), 0);

const FunnelStage: React.FC<{ title: string, color: string, children: React.ReactNode }> = ({ title, color, children }) => (
    <div className={`border-l-4 ${color} pl-4 py-3 bg-gray-50 rounded-r-lg`}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">{title}</h3>
        <div className="mt-2 space-y-2">{children}</div>
    </div>
);

const MetricDisplay: React.FC<{ label: string, value: string }> = ({ label, value }) => (
    <div className="flex justify-between items-baseline text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-bold text-gray-900">{value}</span>
    </div>
);

const ConversionRateDisplay: React.FC<{ rate: number, label: string }> = ({ rate, label }) => (
    <div className="flex justify-center items-center my-2">
        <div className="w-full border-t border-dashed border-gray-300"></div>
        <div className="flex-shrink-0 mx-2 px-2 py-1 bg-white border border-gray-300 rounded-full text-xs font-semibold text-brand-orange">
            <span>{label}: </span>
            <span>{formatPercentage(rate * 100)}</span>
        </div>
        <div className="w-full border-t border-dashed border-gray-300"></div>
    </div>
);

const MarketingFunnel: React.FC = () => {
    const { planData, summary2025, scenarios2026, baseScenario, generateMarketingFunnelAnalysis, anoPlano, anoBase } = usePlan();
    const [isLoading, setIsLoading] = useState(false);

    const funnelData = useMemo(() => {
        // --- 2025 Data ---
        const impressoes2025 = sumMonthlyData(planData.marketing.performance.impressoes);
        const cliques2025 = sumMonthlyData(planData.marketing.performance.cliques);
        const conversoes2025 = sumMonthlyData(planData.marketing.performance.conversoes);
        const vendas2025 = sumMonthlyData(planData.commercial.funilComercial.vendasFechadas);
        const investimento2025 = summary2025.investimentoMarketingTotal;
        const receita2025 = summary2025.receitaBrutaTotal;

        const ctr2025 = impressoes2025 > 0 ? cliques2025 / impressoes2025 : 0;
        const cvr2025 = cliques2025 > 0 ? conversoes2025 / cliques2025 : 0;
        const cpl2025 = conversoes2025 > 0 ? investimento2025 / conversoes2025 : 0;
        const leadToSale2025 = conversoes2025 > 0 ? vendas2025 / conversoes2025 : 0;
        const cac2025 = summary2025.cac;

        // --- 2026 Projections ---
        const growthPercentage = scenarios2026[baseScenario].growthPercentage || 0;
        const strategicGrowthFactor = planData.analysis.strategicScore?.total || 0;
        const adjustedGrowth = growthPercentage + strategicGrowthFactor;
        const growthFactor = 1 + (adjustedGrowth / 100);
        
        const investimento2026 = planData.commercialPlanning.demandPlanning.channels.reduce((sum, ch) => sum + (ch.budget || 0), 0) || (investimento2025 * growthFactor);
        const receita2026 = planData.commercialPlanning.demandPlanning.channels.reduce((sum, ch) => sum + (ch.expectedRevenue || 0), 0) || (receita2025 * growthFactor);
        
        // Assume same conversion rates initially
        const impressoes2026 = impressoes2025 * growthFactor;
        const cliques2026 = impressoes2026 * ctr2025;
        const conversoes2026 = cliques2026 * cvr2025;
        const vendas2026 = conversoes2026 * leadToSale2025;
        
        const ctr2026 = ctr2025;
        const cvr2026 = cvr2025;
        const cpl2026 = conversoes2026 > 0 ? investimento2026 / conversoes2026 : 0;
        const leadToSale2026 = leadToSale2025;
        const cac2026 = vendas2026 > 0 ? investimento2026 / vendas2026 : 0;

        const data2025 = {
            impressoes: impressoes2025, cliques: cliques2025, conversoes: conversoes2025, vendas: vendas2025,
            investimento: investimento2025, receita: receita2025,
            ctr: ctr2025, cvr: cvr2025, cpl: cpl2025, leadToSale: leadToSale2025, cac: cac2025,
        };

        const data2026 = {
            impressoes: impressoes2026, cliques: cliques2026, conversoes: conversoes2026, vendas: vendas2026,
            investimento: investimento2026, receita: receita2026,
            ctr: ctr2026, cvr: cvr2026, cpl: cpl2026, leadToSale: leadToSale2026, cac: cac2026,
        };

        return { data2025, data2026 };

    }, [planData, summary2025, scenarios2026, baseScenario]);

    const handleGenerateAnalysis = async () => {
        setIsLoading(true);
        await generateMarketingFunnelAnalysis(funnelData.data2025, funnelData.data2026);
        setIsLoading(false);
    };

    const renderFunnelColumn = (year: number, realizado: boolean, data: typeof funnelData.data2025) => (
        <div className="space-y-2">
            <h2 className="text-2xl font-bold text-center text-gray-900">{year}</h2>
            <p className="text-sm text-center text-gray-500 mb-4">{realizado ? 'Realizado' : `Projetado (Cenário ${baseScenario})`}</p>

            {/* Topo de Funil */}
            <FunnelStage title="Topo de Funil" color="border-blue-400">
                <MetricDisplay label="Impressões" value={formatNumber(data.impressoes)} />
                <MetricDisplay label="Cliques" value={formatNumber(data.cliques)} />
            </FunnelStage>

            <ConversionRateDisplay rate={data.ctr} label="CTR" />
            
            {/* Meio de Funil */}
            <FunnelStage title="Meio de Funil" color="border-yellow-400">
                <MetricDisplay label="Leads Gerados" value={formatNumber(data.conversoes)} />
                <MetricDisplay label="Custo por Lead (CPL)" value={formatCurrency(data.cpl)} />
            </FunnelStage>

            <ConversionRateDisplay rate={data.cvr} label="Taxa Conv. (Clique > Lead)" />

            {/* Fundo de Funil */}
            <FunnelStage title="Fundo de Funil" color="border-green-400">
                <MetricDisplay label="Vendas Fechadas" value={formatNumber(data.vendas)} />
                <MetricDisplay label="CAC" value={formatCurrency(data.cac)} />
            </FunnelStage>
            
            <ConversionRateDisplay rate={data.leadToSale} label="Taxa Conv. (Lead > Venda)" />

            {/* Resultado */}
             <FunnelStage title="Resultados" color="border-purple-400">
                <MetricDisplay label="Investimento MKT" value={formatCurrency(data.investimento)} />
                <MetricDisplay label="Receita Bruta" value={formatCurrency(data.receita)} />
            </FunnelStage>
        </div>
    );
    
    return (
        <div className="space-y-8">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gradient-border">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">7. Funil de Marketing & Vendas</h1>
                <p className="text-gray-500 mt-2">
                    Visualize a jornada do seu cliente desde a primeira impressão até a venda, comparando {anoBase} com a projeção para {anoPlano}.
                </p>
            </header>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {renderFunnelColumn(anoBase, true, funnelData.data2025)}
                    {renderFunnelColumn(anoPlano, false, funnelData.data2026)}
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                 <div className="flex flex-wrap gap-4 justify-between items-center border-b pb-3">
                    <h2 className="text-xl font-bold text-gray-900">Análise do Funil com IA (CMO)</h2>
                    <button onClick={handleGenerateAnalysis} disabled={isLoading} className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-brand-orange rounded-xl hover:bg-orange-700 shadow-md shadow-orange-200 btn-glow transition-colors shadow-sm disabled:bg-gray-400">
                        {isLoading ? 'Analisando...' : 'Analisar Funil & Gerar Recomendações'}
                    </button>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-md min-h-[200px] font-sans leading-relaxed">
                    {planData.analysis.marketingFunnelAnalysis || `Clique no botão para que a IA (atuando como um CMO) análise a projeção do seu funil para ${anoPlano}, identifique o principal gargalo e sugira 3 ações para otimizá-lo.`}
                </div>
            </div>
        </div>
    );
};

export default MarketingFunnel;
