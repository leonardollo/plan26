
import React, { useState } from 'react';
import { usePlan } from '../hooks/usePlanData';
import { formatCurrency } from '../utils/formatters';
import CurrencyInput from './shared/CurrencyInput';

const OnboardingWizard: React.FC = () => {
    const { planData, updateCompanyProfile, updateSheetValue, goals2026, updateInflation, updateScenarioGrowthPercentage, updateGoal, anoPlano, anoBase } = usePlan();
    
    // Logic to determine if wizard should show: Only if logged in AND company name is empty
    // We use local state to close it once finished in this session, even if data is still technically syncing
    const [isVisible, setIsVisible] = useState(true);
    const [step, setStep] = useState(1);
    
    // Temporary state for inputs
    const [name, setName] = useState('');
    const [industry, setIndustry] = useState('');
    const [revenue2025, setRevenue2025] = useState('');
    const [margin2025, setMargin2025] = useState('');
    const [growthGoal, setGrowthGoal] = useState('');

    // If company name already exists, we assume onboarding is done (or not needed)
    if (planData.companyProfile.name && isVisible) {
       // However, we render nothing to avoid flicker, effect will handle logic if needed, 
       // but typically we rely on the component simply returning null if data is present
       return null; 
    }
    
    if (!isVisible) return null;

    const handleNext = () => {
        setStep(prev => prev + 1);
    };

    const handleFinish = () => {
        // 1. Save Profile
        updateCompanyProfile('name', name);
        updateCompanyProfile('industry', industry);

        // 2. Save Basic Financials (Distributed evenly for 2025)
        if (revenue2025) {
            const annualRev = parseFloat(revenue2025);
            const monthlyRev = annualRev / 12;
            const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;
            
            // Set Revenue
            months.forEach(m => updateSheetValue('receitaBruta', m, monthlyRev.toString()));
            
            // Estimate Costs based on margin (Simplified)
            if (margin2025) {
                const margin = parseFloat(margin2025) / 100;
                const cost = annualRev * (1 - margin);
                const monthlyCost = cost / 12;
                // Put 60% in variable, 40% in fixed (rough estimate to populate)
                months.forEach(m => updateSheetValue('cmv', m, (monthlyCost * 0.6).toString()));
                months.forEach(m => updateSheetValue('despesasOperacionais', m, (monthlyCost * 0.4).toString()));
            }
        }

        // 3. Set Goals & Scenarios
        if (growthGoal) {
            updateScenarioGrowthPercentage('Conservador', growthGoal);
            updateScenarioGrowthPercentage('Otimista', (parseFloat(growthGoal) * 1.5).toString());
            updateScenarioGrowthPercentage('Disruptivo', (parseFloat(growthGoal) * 0.5).toString());
        }

        setIsVisible(false);
    };

    return (
        <div className="fixed inset-0 bg-brand-dark/90 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col relative">
                {/* Progress Bar */}
                <div className="h-2 bg-gray-100 w-full">
                    <div 
                        className="h-full bg-brand-orange transition-all duration-500 ease-out" 
                        style={{ width: `${(step / 3) * 100}%` }}
                    />
                </div>

                <div className="p-8">
                    {step === 1 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="text-center">
                                <span className="text-4xl">🚀</span>
                                <h2 className="text-2xl font-bold text-gray-900 mt-4">Bem-vindo ao PLAN {anoPlano}</h2>
                                <p className="text-gray-600 mt-2">Vamos configurar o sistema para o seu negócio em menos de 1 minuto.</p>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Qual o nome da sua empresa?</label>
                                    <input 
                                        type="text" 
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange p-3 border"
                                        placeholder="Ex: Tech Solutions Ltda"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Qual o seu ramo de atividade?</label>
                                    <input 
                                        type="text" 
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange p-3 border"
                                        placeholder="Ex: Varejo de Moda, Software SaaS, Consultoria..."
                                        value={industry}
                                        onChange={e => setIndustry(e.target.value)}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">A Inteligência Artificial usará isso para dar dicas de mercado.</p>
                                </div>
                            </div>

                            <button 
                                onClick={handleNext}
                                disabled={!name || !industry}
                                className="w-full py-3 px-4 bg-brand-orange text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Continuar
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="text-center">
                                <span className="text-4xl">📊</span>
                                <h2 className="text-2xl font-bold text-gray-900 mt-4">Ponto de Partida</h2>
                                <p className="text-gray-600 mt-2">Nos dê uma estimativa de {anoBase} para gerar os gráficos iniciais.</p>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Faturamento Anual {anoBase} (Aprox.)</label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3 top-3 text-gray-500">R$</span>
                                        <CurrencyInput 
                                            value={revenue2025 ? parseFloat(revenue2025) : null}
                                            onChange={(v) => setRevenue2025(v)}
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange p-3 pl-10 border"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Margem de Lucro Estimada (%)</label>
                                    <div className="relative mt-1">
                                        <CurrencyInput 
                                            value={margin2025 ? parseFloat(margin2025) : null}
                                            onChange={(v) => setMargin2025(v)}
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange p-3 pr-10 border"
                                            placeholder="Ex: 20"
                                        />
                                        <span className="absolute right-3 top-3 text-gray-500">%</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Usaremos isso para estimar seus custos automaticamente.</p>
                                </div>
                            </div>

                            <button 
                                onClick={handleNext}
                                disabled={!revenue2025}
                                className="w-full py-3 px-4 bg-brand-blue text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Próximo
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="text-center">
                                <span className="text-4xl">🎯</span>
                                <h2 className="text-2xl font-bold text-gray-900 mt-4">Ambição para {anoPlano}</h2>
                                <p className="text-gray-600 mt-2">Qual o seu objetivo principal de crescimento?</p>
                            </div>
                            
                            <div className="space-y-6 py-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 text-center mb-4">Meta de Crescimento de Receita (%)</label>
                                    <div className="flex justify-center items-center gap-4">
                                        <button onClick={() => setGrowthGoal('10')} className={`p-4 border-2 rounded-xl w-24 text-center hover:border-brand-orange transition-all ${growthGoal === '10' ? 'border-brand-orange bg-orange-50' : 'border-gray-200'}`}>
                                            <div className="text-lg font-bold">10%</div>
                                            <div className="text-xs text-gray-500">Seguro</div>
                                        </button>
                                        <button onClick={() => setGrowthGoal('25')} className={`p-4 border-2 rounded-xl w-24 text-center hover:border-brand-orange transition-all ${growthGoal === '25' ? 'border-brand-orange bg-orange-50' : 'border-gray-200'}`}>
                                            <div className="text-lg font-bold">25%</div>
                                            <div className="text-xs text-gray-500">Ideal</div>
                                        </button>
                                        <button onClick={() => setGrowthGoal('50')} className={`p-4 border-2 rounded-xl w-24 text-center hover:border-brand-orange transition-all ${growthGoal === '50' ? 'border-brand-orange bg-orange-50' : 'border-gray-200'}`}>
                                            <div className="text-lg font-bold">50%</div>
                                            <div className="text-xs text-gray-500">Ousado</div>
                                        </button>
                                    </div>
                                    <div className="mt-4 text-center">
                                        <CurrencyInput 
                                            value={growthGoal ? parseFloat(growthGoal) : null}
                                            onChange={(v) => setGrowthGoal(v)}
                                            className="w-32 p-2 border-b text-center focus:outline-none focus:border-brand-orange"
                                            placeholder="Outro valor..."
                                        />
                                        <span className="text-gray-500 ml-1">%</span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handleFinish}
                                disabled={!growthGoal}
                                className="w-full py-3 px-4 bg-brand-optimistic text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-200"
                            >
                                Concluir Configuração e Acessar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingWizard;
