
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePlan } from '../../hooks/usePlanData';
import { formatCurrency, formatPercentage, formatNumber } from '../../utils/formatters';
import clsx from 'clsx';
import type { ActionPlanCategory, ActionPlanPriority, DRE2026, DFC2026, BP2026 } from '../../types';

interface ReportPreviewProps {
  reportType: 'diagnosis' | 'plan';
  onClose: () => void;
}

// ===== HELPER COMPONENTS =====

const PageBreak = () => <div className="break-before-page pt-4" style={{ pageBreakBefore: 'always' }} />;

const SectionHeader: React.FC<{ number: string; title: string; subtitle?: string }> = ({ number, title, subtitle }) => (
    <div className="mb-10 pb-4 border-b-2 border-brand-orange">
        <div className="flex items-baseline gap-3">
            <span className="text-sm font-bold text-brand-orange uppercase tracking-wider">{number}</span>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        </div>
        {subtitle && <p className="text-sm text-gray-500 mt-1 ml-12">{subtitle}</p>}
    </div>
);

const MetricCard: React.FC<{ label: string; value: string; sublabel?: string; highlight?: boolean }> = ({ label, value, sublabel, highlight }) => (
    <div className={clsx("p-4 rounded-lg border", highlight ? "bg-brand-orange/5 border-brand-orange/30" : "bg-gray-50 border-gray-200")}>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={clsx("text-lg font-extrabold mt-1", highlight ? "text-brand-orange" : "text-gray-900")}>{value}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
);

const DataTable: React.FC<{ headers: string[]; rows: (string | React.ReactNode)[][]; highlightLast?: boolean }> = ({ headers, rows, highlightLast }) => (
    <table className="w-full text-sm border-collapse">
        <thead>
            <tr className="bg-gray-800 text-white">
                {headers.map((h, i) => (
                    <th key={i} className={clsx("py-2.5 px-3 font-semibold text-xs uppercase tracking-wider", i === 0 ? "text-left" : "text-right")}>{h}</th>
                ))}
            </tr>
        </thead>
        <tbody>
            {rows.map((row, ri) => (
                <tr key={ri} className={clsx(
                    "border-b border-gray-200",
                    highlightLast && ri === rows.length - 1 ? "bg-brand-orange/10 font-bold" : ri % 2 === 0 ? "bg-white" : "bg-gray-50"
                )}>
                    {row.map((cell, ci) => (
                        <td key={ci} className={clsx("py-2 px-3", ci === 0 ? "text-left text-gray-800" : "text-right text-gray-700")}>{cell}</td>
                    ))}
                </tr>
            ))}
        </tbody>
    </table>
);

// ===== MAIN COMPONENT =====

const ReportPreview: React.FC<ReportPreviewProps> = ({ reportType, onClose }) => {
    const { planData, goals2026, summary2025, baseScenario } = usePlan();

    // As metas mensais somam o ano. Antes esta seção lia planData.goals2026,
    // que não existe — goals2026 é estado separado —, e com nomes de campo que
    // também não existem. Tudo caía no `|| 0` e a seção inteira do relatório
    // entregue ao cliente saía zerada, parecendo preenchida.
    const somaMeses = (m?: Record<string, number | null> | null): number =>
        m ? Object.values(m).reduce<number>((a, v) => a + (v || 0), 0) : 0;
    const metaReceitaAnual = somaMeses(goals2026.financeiras?.metaReceita);
    const metaClientesAnual = (() => {
        const vals = Object.values(goals2026.comerciais?.metaNumClientes || {}).filter(v => v != null) as number[];
        return vals.length ? vals[vals.length - 1] : 0;
    })();
    const isDiagnosis = reportType === 'diagnosis';
    const reportTitle = isDiagnosis ? "Relatório de Diagnóstico 2025" : "Plano Estratégico 2026";
    const analysisText = isDiagnosis ? planData.analysis.diagnosisReportAnalysis : planData.analysis.planReportAnalysis;
    const [activeSection, setActiveSection] = useState<string | null>(null);

    useEffect(() => {
        document.body.classList.add('printing-report-mode');
        return () => document.body.classList.remove('printing-report-mode');
    }, []);

    // Scroll to section
    const scrollToSection = (id: string) => {
        const el = document.getElementById(`report-section-${id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveSection(id);
    };

    // Calculate financial totals for 2026
    const financialTotals2026 = useMemo(() => {
        const { dre, dfc } = planData.financialPlan2026;
        const sumMonths = (data: Record<string, number>) => Object.values(data || {}).reduce((s, v) => s + (v || 0), 0);
        return {
            receitaLiquida: sumMonths(dre.receitaLiquida || {}),
            lucroBruto: sumMonths(dre.lucroBruto || {}),
            ebitda: sumMonths(dre.ebitda || {}),
            lucroLiquido: sumMonths(dre.lucroLiquido || {}),
            receitaBruta: sumMonths(dre.receitaBruta || {}),
            custosVariaveis: sumMonths(dre.custosVariaveis || {}),
            despesasFixas: sumMonths(dre.despesasFixas || {}),
            fco: sumMonths(dfc.fco || {}),
            saldoFinalCaixa: sumMonths(dfc.saldoFinalCaixa || {}),
        };
    }, [planData.financialPlan2026]);

    // Sections config for TOC
    const diagnosisSections = [
        { id: 'exec-summary', title: 'Sumário Executivo' },
        { id: 'financial-2025', title: 'Panorama Financeiro 2025' },
        { id: 'monthly-evolution', title: 'Evolução Mensal 2025' },
        { id: 'strategic-analysis', title: 'Análise Estratégica (SWOT)' },
        { id: 'portfolio', title: 'Análise de Portfólio (Curva ABC)' },
        { id: 'commercial-kpis', title: 'Indicadores Comerciais' },
        { id: 'people-kpis', title: 'Indicadores de Pessoas' },
    ];

    const planSections = [
        { id: 'exec-summary', title: 'Sumário Executivo (CSO Analysis)' },
        { id: 'strategic-context', title: 'Contexto Estratégico' },
        { id: 'goals-2026', title: 'Metas e Objetivos 2026' },
        { id: 'okrs', title: 'OKRs - Objetivos e Resultados-Chave' },
        { id: 'action-plan', title: 'Plano de Ação' },
        { id: 'commercial-plan', title: 'Planejamento Comercial' },
        { id: 'financial-projections', title: 'Projeções Financeiras 2026' },
        { id: 'dre-2026', title: 'Demonstrativo de Resultados (DRE)' },
        { id: 'cashflow-2026', title: 'Fluxo de Caixa (DFC)' },
    ];

    const sections = isDiagnosis ? diagnosisSections : planSections;

    // Analyzed products for ABC
    const analyzedProducts = useMemo(() => {
        const products = planData.productPortfolio;
        const totalRevenue = products.reduce((sum, p) => sum + (p.revenue2025 || 0), 0);
        if (totalRevenue === 0) return [];
        const sorted = [...products].sort((a, b) => (b.revenue2025 || 0) - (a.revenue2025 || 0));
        let cumulative = 0;
        return sorted.map(p => {
            const pct = ((p.revenue2025 || 0) / totalRevenue) * 100;
            cumulative += pct;
            return { ...p, revenuePercent: pct, abcClass: cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C' as 'A' | 'B' | 'C' };
        });
    }, [planData.productPortfolio]);

    const categoryColors: Record<string, string> = {
        'Comercial': 'bg-blue-100 text-blue-800',
        'Financeiro': 'bg-green-100 text-green-800',
        'Pessoas': 'bg-purple-100 text-purple-800',
        'Operacional': 'bg-amber-100 text-amber-800',
        'Marketing': 'bg-pink-100 text-pink-800',
        'Estratégico': 'bg-indigo-100 text-indigo-800',
    };

    const priorityColors: Record<string, string> = {
        'Alta': 'bg-red-100 text-red-800',
        'Média': 'bg-yellow-100 text-yellow-800',
        'Baixa': 'bg-green-100 text-green-800',
    };

    const abcColors = { A: 'bg-green-100 text-green-800', B: 'bg-yellow-100 text-yellow-800', C: 'bg-red-100 text-red-800' };

    return createPortal(
        <div className="report-preview-container fixed inset-0 bg-black/60 z-50 flex flex-col items-center overflow-y-auto">
            {/* Toolbar */}
            <div className="report-toolbar w-full max-w-[210mm] bg-white rounded-t-xl p-3 flex justify-between items-center shadow-xl sticky top-0 z-10 no-print border-b">
                <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold text-gray-900">{reportTitle}</h2>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{planData.companyProfile.name || "Empresa"}</span>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => window.print()} className="px-5 py-2 text-sm font-bold text-white bg-brand-orange rounded-lg hover:bg-orange-700 transition-colors shadow-sm flex items-center gap-2">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Imprimir / Salvar PDF
                    </button>
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                        Fechar
                    </button>
                </div>
            </div>

            {/* Report Content */}
            <div className="report-portal-content w-full max-w-[210mm] bg-white shadow-2xl" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

                {/* ===== COVER PAGE ===== */}
                <div className="p-16 min-h-[297mm] flex flex-col justify-between" style={{ pageBreakAfter: 'always' }}>
                    <div />
                    <div className="text-center">
                        <div className="w-24 h-1 bg-brand-orange mx-auto mb-8" />
                        <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
                            {planData.companyProfile.name || "Sua Empresa"}
                        </h1>
                        {planData.companyProfile.industry && (
                            <p className="text-lg text-gray-500 mt-3">{planData.companyProfile.industry}</p>
                        )}
                        <div className="w-24 h-1 bg-brand-orange mx-auto my-8" />
                        <p className="text-3xl font-bold text-brand-orange uppercase tracking-wider">{reportTitle}</p>
                        <p className="text-base text-gray-400 mt-6">
                            {isDiagnosis ? "Análise completa da situação atual da empresa" : "Planejamento estratégico, metas e projeções financeiras"}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-gray-400">Documento gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        <p className="text-xs text-gray-300 mt-1">PLAN 2026 - Gestão de Impacto</p>
                    </div>
                </div>

                {/* ===== TABLE OF CONTENTS ===== */}
                <div className="p-12" style={{ pageBreakAfter: 'always' }}>
                    <SectionHeader number="" title="Sumário" />
                    <div className="space-y-0 mt-8">
                        {sections.map((s, i) => (
                            <button key={s.id} onClick={() => scrollToSection(s.id)}
                                className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-lg transition-colors group border-b border-gray-100">
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-bold text-brand-orange w-8">{String(i + 1).padStart(2, '0')}</span>
                                    <span className="text-base font-medium text-gray-800 group-hover:text-brand-orange transition-colors">{s.title}</span>
                                </div>
                                <div className="flex-1 mx-4 border-b border-dotted border-gray-300" />
                                <svg className="h-4 w-4 text-gray-400 group-hover:text-brand-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ===== REPORT BODY ===== */}
                <div className="p-12 space-y-16">

                    {/* EXECUTIVE SUMMARY */}
                    <div id="report-section-exec-summary">
                        <SectionHeader number="01" title={isDiagnosis ? "Sumário Executivo" : "Sumário Executivo (CSO Analysis)"} subtitle="Análise consolidada gerada por Inteligência Artificial" />
                        {analysisText ? (
                            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed report-markdown"
                                dangerouslySetInnerHTML={{
                                    __html: analysisText
                                        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                                        .replace(/### (.*?)\n/g, '<h3 class="text-lg font-bold text-gray-800 mt-6 mb-2 border-l-4 border-brand-orange pl-3">$1</h3>\n')
                                        .replace(/#### (.*?)\n/g, '<h4 class="text-base font-bold text-gray-700 mt-4 mb-1">$1</h4>\n')
                                        .replace(/\n/g, '<br/>')
                                }} />
                        ) : (
                            <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center">
                                <p className="text-gray-400 italic">Nenhuma análise gerada. Clique em "Gerar com IA" antes de visualizar o relatório.</p>
                            </div>
                        )}
                    </div>

                    {isDiagnosis ? (
                        <>
                            {/* DIAGNOSIS REPORT SECTIONS */}
                            <PageBreak />
                            <div id="report-section-financial-2025">
                                <SectionHeader number="02" title="Panorama Financeiro 2025" subtitle="Indicadores consolidados do exercício" />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
                                    <MetricCard label="Receita Bruta" value={formatCurrency(summary2025.receitaBrutaTotal)} highlight />
                                    <MetricCard label="Receita Líquida" value={formatCurrency(summary2025.receitaTotal)} />
                                    <MetricCard label="Lucro Bruto" value={formatCurrency(summary2025.margemBruta)} />
                                    <MetricCard label="Margem Bruta" value={formatPercentage(summary2025.margemBrutaPercent)} />
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
                                    <MetricCard label="EBITDA" value={formatCurrency(summary2025.ebitda)} highlight />
                                    <MetricCard label="Margem EBITDA" value={formatPercentage(summary2025.margemEbitda)} />
                                    <MetricCard label="Custos Variáveis" value={formatCurrency(summary2025.custosVariaveisTotal)} />
                                    <MetricCard label="Custos Fixos" value={formatCurrency(summary2025.custosFixosTotal)} />
                                </div>
                                <DataTable
                                    headers={['Indicador', 'Valor']}
                                    rows={[
                                        ['Receita Bruta Total', formatCurrency(summary2025.receitaBrutaTotal)],
                                        ['(-) Impostos sobre Faturamento', formatCurrency(summary2025.receitaBrutaTotal - summary2025.receitaTotal)],
                                        ['(=) Receita Líquida', formatCurrency(summary2025.receitaTotal)],
                                        ['(-) Custos Variáveis (CMV + Comissões + Fretes)', formatCurrency(summary2025.custosVariaveisTotal)],
                                        ['(=) Margem de Contribuição', formatCurrency(summary2025.margemContribuicao)],
                                        ['(-) Custos Fixos (Despesas Operacionais)', formatCurrency(summary2025.custosFixosTotal)],
                                        ['(=) EBITDA', formatCurrency(summary2025.ebitda)],
                                        ['Margem EBITDA', formatPercentage(summary2025.margemEbitda)],
                                        ['Ponto de Equilíbrio Contábil (mensal)', formatCurrency(summary2025.pontoEquilibrioContabil)],
                                    ]}
                                    highlightLast
                                />
                            </div>

                            <PageBreak />
                            <div id="report-section-monthly-evolution">
                                <SectionHeader number="03" title="Evolução Mensal 2025" subtitle="Receita, custos e EBITDA mês a mês" />
                                <DataTable
                                    headers={['Mês', 'Receita', 'Custos Variáveis', 'Custos Fixos', 'EBITDA']}
                                    rows={summary2025.monthlySummary.map(m => [
                                        m.month,
                                        formatCurrency(m.receita),
                                        formatCurrency(m.custosVariaveis),
                                        formatCurrency(m.custosFixos),
                                        formatCurrency(m.ebitda),
                                    ])}
                                    highlightLast={false}
                                />
                                <div className="grid grid-cols-3 gap-5 mt-8">
                                    <MetricCard label="Melhor Mês (Receita)" value={
                                        summary2025.monthlySummary.length > 0
                                            ? summary2025.monthlySummary.reduce((best, m) => m.receita > best.receita ? m : best).month
                                            : '-'
                                    } />
                                    <MetricCard label="Pior Mês (EBITDA)" value={
                                        summary2025.monthlySummary.length > 0
                                            ? summary2025.monthlySummary.reduce((worst, m) => m.ebitda < worst.ebitda ? m : worst).month
                                            : '-'
                                    } />
                                    <MetricCard label="Ticket Médio" value={formatCurrency(summary2025.ticketMedio)} />
                                </div>
                            </div>

                            <PageBreak />
                            <div id="report-section-strategic-analysis">
                                <SectionHeader number="04" title="Análise Estratégica (SWOT)" subtitle="Forças, Fraquezas, Oportunidades e Ameaças" />
                                <div className="grid grid-cols-2 gap-5">
                                    {[
                                        { title: 'Forças', content: planData.marketAnalysis.swot.strengths, border: 'border-green-400', bg: 'bg-green-50', icon: '💪' },
                                        { title: 'Fraquezas', content: planData.marketAnalysis.swot.weaknesses, border: 'border-red-400', bg: 'bg-red-50', icon: '⚠️' },
                                        { title: 'Oportunidades', content: planData.marketAnalysis.swot.opportunities, border: 'border-blue-400', bg: 'bg-blue-50', icon: '🎯' },
                                        { title: 'Ameaças', content: planData.marketAnalysis.swot.threats, border: 'border-amber-400', bg: 'bg-amber-50', icon: '🔥' },
                                    ].map(item => (
                                        <div key={item.title} className={clsx("p-5 rounded-xl border-2", item.border, item.bg)}>
                                            <h4 className="font-bold text-base text-gray-800 mb-3">{item.icon} {item.title}</h4>
                                            <ul className="space-y-1.5">
                                                {item.content.split('\n').filter(l => l.trim()).map((line, i) => (
                                                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                                        <span className="text-gray-400 mt-0.5">•</span>
                                                        <span>{line.replace(/^- /, '')}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <PageBreak />
                            <div id="report-section-portfolio">
                                <SectionHeader number="05" title="Análise de Portfólio (Curva ABC)" subtitle="Classificação dos produtos/serviços por contribuição na receita" />
                                {analyzedProducts.length > 0 ? (
                                    <DataTable
                                        headers={['Produto/Serviço', '% da Receita', 'Classe']}
                                        rows={analyzedProducts.map(p => [
                                            p.name,
                                            formatPercentage(p.revenuePercent),
                                            <span className={clsx('px-3 py-1 rounded-full text-xs font-bold', abcColors[p.abcClass])}>Classe {p.abcClass}</span>,
                                        ])}
                                    />
                                ) : (
                                    <p className="text-gray-400 italic p-4">Nenhum produto cadastrado no portfólio.</p>
                                )}
                            </div>

                            <PageBreak />
                            <div id="report-section-commercial-kpis">
                                <SectionHeader number="06" title="Indicadores Comerciais" subtitle="Performance de vendas e marketing em 2025" />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                                    <MetricCard label="Novos Clientes" value={formatNumber(summary2025.novosClientesTotal)} />
                                    <MetricCard label="Ticket Médio" value={formatCurrency(summary2025.ticketMedio)} highlight />
                                    <MetricCard label="Taxa de Retenção" value={summary2025.temBaseRetencao ? formatPercentage(summary2025.taxaRetencao) : "não medido"} />
                                    <MetricCard label="Conversão Lead → Cliente" value={summary2025.temBaseConversao ? formatPercentage(summary2025.taxaConversaoLeadCliente) : "não medido"} />
                                    <MetricCard label="Investimento em Marketing" value={formatCurrency(summary2025.investimentoMarketingTotal)} />
                                    <MetricCard label="Custo de Aquisição (CAC)" value={formatCurrency(summary2025.cac)} />
                                    <MetricCard label="Lifetime Value (LTV)" value={formatCurrency(summary2025.ltv)} />
                                    <MetricCard label="Relação LTV/CAC" value={`${(summary2025.relacaoLtvCac || 0).toFixed(1).replace('.', ',')}x`} highlight />
                                </div>
                            </div>

                            <PageBreak />
                            <div id="report-section-people-kpis">
                                <SectionHeader number="07" title="Indicadores de Pessoas" subtitle="Equipe e capital humano em 2025" />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                                    <MetricCard label="Headcount Final" value={formatNumber(summary2025.headcountFinal)} />
                                    <MetricCard label="Salário Médio Mensal" value={formatCurrency(summary2025.salarioMedioMensal)} />
                                    <MetricCard label="Custo/Colaborador/Ano" value={formatCurrency(summary2025.custoColaboradorAno)} />
                                    <MetricCard label="Turnover" value={formatPercentage(summary2025.turnoverPercent)} />
                                    <MetricCard label="Receita/Colaborador" value={formatCurrency(summary2025.receitaTotal / (summary2025.headcountMedio || 1))} highlight />
                                    <MetricCard label="ROI Treinamento" value={formatPercentage(summary2025.roiTreinamento)} />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* STRATEGIC PLAN REPORT SECTIONS */}
                            <PageBreak />
                            <div id="report-section-strategic-context">
                                <SectionHeader number="02" title="Contexto Estratégico" subtitle="SWOT e posicionamento da empresa" />
                                <div className="grid grid-cols-2 gap-5 mb-10">
                                    {[
                                        { title: 'Forças', content: planData.marketAnalysis.swot.strengths, border: 'border-green-400', bg: 'bg-green-50', icon: '💪' },
                                        { title: 'Fraquezas', content: planData.marketAnalysis.swot.weaknesses, border: 'border-red-400', bg: 'bg-red-50', icon: '⚠️' },
                                        { title: 'Oportunidades', content: planData.marketAnalysis.swot.opportunities, border: 'border-blue-400', bg: 'bg-blue-50', icon: '🎯' },
                                        { title: 'Ameaças', content: planData.marketAnalysis.swot.threats, border: 'border-amber-400', bg: 'bg-amber-50', icon: '🔥' },
                                    ].map(item => (
                                        <div key={item.title} className={clsx("p-5 rounded-xl border-2", item.border, item.bg)}>
                                            <h4 className="font-bold text-base text-gray-800 mb-3">{item.icon} {item.title}</h4>
                                            <ul className="space-y-1.5">
                                                {item.content.split('\n').filter(l => l.trim()).map((line, i) => (
                                                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                                        <span className="text-gray-400 mt-0.5">•</span>
                                                        <span>{line.replace(/^- /, '')}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                                {planData.marketAnalysis.blueOcean && (
                                    <div className="p-5 bg-indigo-50 rounded-xl border border-indigo-200">
                                        <h4 className="font-bold text-base text-indigo-800 mb-3">Estratégia Oceano Azul - 4 Ações</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { title: 'Eliminar', content: planData.marketAnalysis.blueOcean.fourActions?.eliminate, color: 'text-red-700' },
                                                { title: 'Reduzir', content: planData.marketAnalysis.blueOcean.fourActions?.reduce, color: 'text-orange-700' },
                                                { title: 'Elevar', content: planData.marketAnalysis.blueOcean.fourActions?.raise, color: 'text-blue-700' },
                                                { title: 'Criar', content: planData.marketAnalysis.blueOcean.fourActions?.create, color: 'text-green-700' },
                                            ].filter(a => a.content).map(action => (
                                                <div key={action.title} className="p-3 bg-white rounded-lg border border-indigo-100">
                                                    <p className={`text-xs font-bold uppercase tracking-wider ${action.color} mb-1`}>{action.title}</p>
                                                    <p className="text-sm text-gray-700">{action.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                        {planData.marketAnalysis.blueOcean.factors?.length > 0 && (
                                            <div className="mt-3">
                                                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Fatores Competitivos</p>
                                                <div className="space-y-1">
                                                    {planData.marketAnalysis.blueOcean.factors.map(f => (
                                                        <div key={f.id} className="flex items-center justify-between text-sm p-2 bg-white rounded border border-indigo-100">
                                                            <span className="text-gray-700 font-medium">{f.name}</span>
                                                            <div className="flex gap-4 text-xs">
                                                                <span className="text-indigo-600">Sua empresa: <strong>{f.yourCompanyScore || 0}</strong></span>
                                                                <span className="text-gray-500">Concorrente: <strong>{f.competitorScore || 0}</strong></span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <PageBreak />
                            <div id="report-section-goals-2026">
                                <SectionHeader number="03" title="Metas e Objetivos 2026" subtitle="Metas financeiras, comerciais e de pessoas" />
                                <div className="space-y-8">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-3">Metas Financeiras</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                                            <MetricCard label="Receita 2026" value={formatCurrency(metaReceitaAnual)} highlight />
                                            <MetricCard label="Crescimento vs. 2025" value={summary2025.receitaTotal > 0 && metaReceitaAnual > 0 ? formatPercentage((metaReceitaAnual / summary2025.receitaTotal - 1) * 100) : 'não definida'} />
                                            <MetricCard label="Margem EBITDA" value={goals2026.financeiras.metaMargemEbitda != null ? formatPercentage(goals2026.financeiras.metaMargemEbitda) : 'não definida'} />
                                            <MetricCard label="Lucro Líquido" value={goals2026.financeiras.metaLucroLiquido != null ? formatCurrency(goals2026.financeiras.metaLucroLiquido) : 'não definida'} />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-3">Metas Comerciais</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                                            <MetricCard label="Clientes no fim de 2026" value={metaClientesAnual > 0 ? formatNumber(metaClientesAnual) : 'não definida'} highlight />
                                            <MetricCard label="Ticket Médio" value={goals2026.comerciais.metaTicketMedio != null ? formatCurrency(goals2026.comerciais.metaTicketMedio) : 'não definida'} />
                                            <MetricCard label="Taxa de Conversão" value={goals2026.comerciais.metaTaxaConversao != null ? formatPercentage(goals2026.comerciais.metaTaxaConversao) : 'não definida'} />
                                            <MetricCard label="Inflação Prevista" value={goals2026.inflacaoPrevista != null ? formatPercentage(goals2026.inflacaoPrevista) : 'não definida'} />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-3">Metas de Pessoas</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                                            <MetricCard label="Headcount" value={goals2026.pessoas.metaHeadcount != null ? formatNumber(goals2026.pessoas.metaHeadcount) : 'não definida'} />
                                            <MetricCard label="Turnover" value={goals2026.pessoas.metaTurnover != null ? formatPercentage(goals2026.pessoas.metaTurnover) : 'não definida'} />
                                            <MetricCard label="Investimento em T&D" value={goals2026.pessoas.metaInvestimentoTD != null ? formatCurrency(goals2026.pessoas.metaInvestimentoTD) : 'não definida'} />
                                            <MetricCard label="Absenteísmo" value={goals2026.pessoas.metaAbsenteismo != null ? formatPercentage(goals2026.pessoas.metaAbsenteismo) : 'não definida'} />
                                        </div>
                                    </div>
                                    {goals2026.objetivosEstrategicos && (
                                        (() => {
                                            const objs = [
                                                goals2026.objetivosEstrategicos.objective1,
                                                goals2026.objetivosEstrategicos.objective2,
                                                goals2026.objetivosEstrategicos.objective3,
                                            ].filter(o => o && o.trim());
                                            if (objs.length === 0) return null;
                                            return (
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-800 mb-3">Objetivos Estratégicos</h3>
                                                    <div className="space-y-2">
                                                        {objs.map((obj, i) => (
                                                            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
                                                                <span className="text-sm font-bold text-brand-orange">{String(i + 1).padStart(2, '0')}</span>
                                                                <p className="text-sm text-gray-800">{obj}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>

                            <PageBreak />
                            <div id="report-section-okrs">
                                <SectionHeader number="04" title="OKRs - Objetivos e Resultados-Chave" subtitle="Metodologia OKR para acompanhamento de resultados" />
                                {planData.okrsAndKpis?.okrs?.length > 0 ? (
                                    <div className="space-y-8">
                                        {planData.okrsAndKpis.okrs.map((okr, i) => (
                                            <div key={okr.id} className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                                                <h4 className="font-bold text-base text-gray-900 mb-3">
                                                    <span className="text-brand-orange mr-2">O{i + 1}.</span>
                                                    {okr.objective}
                                                </h4>
                                                <div className="space-y-2 ml-6">
                                                    {okr.keyResults.map((kr, j) => {
                                                        const progress = kr.targetValue && kr.targetValue > 0
                                                            ? Math.min(100, ((kr.currentValue || 0) / kr.targetValue) * 100)
                                                            : 0;
                                                        return (
                                                            <div key={kr.id} className="flex items-center gap-3">
                                                                <span className="text-xs font-bold text-gray-500 w-8">KR{j + 1}</span>
                                                                <div className="flex-1">
                                                                    <p className="text-sm text-gray-700">{kr.name}</p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                                            <div className={clsx("h-full rounded-full", progress >= 70 ? "bg-green-500" : progress >= 40 ? "bg-yellow-500" : "bg-red-500")}
                                                                                style={{ width: `${progress}%` }} />
                                                                        </div>
                                                                        <span className="text-xs font-bold text-gray-500 w-12 text-right">{progress.toFixed(0)}%</span>
                                                                    </div>
                                                                </div>
                                                                <span className="text-xs text-gray-400">
                                                                    {kr.unit === 'currency' ? formatCurrency(kr.currentValue || 0) : kr.unit === 'percentage' ? formatPercentage(kr.currentValue || 0) : formatNumber(kr.currentValue || 0)}
                                                                    {' / '}
                                                                    {kr.unit === 'currency' ? formatCurrency(kr.targetValue || 0) : kr.unit === 'percentage' ? formatPercentage(kr.targetValue || 0) : formatNumber(kr.targetValue || 0)}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 italic p-4">Nenhum OKR cadastrado.</p>
                                )}
                            </div>

                            <PageBreak />
                            <div id="report-section-action-plan">
                                <SectionHeader number="05" title="Plano de Ação" subtitle="Ações priorizadas com responsáveis, prazos e resultados esperados" />
                                {planData.actionPlan?.length > 0 ? (
                                    <div className="space-y-4">
                                        {/* Summary stats */}
                                        <div className="grid grid-cols-5 gap-4 mb-8">
                                            <MetricCard label="Total de Ações" value={String(planData.actionPlan.length)} />
                                            <MetricCard label="Prioridade Alta" value={String(planData.actionPlan.filter(i => i.priority === 'Alta').length)} />
                                            <MetricCard label="Em Andamento" value={String(planData.actionPlan.filter(i => i.status === 'Em Andamento').length)} />
                                            <MetricCard label="Concluídas" value={String(planData.actionPlan.filter(i => i.status === 'Concluído').length)} highlight />
                                            <MetricCard label="Investimento Total" value={formatCurrency(planData.actionPlan.reduce((s, i) => s + (i.howMuch || 0), 0))} />
                                        </div>
                                        {/* Action items table */}
                                        {(['Alta', 'Média', 'Baixa'] as ActionPlanPriority[]).map(priority => {
                                            const items = planData.actionPlan.filter(i => (i.priority || 'Média') === priority);
                                            if (items.length === 0) return null;
                                            return (
                                                <div key={priority} className="mb-6">
                                                    <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                        <span className={clsx("w-3 h-3 rounded-full", priority === 'Alta' ? 'bg-red-500' : priority === 'Média' ? 'bg-yellow-500' : 'bg-green-500')} />
                                                        Prioridade {priority} ({items.length} {items.length === 1 ? 'ação' : 'ações'})
                                                    </h4>
                                                    {items.map((item, idx) => (
                                                        <div key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-3">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-full", categoryColors[item.category || 'Estratégico'] || 'bg-gray-100 text-gray-800')}>
                                                                            {item.category || 'Estratégico'}
                                                                        </span>
                                                                        <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-full", 
                                                                            item.status === 'Concluído' ? 'bg-green-100 text-green-800' :
                                                                            item.status === 'Em Andamento' ? 'bg-blue-100 text-blue-800' :
                                                                            item.status === 'Atrasado' ? 'bg-red-100 text-red-800' :
                                                                            'bg-gray-100 text-gray-800'
                                                                        )}>
                                                                            {item.status}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm font-bold text-gray-900">{item.what || 'Sem descrição'}</p>
                                                                    {item.expectedResult && (
                                                                        <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                                                                            <span>✓</span> {item.expectedResult}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="text-right text-xs text-gray-500 flex-shrink-0">
                                                                    {item.who && <p><strong>Responsável:</strong> {item.who}</p>}
                                                                    {item.when && <p><strong>Prazo:</strong> {item.when}</p>}
                                                                    {item.howMuch ? <p><strong>Investimento:</strong> {formatCurrency(item.howMuch)}</p> : null}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 italic p-4">Nenhuma ação cadastrada no plano.</p>
                                )}
                            </div>

                            <PageBreak />
                            <div id="report-section-commercial-plan">
                                <SectionHeader number="06" title="Planejamento Comercial" subtitle="Canais de demanda e funil de vendas" />
                                <div className="space-y-8">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-3">Canais de Demanda</h3>
                                        {planData.commercialPlanning?.demandPlanning?.channels?.length > 0 ? (
                                            <DataTable
                                                headers={['Canal', 'Investimento', 'Leads Esperados', 'Receita Esperada', 'ROI']}
                                                rows={planData.commercialPlanning.demandPlanning.channels.map(ch => [
                                                    ch.name || '-',
                                                    formatCurrency(ch.budget || 0),
                                                    formatNumber(ch.leads || 0),
                                                    formatCurrency(ch.expectedRevenue || 0),
                                                    ch.budget && ch.budget > 0 ? `${(((ch.expectedRevenue || 0) / ch.budget - 1) * 100).toFixed(0).replace('.', ',')}%` : '-',
                                                ])}
                                            />
                                        ) : (
                                            <p className="text-gray-400 italic">Nenhum canal cadastrado.</p>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-3">Funil de Vendas</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                                            <MetricCard label="Dias Úteis/Mês" value={formatNumber(planData.commercialPlanning?.salesFunnel?.workingDays || 0)} />
                                            <MetricCard label="Lead → MQL" value={formatPercentage(planData.commercialPlanning?.salesFunnel?.conversionRateLeadToMql || 0)} />
                                            <MetricCard label="MQL → SQL" value={formatPercentage(planData.commercialPlanning?.salesFunnel?.conversionRateMqlToSql || 0)} />
                                            <MetricCard label="SQL → Venda" value={formatPercentage(planData.commercialPlanning?.salesFunnel?.conversionRateSqlToSale || 0)} highlight />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <PageBreak />
                            <div id="report-section-financial-projections">
                                <SectionHeader number="07" title={`Projeções Financeiras 2026 (Cenário ${baseScenario})`} subtitle="Visão consolidada das projeções financeiras" />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
                                    <MetricCard label="Receita Líquida" value={formatCurrency(financialTotals2026.receitaLiquida)} highlight />
                                    <MetricCard label="Lucro Bruto" value={formatCurrency(financialTotals2026.lucroBruto)} />
                                    <MetricCard label="EBITDA" value={formatCurrency(financialTotals2026.ebitda)} highlight />
                                    <MetricCard label="Lucro Líquido" value={formatCurrency(financialTotals2026.lucroLiquido)} />
                                </div>
                                {/* 2025 vs 2026 comparison */}
                                <h3 className="text-lg font-bold text-gray-800 mb-3">Comparativo 2025 vs 2026</h3>
                                <DataTable
                                    headers={['Indicador', '2025 (Real)', '2026 (Projetado)', 'Variação']}
                                    rows={[
                                        ['Receita Líquida', formatCurrency(summary2025.receitaTotal), formatCurrency(financialTotals2026.receitaLiquida),
                                            <span className={clsx("font-bold", financialTotals2026.receitaLiquida >= summary2025.receitaTotal ? "text-green-600" : "text-red-600")}>
                                                {summary2025.receitaTotal > 0 ? `${(((financialTotals2026.receitaLiquida / summary2025.receitaTotal) - 1) * 100).toFixed(1).replace('.', ',')}%` : '-'}
                                            </span>
                                        ],
                                        ['EBITDA', formatCurrency(summary2025.ebitda), formatCurrency(financialTotals2026.ebitda),
                                            <span className={clsx("font-bold", financialTotals2026.ebitda >= summary2025.ebitda ? "text-green-600" : "text-red-600")}>
                                                {summary2025.ebitda > 0 ? `${(((financialTotals2026.ebitda / summary2025.ebitda) - 1) * 100).toFixed(1).replace('.', ',')}%` : '-'}
                                            </span>
                                        ],
                                        ['Lucro Líquido', formatCurrency(summary2025.ebitda), formatCurrency(financialTotals2026.lucroLiquido),
                                            <span className={clsx("font-bold", financialTotals2026.lucroLiquido >= summary2025.ebitda ? "text-green-600" : "text-red-600")}>
                                                {summary2025.ebitda > 0 ? `${(((financialTotals2026.lucroLiquido / summary2025.ebitda) - 1) * 100).toFixed(1).replace('.', ',')}%` : '-'}
                                            </span>
                                        ],
                                    ]}
                                />
                            </div>

                            <PageBreak />
                            <div id="report-section-dre-2026">
                                <SectionHeader number="08" title="Demonstrativo de Resultados (DRE) 2026" subtitle="Projeção mensal do resultado do exercício" />
                                {(() => {
                                    const { dre } = planData.financialPlan2026;
                                    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
                                    const sumMonths = (data: Record<string, number>) => Object.values(data || {}).reduce((s, v) => s + (v || 0), 0);
                                    const dreRows: { key: keyof DRE2026; label: string; bold?: boolean }[] = [
                                        { key: 'receitaBruta', label: 'Receita Bruta' },
                                        { key: 'receitaLiquida', label: '(=) Receita Líquida', bold: true },
                                        { key: 'custosVariaveis', label: '(-) Custos Variáveis' },
                                        { key: 'lucroBruto', label: '(=) Lucro Bruto', bold: true },
                                        { key: 'despesasFixas', label: '(-) Despesas Fixas' },
                                        { key: 'ebitda', label: '(=) EBITDA', bold: true },
                                        { key: 'lucroLiquido', label: '(=) Lucro Líquido', bold: true },
                                    ];
                                    return (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-800 text-white">
                                                        <th className="py-2 px-2 text-left font-semibold">Conta</th>
                                                        {months.map(m => <th key={m} className="py-2 px-1 text-right font-semibold uppercase">{m}</th>)}
                                                        <th className="py-2 px-2 text-right font-bold bg-gray-900">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {dreRows.map(({ key, label, bold }, ri) => (
                                                        <tr key={key} className={clsx("border-b border-gray-200", bold ? "bg-gray-100 font-bold" : ri % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                                                            <td className="py-1.5 px-2 text-gray-800 whitespace-nowrap">{label}</td>
                                                            {months.map(m => (
                                                                <td key={m} className="py-1.5 px-1 text-right text-gray-700">
                                                                    {formatCurrency((dre[key] as Record<string, number>)?.[m] || 0)}
                                                                </td>
                                                            ))}
                                                            <td className="py-1.5 px-2 text-right font-bold text-gray-900 bg-gray-100">
                                                                {formatCurrency(sumMonths(dre[key] as Record<string, number> || {}))}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })()}
                            </div>

                            <PageBreak />
                            <div id="report-section-cashflow-2026">
                                <SectionHeader number="09" title="Fluxo de Caixa (DFC) 2026" subtitle="Projeção de entradas, saídas e saldo de caixa" />
                                {(() => {
                                    const { dfc } = planData.financialPlan2026;
                                    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
                                    const sumMonths = (data: Record<string, number>) => Object.values(data || {}).reduce((s, v) => s + (v || 0), 0);
                                    const dfcRows: { key: keyof DFC2026; label: string; bold?: boolean }[] = [
                                        { key: 'entradas', label: 'Entradas' },
                                        { key: 'saidasOperacionais', label: '(-) Saídas Operacionais' },
                                        { key: 'fco', label: '(=) Fluxo de Caixa Operacional', bold: true },
                                        { key: 'investimentos', label: '(-) Investimentos' },
                                        { key: 'saldoFinalCaixa', label: '(=) Saldo Final de Caixa', bold: true },
                                    ];
                                    return (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-800 text-white">
                                                        <th className="py-2 px-2 text-left font-semibold">Conta</th>
                                                        {months.map(m => <th key={m} className="py-2 px-1 text-right font-semibold uppercase">{m}</th>)}
                                                        <th className="py-2 px-2 text-right font-bold bg-gray-900">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {dfcRows.map(({ key, label, bold }, ri) => (
                                                        <tr key={key} className={clsx("border-b border-gray-200", bold ? "bg-gray-100 font-bold" : ri % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                                                            <td className="py-1.5 px-2 text-gray-800 whitespace-nowrap">{label}</td>
                                                            {months.map(m => (
                                                                <td key={m} className="py-1.5 px-1 text-right text-gray-700">
                                                                    {formatCurrency((dfc[key] as Record<string, number>)?.[m] || 0)}
                                                                </td>
                                                            ))}
                                                            <td className="py-1.5 px-2 text-right font-bold text-gray-900 bg-gray-100">
                                                                {formatCurrency(sumMonths(dfc[key] as Record<string, number> || {}))}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })()}
                            </div>
                        </>
                    )}

                    {/* FOOTER */}
                    <div className="mt-16 pt-8 border-t-2 border-gray-200">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs text-gray-400">Documento confidencial</p>
                                <p className="text-xs text-gray-400">{planData.companyProfile.name || "Empresa"} - {reportTitle}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-400">Gerado por PLAN 2026</p>
                                <p className="text-xs text-gray-300">Gestão de Impacto</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ReportPreview;
