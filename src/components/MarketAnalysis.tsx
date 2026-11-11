import React, { useMemo } from 'react';
import { usePlan } from '../hooks/usePlanData';
import type { MarketCompetitionData } from '../types';
import { formatPercentage, formatCurrency } from '../utils/formatters';
import CurrencyInput from './shared/CurrencyInput';

const MarketAnalysis: React.FC = () => {
    const { planData, updateMarketCompetitionData, summary2025, anoBase } = usePlan();
    const { marketCompetition } = planData.marketAnalysis;

    // Calcular automaticamente a participação de mercado
    const suaParticipacaoCalc = useMemo(() => {
        const tamanhoMercado = marketCompetition.tamanhoMercado || 0;
        const receitaAnual = summary2025.receitaBrutaTotal || 0;
        if (tamanhoMercado > 0 && receitaAnual > 0) {
            return (receitaAnual / tamanhoMercado) * 100;
        }
        return 0;
    }, [marketCompetition.tamanhoMercado, summary2025.receitaBrutaTotal]);

    const renderCurrencyField = (name: keyof MarketCompetitionData, label: string, hint?: string) => {
        const value = marketCompetition[name] as number ?? null;
        const isCurrency = label.includes('(R$)');
        const isPercent = label.includes('(%)');
        
        return (
            <div>
                <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                    {isCurrency && <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10"><span className="text-gray-500 sm:text-sm">R$</span></div>}
                    <CurrencyInput
                        value={value}
                        onChange={(v) => updateMarketCompetitionData(name, v)}
                        className={`block w-full rounded-xl border border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm p-2 ${isCurrency ? 'pl-8' : ''} ${isPercent ? 'pr-8' : ''}`}
                        placeholder="0"
                    />
                    {isPercent && <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"><span className="text-gray-500 sm:text-sm">%</span></div>}
                </div>
                {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
            </div>
        );
    };

    const renderTextInput = (name: keyof MarketCompetitionData, label: string, hint?: string) => {
        const value = marketCompetition[name] ?? '';
        return (
            <div>
                <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
                <input
                    type="text"
                    name={name}
                    id={name}
                    className="mt-1 block w-full rounded-xl border border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm p-2"
                    placeholder="0"
                    value={value}
                    onChange={(e) => updateMarketCompetitionData(name, e.target.value)}
                />
                {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
            </div>
        );
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 mt-6">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Mercado e Concorrência</h2>
            <p className="text-sm text-gray-600">Preencha os dados do seu mercado. A participação de mercado é calculada automaticamente com base na sua receita de {anoBase}.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {renderCurrencyField('tamanhoMercado', 'Tamanho do Mercado (R$)', 'Estimativa do faturamento total do seu setor.')}
                {renderCurrencyField('taxaCrescimentoMercado', 'Taxa Crescimento Mercado (%)', 'Crescimento anual esperado do setor.')}
                
                {/* Participação calculada automaticamente */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">Sua Participação de Mercado</label>
                    <div className="mt-1 p-2 bg-gray-100 rounded-xl border border-gray-200">
                        <p className="text-lg font-bold text-brand-orange">{formatPercentage(suaParticipacaoCalc, 2)}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                            {summary2025.receitaBrutaTotal > 0 && marketCompetition.tamanhoMercado > 0 
                                ? `${formatCurrency(summary2025.receitaBrutaTotal, true)} / ${formatCurrency(marketCompetition.tamanhoMercado, true)}`
                                : 'Preencha o tamanho do mercado e a receita em Coleta de Dados'
                            }
                        </p>
                    </div>
                </div>

                {renderCurrencyField('numConcorrentesDiretos', 'Nº Concorrentes Diretos', 'Quantos concorrentes disputam o mesmo mercado.')}
                {renderTextInput('principalConcorrente', 'Principal Concorrente', 'Nome da empresa que mais compete com você.')}
                {renderTextInput('seuDiferencial', 'Seu Diferencial', 'O que torna sua empresa única no mercado?')}
            </div>
        </div>
    )
};

export default MarketAnalysis;
