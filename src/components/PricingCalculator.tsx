
import React, { useState, useMemo, useEffect } from 'react';
import { usePlan } from '../hooks/usePlanData';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';
import CurrencyInput from './shared/CurrencyInput';
import { v4 as uuidv4 } from 'uuid';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid, ReferenceLine, PieChart, Pie, Legend, LineChart, Line } from 'recharts';
import type { PricingItem, DetailedCostBreakdown } from '../types';
import clsx from 'clsx';

// --- HELPER COMPONENTS ---
const Card: React.FC<{ title: string; children: React.ReactNode; className?: string; icon?: React.ReactNode }> = ({ title, children, className, icon }) => (
    <div className={clsx("bg-white p-5 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow", className)}>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
            {icon}
            {title}
        </h3>
        {children}
    </div>
);

const InputGroup: React.FC<{ label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; hint?: string; max?: number; disabled?: boolean }> = ({ label, value, onChange, prefix, suffix, hint, max, disabled }) => (
    <div className="mb-3">
        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">{label}</label>
        <div className="relative">
            {prefix && <span className="absolute left-3 top-2.5 text-gray-500 text-sm z-10">{prefix}</span>}
            <CurrencyInput 
                value={value} 
                onChange={(v) => onChange(parseFloat(v) || 0)} 
                disabled={disabled}
                className={clsx("w-full p-2 border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-brand-orange focus:border-brand-orange disabled:bg-gray-100 disabled:text-gray-500", prefix && "pl-8", suffix && "pr-8")}
            />
            {suffix && <span className="absolute right-3 top-2.5 text-gray-500 text-sm z-10">{suffix}</span>}
        </div>
        {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
);

const FunnelStep: React.FC<{ label: string; value: number; unit?: string; color: string; isLast?: boolean; subLabel?: string }> = ({ label, value, unit = '', color, isLast, subLabel }) => (
    <div className="flex flex-col items-center relative z-10 w-full group">
        <div className={clsx("w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center border-4 shadow-md bg-white transition-transform hover:scale-105", color)}>
            <span className="text-lg sm:text-xl font-extrabold text-gray-800">{formatNumber(value, false)}</span>
            {unit && <span className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase">{unit}</span>}
        </div>
        <p className="text-[10px] sm:text-xs font-bold mt-2 uppercase text-gray-600 text-center">{label}</p>
        {subLabel && <p className="text-[9px] text-gray-400 text-center mt-0.5">{subLabel}</p>}
        {!isLast && <div className="absolute top-10 sm:top-12 left-1/2 w-full h-1 border-t-2 border-dashed border-gray-300 -z-10" style={{ transform: 'translateX(50%)' }}></div>}
    </div>
);

const BreakdownChart: React.FC<{ data: { name: string; value: number; color: string; percentage: number }[] }> = ({ data }) => (
    <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    </div>
);

// --- MAIN COMPONENT ---
const PricingCalculator: React.FC = () => {
    const { pricingItems, addPricingItem, removePricingItem, taxes, summary2025 } = usePlan();
    const [activeTab, setActiveTab] = useState<'editor' | 'list' | 'mix' | 'simulator'>('editor');
    
    // Editor State
    const [name, setName] = useState('');
    const [type, setType] = useState<'product' | 'service'>('product');
    const [salesModel, setSalesModel] = useState<'direct' | 'consultative'>('direct');
    const [estimatedMonthlyVolume, setEstimatedMonthlyVolume] = useState(1);

    // Detailed Costs State
    const initialDetailedCosts: DetailedCostBreakdown = {
        purchasePrice: 0, inboundFreight: 0, packaging: 0, otherDirectCosts: 0,
        hourlyRate: 0, hoursSpent: 0, softwareCosts: 0, travelCosts: 0,
        thirdPartyService: 0, materials: 0
    };
    const [detailedCosts, setDetailedCosts] = useState<DetailedCostBreakdown>(initialDetailedCosts);

    // Calculated Direct Cost
    const directCost = useMemo(() => {
        if (type === 'product') {
            return detailedCosts.purchasePrice + detailedCosts.inboundFreight + detailedCosts.packaging + detailedCosts.otherDirectCosts;
        } else {
            return (detailedCosts.hourlyRate * detailedCosts.hoursSpent) + detailedCosts.softwareCosts + detailedCosts.travelCosts + detailedCosts.thirdPartyService + detailedCosts.materials;
        }
    }, [detailedCosts, type]);

    // Rates & Markup
    const [markupTarget, setMarkupTarget] = useState(20);
    const [variableCostRate, setVariableCostRate] = useState(0);
    const [fixedCostRate, setFixedCostRate] = useState(0);
    const [taxRate, setTaxRate] = useState(0);
    const [marketPrice, setMarketPrice] = useState(0);
    
    // Behavioral & Funnel
    const [behavioralScore, setBehavioralScore] = useState(5);
    const [workingDays, setWorkingDays] = useState(22);
    
    const [funnelRates, setFunnelRates] = useState({
        leadToConversation: 30, conversationToMeeting: 20, meetingToProposal: 50, proposalToSale: 20,
        trafficToCart: 2, cartToSale: 30
    });

    // Simulator state
    const [simDiscount, setSimDiscount] = useState(0);
    const [simVolume, setSimVolume] = useState(100);

    // Load defaults
    useEffect(() => {
        const historicalRevenue = summary2025.receitaBrutaTotal || 1;
        setVariableCostRate(5);
        const fixedRate = (summary2025.custosFixosTotal / historicalRevenue) * 100;
        setFixedCostRate(parseFloat(fixedRate.toFixed(2)) || 20);
        setTaxRate(taxes.aliquotaEfetiva || 10);
    }, [summary2025, taxes]);

    // --- FINANCIAL CALCULATIONS (MARKUP DIVISOR) ---
    const financialCalc = useMemo(() => {
        const totalRates = taxRate + variableCostRate + fixedCostRate + markupTarget;
        const divisor = 1 - (totalRates / 100);
        let suggestedPrice = 0;
        let isValid = true;
        let errorMessage = '';

        if (totalRates >= 100) {
            isValid = false;
            errorMessage = "A soma das taxas ultrapassa 100%. O preco e matematicamente impossivel.";
        } else if (directCost <= 0) {
            isValid = false;
            errorMessage = "Insira os custos diretos para calcular.";
        } else {
            suggestedPrice = directCost / divisor;
        }

        let strategicMultiplier = 1;
        if (behavioralScore >= 8) strategicMultiplier = 1.15;
        else if (behavioralScore <= 4) strategicMultiplier = 0.90;
        
        const finalPrice = suggestedPrice * strategicMultiplier; 
        
        const taxesValue = finalPrice * (taxRate / 100);
        const variableValue = finalPrice * (variableCostRate / 100);
        const fixedValue = finalPrice * (fixedCostRate / 100);
        const profitValue = finalPrice - directCost - taxesValue - variableValue - fixedValue;
        
        const contributionMargin = finalPrice - directCost - taxesValue - variableValue;
        const contributionMarginPercent = finalPrice > 0 ? (contributionMargin / finalPrice) * 100 : 0;
        const markupMultiplier = directCost > 0 ? finalPrice / directCost : 0;
        const netProfitPercent = finalPrice > 0 ? (profitValue / finalPrice) * 100 : 0;

        // Markup por Fora (multiplicador)
        const markupPorFora = directCost > 0 ? ((finalPrice - directCost) / directCost) * 100 : 0;
        // Margem Bruta
        const grossMargin = finalPrice > 0 ? ((finalPrice - directCost) / finalPrice) * 100 : 0;

        const breakdownData = [
            { name: 'Custo Direto', value: directCost, color: '#6b7280', percentage: finalPrice > 0 ? (directCost / finalPrice) * 100 : 0 },
            { name: 'Impostos', value: taxesValue, color: '#ef4444', percentage: taxRate },
            { name: 'Comissoes/Var.', value: variableValue, color: '#f59e0b', percentage: variableCostRate },
            { name: 'Rateio Fixo', value: fixedValue, color: '#3b82f6', percentage: fixedCostRate },
            { name: 'Lucro Liquido', value: profitValue, color: '#10b981', percentage: netProfitPercent }
        ];

        // Comparativo com mercado
        const marketDiff = marketPrice > 0 ? ((finalPrice - marketPrice) / marketPrice) * 100 : 0;
        const marketMargin = marketPrice > 0 ? marketPrice - directCost - (marketPrice * taxRate / 100) - (marketPrice * variableCostRate / 100) - (marketPrice * fixedCostRate / 100) : 0;

        return { 
            suggestedPrice, finalPrice, isValid, errorMessage, 
            contributionMargin, contributionMarginPercent, netProfit: profitValue, netProfitPercent,
            divisor, totalRates, markupMultiplier, markupPorFora, grossMargin,
            breakdownData, marketDiff, marketMargin,
            taxesValue, variableValue, fixedValue
        };
    }, [directCost, markupTarget, variableCostRate, fixedCostRate, taxRate, behavioralScore, marketPrice]);

    // --- FUNNEL CALCULATIONS ---
    const funnelCalc = useMemo(() => {
        if (!financialCalc.isValid || financialCalc.finalPrice <= 0) return null;
        const unitsNeeded = estimatedMonthlyVolume;

        if (salesModel === 'consultative') {
            const sales = unitsNeeded;
            const proposals = sales / (funnelRates.proposalToSale / 100);
            const meetings = proposals / (funnelRates.meetingToProposal / 100);
            const conversations = meetings / (funnelRates.conversationToMeeting / 100);
            const leads = conversations / (funnelRates.leadToConversation / 100);
            const days = workingDays || 22;
            return { 
                unitsNeeded, leads: Math.ceil(leads), conversations: Math.ceil(conversations), 
                meetings: Math.ceil(meetings), proposals: Math.ceil(proposals), sales: Math.ceil(sales),
                dailyLeads: Math.ceil(leads / days), dailyMeetings: Math.ceil(meetings / days),
                dailyProposals: parseFloat((proposals / days).toFixed(1)),
                dailySales: parseFloat((sales / days).toFixed(2))
            };
        } else {
            const sales = unitsNeeded;
            const carts = sales / (funnelRates.cartToSale / 100);
            const traffic = carts / (funnelRates.trafficToCart / 100);
            const days = workingDays || 22;
            return {
                unitsNeeded, sales: Math.ceil(sales), carts: Math.ceil(carts), traffic: Math.ceil(traffic), 
                dailyTraffic: Math.ceil(traffic / days),
                dailySales: parseFloat((sales / days).toFixed(2))
            };
        }
    }, [financialCalc, funnelRates, workingDays, salesModel, estimatedMonthlyVolume]);

    // --- MIX ANALYSIS ---
    const mixAnalysis = useMemo(() => {
        if (pricingItems.length === 0) return null;
        const globalFixedCosts = summary2025.custosFixosTotal / 12;
        
        let totalRevenueMix = 0;
        let totalMarginMix = 0;
        let totalDirectCostMix = 0;
        let totalProfitMix = 0;
        
        const productsWithShare = pricingItems.map(item => {
            const revenue = item.finalPrice * item.estimatedMonthlyVolume;
            const margin = item.contributionMargin * item.estimatedMonthlyVolume;
            const profit = item.netProfit * item.estimatedMonthlyVolume;
            const cost = item.directCost * item.estimatedMonthlyVolume;
            totalRevenueMix += revenue;
            totalMarginMix += margin;
            totalProfitMix += profit;
            totalDirectCostMix += cost;
            return { ...item, revenue, margin, profit, cost };
        });

        const sortedByMargin = [...productsWithShare].sort((a,b) => b.margin - a.margin);
        let accumulatedMargin = 0;
        const abcList = sortedByMargin.map(item => {
            accumulatedMargin += item.margin;
            const share = totalMarginMix > 0 ? accumulatedMargin / totalMarginMix : 0;
            let classification = 'C';
            if (share <= 0.8) classification = 'A';
            else if (share <= 0.95) classification = 'B';
            return { ...item, classification, shareOfMargin: item.margin / totalMarginMix };
        });

        const weightedMarginPercent = totalRevenueMix > 0 ? totalMarginMix / totalRevenueMix : 0;
        const globalBreakEvenRevenue = weightedMarginPercent > 0 ? globalFixedCosts / weightedMarginPercent : 0;
        
        let breakEvenDay = 31;
        if (totalRevenueMix > 0 && globalBreakEvenRevenue > 0) {
            breakEvenDay = Math.ceil((globalBreakEvenRevenue / totalRevenueMix) * 30);
        }

        const timelineData = [];
        let accMargin = 0;
        const dailyMargin = totalMarginMix / 30;
        for (let day = 1; day <= 30; day++) {
            accMargin += dailyMargin;
            const netResult = accMargin - globalFixedCosts;
            timelineData.push({ day, netResult, isPositive: netResult >= 0, accumulatedMargin: accMargin, fixedCost: globalFixedCosts });
        }

        // Pie chart data for revenue composition
        const pieData = productsWithShare.map(item => ({
            name: item.name,
            value: item.revenue,
        }));

        return { 
            totalRevenueMix, totalMarginMix, totalProfitMix, totalDirectCostMix,
            globalFixedCosts, weightedMarginPercent, 
            globalBreakEvenRevenue, breakEvenDay, abcList, timelineData, pieData
        };
    }, [pricingItems, summary2025.custosFixosTotal]);

    // --- DISCOUNT SIMULATOR ---
    const simCalc = useMemo(() => {
        if (!financialCalc.isValid) return null;
        const originalPrice = financialCalc.finalPrice;
        const discountedPrice = originalPrice * (1 - simDiscount / 100);
        
        const taxesVal = discountedPrice * (taxRate / 100);
        const variableVal = discountedPrice * (variableCostRate / 100);
        const fixedVal = discountedPrice * (fixedCostRate / 100);
        const profitPerUnit = discountedPrice - directCost - taxesVal - variableVal - fixedVal;
        const marginPerUnit = discountedPrice - directCost - taxesVal - variableVal;
        
        const totalRevenueOriginal = originalPrice * simVolume;
        const totalProfitOriginal = financialCalc.netProfit * simVolume;
        
        const totalRevenueDiscounted = discountedPrice * simVolume;
        const totalProfitDiscounted = profitPerUnit * simVolume;
        
        // Volume needed to maintain same total profit
        const volumeToMaintain = profitPerUnit > 0 ? Math.ceil(totalProfitOriginal / profitPerUnit) : Infinity;
        const volumeIncrease = volumeToMaintain - simVolume;
        const volumeIncreasePercent = simVolume > 0 ? (volumeIncrease / simVolume) * 100 : 0;

        // Max discount before loss
        const maxDiscount = originalPrice > 0 ? ((originalPrice - directCost - (originalPrice * (taxRate + variableCostRate + fixedCostRate) / 100)) / originalPrice) * 100 : 0;

        // Sensitivity data
        const sensitivityData = [];
        for (let d = 0; d <= 30; d += 5) {
            const dp = originalPrice * (1 - d / 100);
            const tp = dp - directCost - (dp * (taxRate + variableCostRate + fixedCostRate) / 100);
            sensitivityData.push({
                desconto: `${d}%`,
                lucroUnit: tp,
                lucroTotal: tp * simVolume,
            });
        }

        return {
            originalPrice, discountedPrice, profitPerUnit, marginPerUnit,
            totalRevenueOriginal, totalProfitOriginal,
            totalRevenueDiscounted, totalProfitDiscounted,
            volumeToMaintain, volumeIncrease, volumeIncreasePercent,
            maxDiscount, sensitivityData
        };
    }, [financialCalc, simDiscount, simVolume, directCost, taxRate, variableCostRate, fixedCostRate]);

    const handleSave = () => {
        if (!name || !financialCalc.isValid) return;
        addPricingItem({
            id: uuidv4(), name, type, salesModel, estimatedMonthlyVolume, detailedCosts, directCost, markupTarget,
            taxRate, variableCostRate, fixedCostRate, behavioralScore, funnelRates, workingDays,
            suggestedPrice: financialCalc.suggestedPrice,
            finalPrice: financialCalc.finalPrice,
            contributionMargin: financialCalc.contributionMargin,
            contributionMarginPercent: financialCalc.contributionMarginPercent,
            netProfit: financialCalc.netProfit,
            netProfitPercent: financialCalc.netProfitPercent,
            breakEvenUnits: funnelCalc ? Math.ceil(funnelCalc.unitsNeeded) : 0,
            breakEvenRevenue: funnelCalc ? funnelCalc.unitsNeeded * financialCalc.finalPrice : 0
        });
        setActiveTab('list');
        setName('');
        setEstimatedMonthlyVolume(1);
        setDetailedCosts(initialDetailedCosts);
        setMarkupTarget(20);
        setBehavioralScore(5);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const COLORS = ['#EE7533', '#213242', '#28A745', '#FFC107', '#6f42c1', '#dc3545', '#17a2b8', '#fd7e14'];

    return (
        <div className="space-y-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Precificação Estratégica</h1>
                    <p className="text-gray-500 mt-2">
                        Formacao de preco profissional com Markup Divisor, analise de margem, simulador de descontos e curva ABC.
                    </p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg flex-wrap">
                    <button onClick={() => setActiveTab('editor')} className={clsx("px-3 py-2 rounded-md text-sm font-bold transition-all", activeTab === 'editor' ? "bg-white text-brand-orange shadow-sm" : "text-gray-500")}>Calculadora</button>
                    <button onClick={() => setActiveTab('simulator')} className={clsx("px-3 py-2 rounded-md text-sm font-bold transition-all", activeTab === 'simulator' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500")}>Simulador</button>
                    <button onClick={() => setActiveTab('list')} className={clsx("px-3 py-2 rounded-md text-sm font-bold transition-all", activeTab === 'list' ? "bg-white text-brand-blue shadow-sm" : "text-gray-500")}>Itens ({pricingItems.length})</button>
                    <button onClick={() => setActiveTab('mix')} className={clsx("px-3 py-2 rounded-md text-sm font-bold transition-all", activeTab === 'mix' ? "bg-white text-green-700 shadow-sm" : "text-gray-500")}>Mix & ABC</button>
                </div>
            </header>

            {/* ===== CALCULADORA ===== */}
            {activeTab === 'editor' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    {/* Left Column: Inputs */}
                    <div className="xl:col-span-4 space-y-6">
                        <Card title="1. Definicao do Item" icon={<span className="w-5 h-5 bg-brand-orange/10 rounded flex items-center justify-center text-brand-orange text-xs font-bold">1</span>}>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Nome</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-xl" placeholder="Ex: Produto A ou Consultoria" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipo</label>
                                        <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-2 border rounded-xl">
                                            <option value="product">Produto</option>
                                            <option value="service">Servico</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Venda</label>
                                        <select value={salesModel} onChange={e => setSalesModel(e.target.value as any)} className="w-full p-2 border rounded-xl">
                                            <option value="direct">Direta</option>
                                            <option value="consultative">Consultiva</option>
                                        </select>
                                    </div>
                                </div>
                                <InputGroup label="Previsao Vendas/Mes" value={estimatedMonthlyVolume} onChange={setEstimatedMonthlyVolume} suffix="un." hint="Impacta no Mix Global." />
                            </div>
                        </Card>

                        <Card title="2. Composicao de Custo Direto" icon={<span className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center text-gray-600 text-xs font-bold">2</span>}>
                            <div className="space-y-2">
                                {type === 'product' ? (
                                    <>
                                        <InputGroup label="Custo Aquisição/Produção" value={detailedCosts.purchasePrice} onChange={v => setDetailedCosts(p => ({...p, purchasePrice: v}))} prefix="R$" />
                                        <InputGroup label="Frete Entrada (Unit.)" value={detailedCosts.inboundFreight} onChange={v => setDetailedCosts(p => ({...p, inboundFreight: v}))} prefix="R$" />
                                        <InputGroup label="Embalagem" value={detailedCosts.packaging} onChange={v => setDetailedCosts(p => ({...p, packaging: v}))} prefix="R$" />
                                        <InputGroup label="Outros Custos Diretos" value={detailedCosts.otherDirectCosts} onChange={v => setDetailedCosts(p => ({...p, otherDirectCosts: v}))} prefix="R$" />
                                    </>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <InputGroup label="Custo Hora Tecnica" value={detailedCosts.hourlyRate} onChange={v => setDetailedCosts(p => ({...p, hourlyRate: v}))} prefix="R$" />
                                            <InputGroup label="Horas Gastas" value={detailedCosts.hoursSpent} onChange={v => setDetailedCosts(p => ({...p, hoursSpent: v}))} suffix="h" />
                                        </div>
                                        <InputGroup label="Softwares/Licencas (Unit)" value={detailedCosts.softwareCosts} onChange={v => setDetailedCosts(p => ({...p, softwareCosts: v}))} prefix="R$" />
                                        <InputGroup label="Deslocamento" value={detailedCosts.travelCosts} onChange={v => setDetailedCosts(p => ({...p, travelCosts: v}))} prefix="R$" />
                                        <InputGroup label="Terceirizados" value={detailedCosts.thirdPartyService} onChange={v => setDetailedCosts(p => ({...p, thirdPartyService: v}))} prefix="R$" />
                                        <InputGroup label="Materiais/Insumos" value={detailedCosts.materials} onChange={v => setDetailedCosts(p => ({...p, materials: v}))} prefix="R$" />
                                        <InputGroup label="Outros Custos" value={detailedCosts.otherDirectCosts} onChange={v => setDetailedCosts(p => ({...p, otherDirectCosts: v}))} prefix="R$" />
                                    </>
                                )}
                                <div className="bg-gray-100 p-3 rounded-xl text-right font-bold text-gray-700 border">
                                    Total Custo Direto: <span className="text-lg">{formatCurrency(directCost)}</span>
                                </div>
                            </div>
                        </Card>

                        <Card title="3. Formacao de Preco (Markup Divisor)" icon={<span className="w-5 h-5 bg-red-50 rounded flex items-center justify-center text-red-600 text-xs font-bold">3</span>}>
                            <div className="space-y-3">
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                                    <p className="font-bold mb-1">Como funciona o Markup Divisor?</p>
                                    <p>Preco = Custo Direto / (1 - Soma das Taxas%)</p>
                                    <p className="mt-1">Isso garante que impostos, comissoes e custos fixos que incidem sobre a venda sejam cobertos automaticamente.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <InputGroup label="Impostos s/ Venda" value={taxRate} onChange={setTaxRate} suffix="%" hint={`Aliquota efetiva: ${formatPercentage(taxes.aliquotaEfetiva)}`} />
                                    <InputGroup label="Comissoes/Taxas" value={variableCostRate} onChange={setVariableCostRate} suffix="%" hint="Cartao, comissao vendedor" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <InputGroup label="Rateio Custo Fixo" value={fixedCostRate} onChange={setFixedCostRate} suffix="%" hint="Baseado no historico" />
                                    <InputGroup label="Margem Liquida (Meta)" value={markupTarget} onChange={setMarkupTarget} suffix="%" hint="O que sobra no bolso" />
                                </div>
                                
                                {/* Divisor Visual */}
                                <div className="bg-gray-50 p-3 rounded-xl border space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Soma das Taxas:</span>
                                        <span className={clsx("font-bold", financialCalc.totalRates >= 100 ? "text-red-600" : "text-gray-900")}>{formatPercentage(financialCalc.totalRates)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Divisor (1 - Taxas):</span>
                                        <span className={clsx("font-bold", financialCalc.divisor <= 0 ? "text-red-600" : "text-green-600")}>{financialCalc.divisor.toFixed(4).replace('.', ',')}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <div className="h-3 rounded-full flex">
                                            <div className="bg-red-400 h-full" style={{ width: `${Math.min(taxRate, 100)}%` }} title="Impostos"></div>
                                            <div className="bg-yellow-400 h-full" style={{ width: `${Math.min(variableCostRate, 100 - taxRate)}%` }} title="Comissoes"></div>
                                            <div className="bg-blue-400 h-full" style={{ width: `${Math.min(fixedCostRate, 100 - taxRate - variableCostRate)}%` }} title="Fixos"></div>
                                            <div className="bg-green-400 h-full" style={{ width: `${Math.min(markupTarget, 100 - taxRate - variableCostRate - fixedCostRate)}%` }} title="Margem"></div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-[9px] text-gray-400">
                                        <span className="text-red-500">Imp. {formatPercentage(taxRate)}</span>
                                        <span className="text-yellow-600">Com. {formatPercentage(variableCostRate)}</span>
                                        <span className="text-blue-500">Fix. {formatPercentage(fixedCostRate)}</span>
                                        <span className="text-green-600">Lucro {formatPercentage(markupTarget)}</span>
                                    </div>
                                </div>

                                {financialCalc.divisor <= 0 && (
                                    <div className="p-2 bg-red-100 text-red-700 text-xs rounded-xl border border-red-200">
                                        <strong>Erro:</strong> A soma das porcentagens ultrapassa 100%.
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card title="4. Referencia de Mercado" icon={<span className="w-5 h-5 bg-purple-50 rounded flex items-center justify-center text-purple-600 text-xs font-bold">4</span>}>
                            <InputGroup label="Preco do Concorrente / Mercado" value={marketPrice} onChange={setMarketPrice} prefix="R$" hint="Para comparar com seu preco calculado" />
                            {marketPrice > 0 && financialCalc.isValid && (
                                <div className={clsx("p-3 rounded-xl border text-sm", financialCalc.marketDiff > 0 ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200")}>
                                    <p className="font-bold text-gray-700">
                                        Seu preco esta {financialCalc.marketDiff > 0 ? 'acima' : 'abaixo'} do mercado em <span className={financialCalc.marketDiff > 0 ? "text-yellow-700" : "text-green-700"}>{formatPercentage(Math.abs(financialCalc.marketDiff))}</span>
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Se vender ao preco de mercado, seu lucro seria: <span className={clsx("font-bold", financialCalc.marketMargin > 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(financialCalc.marketMargin)}</span>
                                    </p>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Right Column: Results */}
                    <div className="xl:col-span-8 space-y-6">
                        {/* Price Display */}
                        <div className="bg-white p-6 rounded-2xl border-l-4 border-brand-orange shadow-lg">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div>
                                    <p className="text-sm text-gray-500 uppercase font-bold">Preco de Venda Sugerido</p>
                                    <div className="flex items-baseline gap-3 mt-1">
                                        {financialCalc.isValid ? (
                                            <>
                                                <p className="text-5xl font-extrabold text-gray-900">{formatCurrency(financialCalc.finalPrice)}</p>
                                                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 font-bold">Markup: {formatNumber(financialCalc.markupMultiplier)}x</span>
                                            </>
                                        ) : (
                                            <p className="text-xl font-bold text-red-500">{financialCalc.errorMessage}</p>
                                        )}
                                    </div>
                                </div>
                                <button onClick={handleSave} disabled={!financialCalc.isValid || !name} className="px-8 py-4 bg-brand-dark text-white font-bold rounded-xl hover:bg-gray-800 disabled:bg-gray-300 shadow-md transform transition hover:scale-105">
                                    Salvar Item no Mix
                                </button>
                            </div>
                            
                            {financialCalc.isValid && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t">
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Margem Bruta</p>
                                        <p className="text-xl font-extrabold text-gray-900">{formatPercentage(financialCalc.grossMargin)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Margem Contrib.</p>
                                        <p className="text-xl font-extrabold text-green-600">{formatCurrency(financialCalc.contributionMargin)}</p>
                                        <p className="text-[10px] text-gray-400">{formatPercentage(financialCalc.contributionMarginPercent)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Lucro Liquido</p>
                                        <p className="text-xl font-extrabold text-blue-600">{formatCurrency(financialCalc.netProfit)}</p>
                                        <p className="text-[10px] text-gray-400">{formatPercentage(financialCalc.netProfitPercent)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Markup por Fora</p>
                                        <p className="text-xl font-extrabold text-brand-orange">{formatPercentage(financialCalc.markupPorFora)}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {financialCalc.isValid && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Card title="Composicao do Preco (Para onde vai o dinheiro?)">
                                        <BreakdownChart data={financialCalc.breakdownData} />
                                        <div className="mt-3 space-y-1">
                                            {financialCalc.breakdownData.map((item, i) => (
                                                <div key={i} className="flex justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }}></div>
                                                        <span className="text-gray-600">{item.name}</span>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <span className="text-gray-500">{formatPercentage(item.percentage)}</span>
                                                        <span className="font-bold text-gray-700 w-24 text-right">{formatCurrency(item.value)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                    
                                    <div className="space-y-6">
                                        <Card title="Entenda o Calculo" className="bg-blue-50 border-blue-200">
                                            <div className="text-sm text-blue-900 space-y-2">
                                                <p>Metodo do <strong>Divisor (Markup por Dentro)</strong>:</p>
                                                <div className="bg-white p-3 rounded-lg border border-blue-200 font-mono text-xs">
                                                    <p>Preco = Custo / Divisor</p>
                                                    <p>Preco = {formatCurrency(directCost)} / {financialCalc.divisor.toFixed(4).replace('.', ',')}</p>
                                                    <p className="font-bold text-brand-orange mt-1">Preco = {formatCurrency(financialCalc.suggestedPrice)}</p>
                                                    {behavioralScore !== 5 && (
                                                        <p className="text-gray-500 mt-1">x Fator Estratégico = {formatCurrency(financialCalc.finalPrice)}</p>
                                                    )}
                                                </div>
                                                <p className="text-xs mt-2"><strong>Custo Fixo Rateado:</strong> {formatCurrency(financialCalc.fixedValue)} (aluguel, luz, equipe adm...)</p>
                                                <p className="text-xs"><strong>Multiplicador:</strong> {formatNumber(financialCalc.markupMultiplier)}x sobre o custo direto</p>
                                            </div>
                                        </Card>
                                        
                                        <Card title="Fator Comportamental (Estrategia)">
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Diferenciacao (Nota 1-10)</label>
                                                    <input type="range" min="1" max="10" value={behavioralScore} onChange={e => setBehavioralScore(Number(e.target.value))} className="w-full accent-brand-orange" />
                                                    <div className="flex justify-between text-[10px] text-gray-400">
                                                        <span>Commodity (-10%)</span>
                                                        <span className="font-bold text-brand-orange text-lg">{behavioralScore}</span>
                                                        <span>Exclusivo (+15%)</span>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-gray-500">
                                                    {behavioralScore >= 8 ? 'Seu produto/servico e diferenciado. Preco premium aplicado (+15%).' :
                                                     behavioralScore <= 4 ? 'Mercado competitivo. Preco ajustado para baixo (-10%).' :
                                                     'Posicionamento neutro. Sem ajuste de preco.'}
                                                </p>
                                            </div>
                                        </Card>
                                    </div>
                                </div>

                                {/* Behavioral Funnel */}
                                {funnelCalc && (
                                    <Card title={`Meta Diaria de Comportamento (Para vender ${estimatedMonthlyVolume} un./mes)`} className="bg-brand-blue/5 border-brand-blue/20">
                                        <div className="text-center mb-6 text-sm text-gray-600">
                                            Para cumprir sua meta de vendas, sua equipe precisa entregar esta atividade <strong>TODO DIA</strong>:
                                        </div>
                                        {salesModel === 'consultative' ? (
                                            <div className="flex flex-wrap justify-between items-center gap-4">
                                                <div className="flex-1 min-w-[100px]"><FunnelStep label="Contatos" value={funnelCalc.dailyLeads} color="border-blue-400" subLabel="Por Dia" /></div>
                                                <div className="flex-1 min-w-[100px]"><FunnelStep label="Reunioes" value={funnelCalc.dailyMeetings} color="border-purple-400" subLabel="Por Dia" /></div>
                                                <div className="flex-1 min-w-[100px]"><FunnelStep label="Propostas" value={Number(funnelCalc.dailyProposals)} unit="/dia" color="border-orange-400" subLabel="Por Dia" /></div>
                                                <div className="flex-1 min-w-[100px]"><FunnelStep label="Vendas" value={Number(funnelCalc.dailySales)} unit="/dia" color="border-green-400" isLast subLabel="Por Dia" /></div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-around items-center gap-4">
                                                <div className="flex-1"><FunnelStep label="Visitantes" value={funnelCalc.dailyTraffic} color="border-blue-400" subLabel="Por Dia" /></div>
                                                <div className="flex-1"><FunnelStep label="Vendas" value={Number(funnelCalc.dailySales)} unit="/dia" color="border-green-400" isLast subLabel="Por Dia" /></div>
                                            </div>
                                        )}
                                        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <InputGroup label="Lead > Conversa" value={funnelRates.leadToConversation} onChange={v => setFunnelRates(p => ({...p, leadToConversation: v}))} suffix="%" />
                                            <InputGroup label="Conversa > Reuniao" value={funnelRates.conversationToMeeting} onChange={v => setFunnelRates(p => ({...p, conversationToMeeting: v}))} suffix="%" />
                                            <InputGroup label="Reuniao > Proposta" value={funnelRates.meetingToProposal} onChange={v => setFunnelRates(p => ({...p, meetingToProposal: v}))} suffix="%" />
                                            <InputGroup label="Proposta > Venda" value={funnelRates.proposalToSale} onChange={v => setFunnelRates(p => ({...p, proposalToSale: v}))} suffix="%" />
                                        </div>
                                    </Card>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ===== SIMULADOR DE DESCONTOS ===== */}
            {activeTab === 'simulator' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900 mb-2">Simulador de Descontos e Negociacao</h2>
                        <p className="text-sm text-gray-500 mb-6">Entenda o impacto real de cada desconto no seu lucro. Antes de dar desconto, saiba quanto precisa vender a mais.</p>
                        
                        {!financialCalc.isValid ? (
                            <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed">
                                Preencha a calculadora primeiro para usar o simulador.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Desconto Oferecido</label>
                                            <input type="range" min="0" max="50" step="1" value={simDiscount} onChange={e => setSimDiscount(Number(e.target.value))} className="w-full accent-red-500" />
                                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                                <span>0%</span>
                                                <span className={clsx("text-2xl font-extrabold", simDiscount > (simCalc?.maxDiscount || 0) ? "text-red-600" : "text-gray-900")}>{simDiscount}%</span>
                                                <span>50%</span>
                                            </div>
                                        </div>
                                        <InputGroup label="Volume Base (unidades/mes)" value={simVolume} onChange={setSimVolume} suffix="un." />
                                    </div>

                                    {simCalc && (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-4 bg-gray-50 rounded-xl border text-center">
                                                    <p className="text-xs text-gray-500 uppercase font-semibold">Preco Original</p>
                                                    <p className="text-xl font-extrabold text-gray-900">{formatCurrency(simCalc.originalPrice)}</p>
                                                </div>
                                                <div className={clsx("p-4 rounded-xl border text-center", simCalc.profitPerUnit > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                                                    <p className="text-xs text-gray-500 uppercase font-semibold">Preco com Desconto</p>
                                                    <p className={clsx("text-xl font-extrabold", simCalc.profitPerUnit > 0 ? "text-green-700" : "text-red-600")}>{formatCurrency(simCalc.discountedPrice)}</p>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-gray-50 rounded-xl border">
                                                <div className="flex justify-between text-sm mb-2">
                                                    <span className="text-gray-600">Lucro por unidade (original):</span>
                                                    <span className="font-bold text-gray-900">{formatCurrency(financialCalc.netProfit)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm mb-2">
                                                    <span className="text-gray-600">Lucro por unidade (com desconto):</span>
                                                    <span className={clsx("font-bold", simCalc.profitPerUnit > 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(simCalc.profitPerUnit)}</span>
                                                </div>
                                                <div className="border-t pt-2 mt-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">Lucro total (original):</span>
                                                        <span className="font-bold">{formatCurrency(simCalc.totalProfitOriginal)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">Lucro total (com desconto):</span>
                                                        <span className={clsx("font-bold", simCalc.totalProfitDiscounted > 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(simCalc.totalProfitDiscounted)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={clsx("p-4 rounded-xl border", simCalc.profitPerUnit > 0 ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200")}>
                                                {simCalc.profitPerUnit > 0 ? (
                                                    <>
                                                        <p className="font-bold text-orange-800 text-sm">Para manter o mesmo lucro total:</p>
                                                        <p className="text-2xl font-extrabold text-orange-700 mt-1">
                                                            Vender {formatNumber(simCalc.volumeToMaintain)} unidades
                                                        </p>
                                                        <p className="text-xs text-orange-600 mt-1">
                                                            +{formatNumber(simCalc.volumeIncrease)} unidades ({formatPercentage(simCalc.volumeIncreasePercent)} a mais)
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="font-bold text-red-800 text-sm">PREJUIZO! Este desconto elimina todo o lucro.</p>
                                                        <p className="text-xs text-red-600 mt-1">
                                                            Desconto maximo seguro: {formatPercentage(simCalc.maxDiscount)}
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Sensitivity Chart */}
                                {simCalc && (
                                    <div className="space-y-6">
                                        <Card title="Sensibilidade: Lucro vs Desconto">
                                            <div className="h-[280px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={simCalc.sensitivityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis dataKey="desconto" tick={{ fontSize: 11 }} />
                                                        <YAxis tickFormatter={(val) => `R$${Math.round(val / 1000).toLocaleString('pt-BR')}k`} tick={{ fontSize: 10 }} />
                                                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                                                        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                                                        <Bar dataKey="lucroTotal" name="Lucro Total" radius={[4, 4, 0, 0]}>
                                                            {simCalc.sensitivityData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.lucroTotal >= 0 ? '#34d399' : '#f87171'} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </Card>

                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                                            <h4 className="font-bold text-yellow-800 text-sm mb-2">Regras de Ouro para Negociacao</h4>
                                            <ul className="text-xs text-yellow-700 space-y-1">
                                                <li>1. Nunca de desconto sem pedir algo em troca (volume, prazo, indicacao)</li>
                                                <li>2. Desconto maximo seguro: <strong>{formatPercentage(simCalc.maxDiscount)}</strong></li>
                                                <li>3. Cada 1% de desconto exige +{formatPercentage(simCalc.volumeIncreasePercent / (simDiscount || 1))} de volume</li>
                                                <li>4. Prefira dar bonus (brinde, servico extra) ao inves de desconto</li>
                                                <li>5. Se o cliente pedir mais que {formatPercentage(simCalc.maxDiscount / 2)}, renegocie escopo</li>
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== ITENS SALVOS ===== */}
            {activeTab === 'list' && (
                <div className="space-y-6">
                    {pricingItems.length > 0 && (
                        <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Item</th>
                                        <th className="px-4 py-3 text-center font-semibold text-gray-600">Tipo</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Custo</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Preco</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Margem Bruta</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Lucro Liq.</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Lucro %</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Vol/Mes</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Receita/Mes</th>
                                        <th className="px-2 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {pricingItems.map(item => {
                                        const grossMargin = item.finalPrice > 0 ? ((item.finalPrice - item.directCost) / item.finalPrice) * 100 : 0;
                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-gray-900">{item.name}</p>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={clsx("px-2 py-1 rounded-full text-[10px] font-bold uppercase", item.type === 'product' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700')}>
                                                        {item.type === 'product' ? 'Produto' : 'Servico'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.directCost)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-brand-orange">{formatCurrency(item.finalPrice)}</td>
                                                <td className="px-4 py-3 text-right">{formatPercentage(grossMargin)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(item.netProfit)}</td>
                                                <td className="px-4 py-3 text-right">{formatPercentage(item.netProfitPercent)}</td>
                                                <td className="px-4 py-3 text-right">{formatNumber(item.estimatedMonthlyVolume)}</td>
                                                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.finalPrice * item.estimatedMonthlyVolume)}</td>
                                                <td className="px-2 py-3 text-center">
                                                    <button onClick={() => removePricingItem(item.id)} className="text-red-400 hover:text-red-600 font-bold">&times;</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    {pricingItems.length === 0 && (
                        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed">
                            Nenhum item precificado ainda. Use a calculadora para adicionar.
                        </div>
                    )}
                </div>
            )}

            {/* ===== MIX & ABC ===== */}
            {activeTab === 'mix' && mixAnalysis && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <Card title="Receita Potencial">
                            <p className="text-2xl font-extrabold text-gray-900">{formatCurrency(mixAnalysis.totalRevenueMix)}</p>
                            <p className="text-xs text-gray-500">Soma mensal de todos os itens</p>
                        </Card>
                        <Card title="Custo Direto Total">
                            <p className="text-2xl font-extrabold text-gray-600">{formatCurrency(mixAnalysis.totalDirectCostMix)}</p>
                            <p className="text-xs text-gray-500">CMV do portfolio</p>
                        </Card>
                        <Card title="Margem Contrib. Media">
                            <p className="text-2xl font-extrabold text-brand-blue">{formatPercentage(mixAnalysis.weightedMarginPercent * 100)}</p>
                            <p className="text-xs text-gray-500">Eficiencia global</p>
                        </Card>
                        <Card title="Custos Fixos Globais">
                            <p className="text-2xl font-extrabold text-red-600">{formatCurrency(mixAnalysis.globalFixedCosts)}</p>
                            <p className="text-xs text-gray-500">Media mensal</p>
                        </Card>
                        <Card title="Ponto de Equilibrio">
                            <p className="text-2xl font-extrabold text-green-600">{formatCurrency(mixAnalysis.globalBreakEvenRevenue)}</p>
                            <p className="text-xs text-gray-500">Receita minima</p>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* ABC Analysis */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-brand-blue mb-4">Curva ABC de Margem</h3>
                            <p className="text-xs text-gray-500 mb-4">Quais produtos/servicos mais contribuem para pagar suas contas?</p>
                            <div className="overflow-y-auto max-h-[400px]">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="p-2 text-left font-semibold">Item</th>
                                            <th className="p-2 text-center font-semibold">Classe</th>
                                            <th className="p-2 text-right font-semibold">Margem Total</th>
                                            <th className="p-2 text-right font-semibold">% Share</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {mixAnalysis.abcList.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="p-2 font-medium">{item.name}</td>
                                                <td className="p-2 text-center">
                                                    <span className={clsx("px-2 py-1 rounded text-xs font-bold", item.classification === 'A' ? "bg-green-100 text-green-800" : item.classification === 'B' ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800")}>
                                                        {item.classification}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-right font-medium">{formatCurrency(item.margin)}</td>
                                                <td className="p-2 text-right text-gray-500">{formatPercentage(item.shareOfMargin * 100)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Break-even Timeline */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-fit">
                            <h3 className="text-lg font-bold text-brand-blue mb-2">Jornada do Lucro Mensal</h3>
                            <p className="text-xs text-gray-500 mb-6">Em que dia do mes você termina de pagar os custos e comeca a lucrar?</p>
                            
                            <div className="flex h-12 w-full rounded-lg overflow-hidden border border-gray-200 mb-2">
                                <div 
                                    className="bg-red-100 flex items-center justify-center text-red-800 font-bold text-xs border-r border-red-200 transition-all duration-500" 
                                    style={{ width: `${Math.min(100, (mixAnalysis.breakEvenDay / 30) * 100)}%` }}
                                >
                                    {mixAnalysis.breakEvenDay > 30 ? "Mes inteiro pagando contas" : `${mixAnalysis.breakEvenDay} dias`}
                                </div>
                                {mixAnalysis.breakEvenDay < 30 && (
                                    <div className="bg-green-100 flex items-center justify-center text-green-800 font-bold text-xs flex-grow transition-all duration-500">
                                        {30 - mixAnalysis.breakEvenDay} dias de lucro
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400 mb-6">
                                <span>Dia 1</span>
                                <span>Dia 30</span>
                            </div>

                            <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">Evolucao do Saldo Diario</h4>
                            <div className="h-[180px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={mixAnalysis.timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="day" tick={{fontSize: 10}} interval={2} />
                                        <YAxis tickFormatter={(val) => `R$${Math.round(val/1000).toLocaleString('pt-BR')}k`} tick={{fontSize: 10}} />
                                        <Tooltip formatter={(v: number) => [formatCurrency(v), "Saldo"]} labelFormatter={(l) => `Dia ${l}`} />
                                        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                                        <Bar dataKey="netResult" radius={[2, 2, 0, 0]}>
                                            {mixAnalysis.timelineData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.netResult < 0 ? '#f87171' : '#34d399'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            
                            <div className="mt-4 text-center p-3 bg-gray-50 rounded-lg">
                                <p className={clsx("text-xl font-bold", mixAnalysis.breakEvenDay > 30 ? "text-red-600" : "text-gray-900")}>
                                    {mixAnalysis.breakEvenDay > 30 
                                        ? "Sua operação esta no prejuízo." 
                                        : `Você comeca a lucrar no dia ${mixAnalysis.breakEvenDay}.`
                                    }
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Revenue Composition Pie */}
                    {mixAnalysis.pieData.length > 0 && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-brand-blue mb-4">Composicao de Receita por Item</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={mixAnalysis.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''}: ${formatCurrency(value ?? 0, true)}`}>
                                            {mixAnalysis.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'mix' && !mixAnalysis && (
                <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed">
                    Cadastre itens na calculadora para ver a analise de mix.
                </div>
            )}
        </div>
    );
};

export default PricingCalculator;
