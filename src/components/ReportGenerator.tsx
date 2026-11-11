
import React, { useState } from 'react';
import { usePlan } from '../hooks/usePlanData';
import ReportPreview from './reports/ReportPreview';

const ReportCard: React.FC<{
    title: string;
    description: string;
    sections: string[];
    icon: React.ReactNode;
    color: string;
    onGenerate: () => Promise<void>;
    onView: () => void;
    analysisText?: string;
}> = ({ title, description, sections, icon, color, onGenerate, onView, analysisText }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            await onGenerate();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`p-5 ${color} flex items-center gap-4`}>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    {icon}
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                    <p className="text-sm text-white/80 mt-0.5">{description}</p>
                </div>
            </div>

            {/* Content */}
            <div className="p-5 flex-1">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Seções do Relatório</p>
                <div className="space-y-1.5">
                    {sections.map((section, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm text-gray-600">
                            <span className="text-xs font-bold text-brand-orange w-5">{String(i + 1).padStart(2, '0')}</span>
                            <span>{section}</span>
                        </div>
                    ))}
                </div>

                {/* Status */}
                {analysisText && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                        <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs font-bold text-green-700">Análise da IA gerada com sucesso</p>
                        </div>
                        <p className="text-xs text-green-600 mt-1 italic line-clamp-2">"{analysisText.substring(0, 120)}..."</p>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="p-5 pt-0 flex gap-3">
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-brand-orange rounded-xl hover:bg-orange-700 transition-all shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Gerando Análise...
                        </>
                    ) : (
                        <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            {analysisText ? 'Gerar Novamente' : 'Gerar com IA'}
                        </>
                    )}
                </button>
                <button
                    onClick={onView}
                    disabled={!analysisText}
                    className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Visualizar e Imprimir
                </button>
            </div>
        </div>
    );
};


const ReportGenerator: React.FC = () => {
    const { planData, generateDiagnosisReport, generatePlanReport, anoPlano, anoBase } = usePlan();
    const [viewingReport, setViewingReport] = useState<'diagnosis' | 'plan' | null>(null);

    return (
        <div className="space-y-8">
            {/* Header */}
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gradient-border">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Relatórios e Impressão</h1>
                <p className="text-gray-500 mt-2">
                    Gere relatórios profissionais e consolidados do seu planejamento, enriquecidos com análises da Inteligência Artificial.
                </p>
            </header>

            {/* Instructions */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                    <p className="text-sm font-bold text-amber-800">Como funciona</p>
                    <p className="text-sm text-amber-700 mt-1">
                        1. Clique em <strong>"Gerar com IA"</strong> para que a Inteligência Artificial analise seus dados e crie o sumário executivo.
                        2. Depois clique em <strong>"Visualizar e Imprimir"</strong> para ver o relatório completo formatado.
                        3. Use <strong>Ctrl+P</strong> (ou Cmd+P no Mac) para salvar como PDF ou imprimir.
                    </p>
                </div>
            </div>

            {/* Report Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ReportCard
                    title={`Relatório de Diagnóstico ${anoBase}`}
                    description="Análise completa da situação atual"
                    icon={<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                    color="bg-gradient-to-r from-blue-600 to-blue-700"
                    sections={[
                        'Sumário Executivo (Análise da IA)',
                        `Panorama Financeiro ${anoBase}`,
                        `Evolução Mensal ${anoBase}`,
                        'Análise Estratégica (SWOT)',
                        'Análise de Portfólio (Curva ABC)',
                        'Indicadores Comerciais',
                        'Indicadores de Pessoas',
                    ]}
                    onGenerate={generateDiagnosisReport}
                    onView={() => setViewingReport('diagnosis')}
                    analysisText={planData.analysis.diagnosisReportAnalysis}
                />
                <ReportCard
                    title={`Plano Estratégico ${anoPlano}`}
                    description="O relatório definitivo do planejamento"
                    icon={<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                    color="bg-gradient-to-r from-brand-orange to-orange-600"
                    sections={[
                        'Sumário Executivo (CSO Analysis)',
                        'Contexto Estratégico (SWOT)',
                        `Metas e Objetivos ${anoPlano}`,
                        'OKRs - Objetivos e Resultados-Chave',
                        'Plano de Ação (priorizado)',
                        'Planejamento Comercial',
                        `Projeções Financeiras (${anoBase} vs ${anoPlano})`,
                        `DRE Mensal ${anoPlano}`,
                        `Fluxo de Caixa (DFC) ${anoPlano}`,
                    ]}
                    onGenerate={generatePlanReport}
                    onView={() => setViewingReport('plan')}
                    analysisText={planData.analysis.planReportAnalysis}
                />
            </div>
            
            {viewingReport && (
                <ReportPreview 
                    reportType={viewingReport} 
                    onClose={() => setViewingReport(null)} 
                />
            )}
        </div>
    );
};

export default ReportGenerator;
