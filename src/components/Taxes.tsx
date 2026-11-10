import React, { useEffect, useRef, useState } from 'react';
import { usePlan } from '../hooks/usePlanData';
import type { TaxesData } from '../types';
import { formatCurrency, formatPercentage, formatNumber } from '../utils/formatters';
import { aliquotaDeducao } from '../utils/calculos/impostos';
import CurrencyInput from './shared/CurrencyInput';
import { getTaxRecommendation } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

// ===== TAB TYPES =====
type TaxTab = 'config' | 'cenario' | 'simulador' | 'engenharia' | 'sugestao';

// ===== TIMELINE DATA =====
const timelineData = [
    { year: '2026', title: 'Fase de Testes', color: 'bg-yellow-500', items: ['Alíquota-teste: 0,9% CBS + 0,1% IBS = 1%', 'PIS e COFINS continuam normalmente', 'Valor pago no teste é compensado com PIS/COFINS', 'Notas fiscais com novos campos CBS/IBS', 'Sem aumento real de carga tributária'] },
    { year: '2027', title: 'Virada Federal', color: 'bg-red-500', items: ['PIS e COFINS são EXTINTOS definitivamente', 'CBS entra com alíquota cheia (~8,8%)', 'IPI reduzido a zero (exceto Zona Franca)', 'Split Payment obrigatório (imposto retido na hora)', 'Imposto Seletivo entra em vigor'] },
    { year: '2029-32', title: 'Transição Estadual', color: 'bg-blue-500', items: ['Redução progressiva do ICMS e ISS', '2029: 90% ICMS/ISS + 10% IBS', '2030: 80% ICMS/ISS + 20% IBS', '2031: 60% ICMS/ISS + 40% IBS', '2032: 40% ICMS/ISS + 60% IBS'] },
    { year: '2033', title: 'Sistema Definitivo', color: 'bg-green-500', items: ['ICMS e ISS extintos totalmente', 'IBS em 100% da alíquota plena', 'IVA Dual completo (CBS + IBS)', 'Alíquota total estimada: 26,5% a 28,6%', 'Brasil entre maiores IVAs do mundo'] },
];

const Taxes: React.FC = () => {
    const { taxes, updateTaxes, applyTaxesTo2025, summary2025, planData } = usePlan();
    const prevTaxesRef = useRef<string>('');
    const [activeTab, setActiveTab] = useState<TaxTab>('config');
    const [taxRecommendation, setTaxRecommendation] = useState<string>('');
    const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);
    const [recommendationError, setRecommendationError] = useState<string>('');

    const handleGetTaxRecommendation = async () => {
        const cnpj = planData.companyProfile?.cnpj;
        if (!cnpj || cnpj.replace(/[^\d]/g, '').length !== 14) {
            setRecommendationError('CNPJ não configurado. Vá em Configurações e preencha o CNPJ da empresa.');
            return;
        }
        setIsLoadingRecommendation(true);
        setRecommendationError('');
        setTaxRecommendation('');
        try {
            const result = await getTaxRecommendation(
                cnpj,
                taxes.regimeTributario || 'Não informado',
                calculatedRate,
                receitaBruta2025
            );
            setTaxRecommendation(result);
        } catch (error) {
            setRecommendationError(error instanceof Error ? error.message : 'Erro ao gerar recomendação.');
        } finally {
            setIsLoadingRecommendation(false);
        }
    };

    // Alíquota sobre a receita, sem IRPJ/CSLL fora do Simples: eles entram na DRE, sobre o lucro.
    // Por isso a simulação da reforma (aba Simulador) compara só os tributos sobre consumo, que a reforma substitui.
    const calculatedRate = aliquotaDeducao(taxes);

    const totalEncargos = (taxes.inssPatronal || 0) + (taxes.fgts || 0) + (taxes.ratTerceiros || 0);

    useEffect(() => {
        if (taxes.totalEncargosFolha !== totalEncargos) {
            updateTaxes('totalEncargosFolha', totalEncargos.toString());
        }
    }, [taxes.inssPatronal, taxes.fgts, taxes.ratTerceiros]);

    useEffect(() => {
        const taxKey = JSON.stringify({
            regimeTributario: taxes.regimeTributario,
            aliquotaEfetiva: taxes.aliquotaEfetiva,
            simplesNacional: taxes.simplesNacional,
            iss: taxes.iss, icms: taxes.icms, pis: taxes.pis,
            cofins: taxes.cofins, irpj: taxes.irpj, csll: taxes.csll
        });
        if (prevTaxesRef.current && prevTaxesRef.current !== taxKey && calculatedRate > 0) {
            applyTaxesTo2025();
        }
        prevTaxesRef.current = taxKey;
    }, [taxes.regimeTributario, taxes.aliquotaEfetiva, taxes.simplesNacional,
        taxes.iss, taxes.icms, taxes.pis, taxes.cofins, taxes.irpj, taxes.csll]);

    const receitaBruta2025 = summary2025?.receitaBrutaTotal || 0;
    const impostoCalculado = receitaBruta2025 * (calculatedRate / 100);

    // Simulação de impacto da reforma
    const ivaEstimado = 27.5; // Média estimada CBS + IBS
    const impostoNovoSistema = receitaBruta2025 * (ivaEstimado / 100);
    const diferencaImposto = impostoNovoSistema - impostoCalculado;
    const isServicos = taxes.regimeTributario !== 'Simples Nacional' && (taxes.iss || 0) > 0;

    const handleCurrencyChange = (name: keyof TaxesData, value: string) => {
        updateTaxes(name, value);
    };

    const renderPercentInput = (name: keyof TaxesData, label: string, hint?: string, disabled: boolean = false) => {
        const value = taxes[name] as number ?? null;
        return (
            <div>
                <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                    <CurrencyInput
                        value={value}
                        onChange={(v) => handleCurrencyChange(name, v)}
                        className={`block w-full rounded-xl border border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm p-2 pr-8 ${disabled ? 'bg-gray-100' : ''}`}
                        placeholder="0"
                        disabled={disabled}
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <span className="text-gray-500 sm:text-sm">%</span>
                    </div>
                </div>
                {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
            </div>
        );
    };

    const renderCurrencyField = (name: keyof TaxesData, label: string, hint?: string) => {
        const value = taxes[name] as number ?? null;
        return (
            <div>
                <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10">
                        <span className="text-gray-500 sm:text-sm">R$</span>
                    </div>
                    <CurrencyInput
                        value={value}
                        onChange={(v) => handleCurrencyChange(name, v)}
                        className="block w-full rounded-xl border border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm p-2 pl-8"
                        placeholder="0"
                    />
                </div>
                {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
            </div>
        );
    };

    // ===== TAB: CONFIGURAÇÃO =====
    const renderConfigTab = () => (
        <div className="space-y-8">
            {/* Resumo Visual */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-brand-orange space-y-4">
                <h2 className="text-xl font-bold text-brand-orange">Resumo do Impacto Tributário</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-orange-50 p-4 rounded-lg text-center">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Alíquota Efetiva</p>
                        <p className="text-3xl font-extrabold text-brand-orange mt-1">{formatPercentage(calculatedRate)}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Receita Bruta 2025</p>
                        <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(receitaBruta2025, true)}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg text-center">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Total Impostos Estimado</p>
                        <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(impostoCalculado, true)}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Receita Líquida Estimada</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(receitaBruta2025 - impostoCalculado, true)}</p>
                    </div>
                </div>
                <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-green-600 mr-2 text-lg">&#10003;</span>
                    <p className="text-sm text-green-800">
                        <strong>Aplicação automática:</strong> Ao alterar as alíquotas, os valores de impostos na aba "Coleta de Dados 2025" são recalculados automaticamente.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Regime Tributário */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 md:col-span-2">
                    <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Regime Tributário</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="regimeTributario" className="block text-sm font-medium text-gray-700">Regime Tributário Atual</label>
                            <select
                                name="regimeTributario"
                                id="regimeTributario"
                                value={taxes.regimeTributario || 'Simples Nacional'}
                                onChange={(e) => updateTaxes('regimeTributario', e.target.value)}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-orange focus:border-brand-orange sm:text-sm rounded-xl"
                            >
                                <option>Simples Nacional</option>
                                <option>Lucro Presumido</option>
                                <option>Lucro Real</option>
                            </select>
                        </div>
                        {taxes.regimeTributario === 'Simples Nacional' && (
                            <div>
                                <label htmlFor="anexoSimples" className="block text-sm font-medium text-gray-700">Anexo do Simples</label>
                                <input
                                    type="text"
                                    name="anexoSimples"
                                    id="anexoSimples"
                                    className="mt-1 block w-full rounded-xl border border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm p-2"
                                    placeholder="Anexo I, II, III..."
                                    value={taxes.anexoSimples || ''}
                                    onChange={(e) => updateTaxes('anexoSimples', e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Impostos sobre Faturamento */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Impostos sobre Faturamento</h2>
                    <div className="space-y-4">
                        {renderPercentInput('aliquotaEfetiva', 'Alíquota Efetiva Total (%)', 'Se souber a alíquota total, preencha aqui. No Lucro Real, não inclua IRPJ e CSLL: eles são calculados sobre o lucro.')}
                        {taxes.regimeTributario === 'Simples Nacional' &&
                            renderPercentInput('simplesNacional', 'Simples Nacional (%)', 'Alíquota única do Simples')
                        }
                        {taxes.regimeTributario !== 'Simples Nacional' && (
                            <>
                                {renderPercentInput('iss', 'ISS (%)', 'Imposto Sobre Serviço')}
                                {renderPercentInput('icms', 'ICMS (%)', 'Se vende produto')}
                                {renderPercentInput('pis', 'PIS (%)', 'Será extinto em 2027')}
                                {renderPercentInput('cofins', 'COFINS (%)', 'Será extinta em 2027')}
                                {renderPercentInput('irpj', 'IRPJ (%)', 'Imposto de Renda Pessoa Jurídica')}
                                {renderPercentInput('csll', 'CSLL (%)', 'Contribuição Social sobre o Lucro Líquido')}
                            </>
                        )}
                    </div>
                </div>

                {/* Encargos e Valores */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Encargos sobre Folha</h2>
                        <div className="space-y-4">
                            {renderPercentInput('inssPatronal', 'INSS Patronal (%)', 'Padrão: 20%')}
                            {renderPercentInput('fgts', 'FGTS (%)', 'Padrão: 8%')}
                            {renderPercentInput('ratTerceiros', 'RAT + Terceiros (%)', 'Geralmente 3-6%')}
                            {renderPercentInput('totalEncargosFolha', 'Total Encargos Folha (%)', '', true)}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Valores Pagos</h2>
                        <div className="space-y-4">
                            {renderCurrencyField('totalImpostos2024', 'Total Impostos 2024 (R$)', 'Valor total pago em impostos em 2024')}
                            {renderCurrencyField('totalImpostos2025', 'Total Impostos 2025 (R$)', 'Valor total pago em impostos em 2025')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // ===== TAB: CENÁRIO TRIBUTÁRIO =====
    const renderCenarioTab = () => (
        <div className="space-y-8">
            {/* Alerta de Contexto */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 p-6 rounded-2xl border-2 border-red-200">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">&#9888;</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-red-800">Contexto: Ajuste Fiscal do Governo</h3>
                        <p className="text-sm text-red-700 mt-2 leading-relaxed">
                            O Brasil está em processo de <strong>ajuste fiscal</strong>. A Reforma Tributária (EC 132/2023 + LC 214/2025) foi desenhada para ser <strong>neutra em arrecadação global</strong>, mas <strong>redistributiva entre setores</strong>. Na prática, isso significa que alguns setores pagarão mais e outros menos. A LC 224/2025 já ampliou a base tributável do Lucro Presumido (presunção de 32% para 35,2%), sinalizando que o governo busca aumentar a arrecadação efetiva.
                        </p>
                    </div>
                </div>
            </div>

            {/* O que está acontecendo AGORA em 2026 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                        <span className="text-xl font-bold text-yellow-700">26</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">O que está acontecendo AGORA em 2026</h2>
                        <p className="text-sm text-gray-500">Fase de testes operacionais com movimentação financeira real</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                            <h4 className="font-bold text-yellow-800 text-sm uppercase tracking-wider mb-2">Alíquota-Teste do IVA Dual</h4>
                            <div className="flex items-center gap-3">
                                <div className="text-center">
                                    <p className="text-2xl font-extrabold text-yellow-700">0,9%</p>
                                    <p className="text-xs text-yellow-600 font-medium">CBS (Federal)</p>
                                </div>
                                <span className="text-xl text-yellow-400">+</span>
                                <div className="text-center">
                                    <p className="text-2xl font-extrabold text-yellow-700">0,1%</p>
                                    <p className="text-xs text-yellow-600 font-medium">IBS (Est/Mun)</p>
                                </div>
                                <span className="text-xl text-yellow-400">=</span>
                                <div className="text-center">
                                    <p className="text-3xl font-extrabold text-yellow-800">1%</p>
                                    <p className="text-xs text-yellow-600 font-medium">Total Teste</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                            <h4 className="font-bold text-green-800 text-sm mb-2">Sem aumento de carga</h4>
                            <p className="text-sm text-green-700 leading-relaxed">O 1% pago de CBS/IBS é <strong>compensado integralmente</strong> com o PIS/COFINS que você já paga. Na prática, o desembolso total não muda em 2026. É um teste da "encanação" por onde o dinheiro vai passar.</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                            <h4 className="font-bold text-blue-800 text-sm mb-2">O que sua empresa precisa fazer em 2026</h4>
                            <ul className="space-y-2 text-sm text-blue-700">
                                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">&#9679;</span> Atualizar sistema de emissão de notas fiscais (novos campos CBS/IBS)</li>
                                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">&#9679;</span> Revisar cadastro de produtos (NCMs e classificação fiscal)</li>
                                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">&#9679;</span> Integrar ERP com a "Calculadora do Fisco" da Receita Federal</li>
                                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">&#9679;</span> Simular impacto da alíquota cheia no seu negócio</li>
                                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">&#9679;</span> Reavaliar regime tributário (Simples vs Presumido vs Real)</li>
                            </ul>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                            <h4 className="font-bold text-purple-800 text-sm mb-2">Simples Nacional: Regime Híbrido</h4>
                            <p className="text-sm text-purple-700 leading-relaxed">Empresas do Simples têm até <strong>setembro de 2026</strong> para optar pelo regime híbrido: recolher CBS e IBS fora do DAS, gerando créditos integrais para seus clientes. Ideal para quem vende para outras empresas (B2B).</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* O que muda em 2027 - A Grande Virada */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-red-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                        <span className="text-xl font-bold text-red-700">27</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">2027: A Grande Virada</h2>
                        <p className="text-sm text-red-500 font-medium">Mudanças irreversíveis que impactam TODAS as empresas</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center">
                        <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Extintos</p>
                        <p className="text-lg font-extrabold text-red-700 mt-2">PIS + COFINS</p>
                        <p className="text-xs text-red-500 mt-1">Deixam de existir definitivamente</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-200 text-center">
                        <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">Novo Tributo Federal</p>
                        <p className="text-lg font-extrabold text-orange-700 mt-2">CBS ~8,8%</p>
                        <p className="text-xs text-orange-500 mt-1">Substitui PIS/COFINS com alíquota cheia</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 text-center">
                        <p className="text-xs font-bold text-purple-500 uppercase tracking-wider">IVA Total Estimado</p>
                        <p className="text-lg font-extrabold text-purple-700 mt-2">26,5% a 28,6%</p>
                        <p className="text-xs text-purple-500 mt-1">CBS + IBS (entre os maiores do mundo)</p>
                    </div>
                </div>

                {/* Split Payment */}
                <div className="p-5 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200">
                    <h3 className="font-bold text-red-800 text-base mb-3">Split Payment: O Fim do Float Financeiro</h3>
                    <p className="text-sm text-red-700 leading-relaxed mb-4">
                        A partir de 2027, o <strong>Split Payment</strong> será obrigatório. Quando o cliente pagar com cartão, Pix ou qualquer meio eletrônico, o sistema bancário <strong>separará automaticamente o imposto</strong> e enviará direto para o governo. Na conta da sua empresa cairá apenas o valor líquido.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 bg-white rounded-lg border border-red-100 text-center">
                            <p className="text-xs font-bold text-gray-500 uppercase">Cliente Paga</p>
                            <p className="text-lg font-bold text-gray-900">R$ 100,00</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg border border-red-100 text-center">
                            <p className="text-xs font-bold text-red-500 uppercase">Governo Recebe</p>
                            <p className="text-lg font-bold text-red-600">~R$ 28,00</p>
                            <p className="text-xs text-red-400">Automaticamente</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg border border-green-100 text-center">
                            <p className="text-xs font-bold text-green-500 uppercase">Empresa Recebe</p>
                            <p className="text-lg font-bold text-green-600">~R$ 72,00</p>
                            <p className="text-xs text-green-400">Valor líquido</p>
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-sm text-yellow-800"><strong>Impacto no caixa:</strong> Empresas que usavam o prazo entre a venda e o vencimento do imposto para girar capital de giro precisarão se replanejar. O dinheiro do imposto não ficará mais disponível no caixa.</p>
                    </div>
                </div>

                {/* Imposto Seletivo */}
                <div className="mt-4 p-5 bg-gray-50 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-gray-800 text-base mb-3">Imposto Seletivo (IS) - "Imposto do Pecado"</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">Novo tributo com função extrafiscal: desestimular consumo de produtos prejudiciais à saúde e ao meio ambiente.</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { item: 'Cigarros e Fumo', detail: 'Alíquota corrigida pelo IPCA' },
                            { item: 'Bebidas Alcoólicas', detail: 'Progressiva por teor alcoólico' },
                            { item: 'Bebidas Açucaradas', detail: 'Refrigerantes e sucos com açúcar' },
                            { item: 'Veículos Poluentes', detail: 'Por potência e eficiência' },
                        ].map(s => (
                            <div key={s.item} className="p-3 bg-white rounded-lg border border-gray-200 text-center">
                                <p className="text-sm font-bold text-gray-800">{s.item}</p>
                                <p className="text-xs text-gray-500 mt-1">{s.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quem paga mais e quem paga menos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-200">
                    <h3 className="text-lg font-bold text-red-700 mb-4">Setores que pagarão MAIS</h3>
                    <div className="space-y-3">
                        {[
                            { setor: 'Serviços (advocacia, TI, consultoria)', de: '~8-15%', para: '~19-28%', motivo: 'Folha de pagamento não gera crédito tributário. Atenuação: profissionais liberais -30%, saúde/educação -60%.' },
                            { setor: 'Transporte de Cargas', de: '~19,5%', para: '~28%', motivo: 'Frete pode subir ~10%. Impacto em toda a cadeia produtiva.' },
                            { setor: 'Produtos "do Pecado"', de: 'Variável', para: '+IS adicional', motivo: 'Cigarros, álcool, refrigerantes, veículos poluentes.' },
                        ].map(s => (
                            <div key={s.setor} className="p-3 bg-red-50 rounded-lg border border-red-100">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-sm font-bold text-red-800">{s.setor}</p>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-500">{s.de}</span>
                                        <span className="text-red-500 font-bold">&rarr;</span>
                                        <span className="text-red-700 font-bold">{s.para}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-red-600">{s.motivo}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-200">
                    <h3 className="text-lg font-bold text-green-700 mb-4">Setores que pagarão MENOS</h3>
                    <div className="space-y-3">
                        {[
                            { setor: 'Indústria', beneficio: 'Não-cumulatividade plena permite créditos amplos sobre todos os insumos. Fim da guerra fiscal.' },
                            { setor: 'Exportações', beneficio: 'Desoneração completa. Produtos exportados não pagam IBS nem CBS.' },
                            { setor: 'Cesta Básica', beneficio: 'Alíquota ZERO para itens essenciais: arroz, feijão, carnes, leite, pão francês.' },
                            { setor: 'Saúde e Educação', beneficio: 'Redução de 60% na alíquota do IVA. Medicamentos essenciais com alíquota zero.' },
                        ].map(s => (
                            <div key={s.setor} className="p-3 bg-green-50 rounded-lg border border-green-100">
                                <p className="text-sm font-bold text-green-800 mb-1">{s.setor}</p>
                                <p className="text-xs text-green-600">{s.beneficio}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Timeline da Transição */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Cronograma Completo da Transição (2026-2033)</h2>
                <div className="space-y-6">
                    {timelineData.map((phase, idx) => (
                        <div key={phase.year} className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <div className={`w-12 h-12 ${phase.color} rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                                    {phase.year.substring(0, 4)}
                                </div>
                                {idx < timelineData.length - 1 && <div className="w-0.5 h-full bg-gray-200 mt-2" />}
                            </div>
                            <div className="flex-1 pb-6">
                                <h3 className="text-base font-bold text-gray-900">{phase.title}</h3>
                                <ul className="mt-2 space-y-1">
                                    {phase.items.map((item, i) => (
                                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                            <span className="text-gray-400 mt-0.5 text-xs">&#9679;</span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabela Comparativa dos 5 Tributos */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">De 5 Tributos para 3: O que muda</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="text-left p-3 font-bold text-gray-700">Tributo Atual</th>
                                <th className="text-left p-3 font-bold text-gray-700">Competência</th>
                                <th className="text-center p-3 font-bold text-gray-700">Extinto em</th>
                                <th className="text-left p-3 font-bold text-gray-700">Substituído por</th>
                                <th className="text-left p-3 font-bold text-gray-700">O que muda</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {[
                                { tributo: 'PIS', comp: 'Federal', extinto: '2027', sub: 'CBS', muda: 'Não-cumulatividade plena. Créditos amplos.' },
                                { tributo: 'COFINS', comp: 'Federal', extinto: '2027', sub: 'CBS', muda: 'Fusão com PIS em tributo único federal.' },
                                { tributo: 'IPI', comp: 'Federal', extinto: '2027*', sub: 'Imposto Seletivo', muda: '*Zerado exceto Zona Franca. IS para produtos nocivos.' },
                                { tributo: 'ICMS', comp: 'Estadual', extinto: '2033', sub: 'IBS', muda: 'Transição gradual 2029-2033. Cobrança no destino.' },
                                { tributo: 'ISS', comp: 'Municipal', extinto: '2033', sub: 'IBS', muda: 'Fim da distinção mercadoria vs serviço.' },
                            ].map(t => (
                                <tr key={t.tributo} className="hover:bg-gray-50">
                                    <td className="p-3 font-bold text-gray-900">{t.tributo}</td>
                                    <td className="p-3 text-gray-600">{t.comp}</td>
                                    <td className="p-3 text-center"><span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">{t.extinto}</span></td>
                                    <td className="p-3 font-medium text-brand-orange">{t.sub}</td>
                                    <td className="p-3 text-gray-600">{t.muda}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    // ===== TAB: SIMULADOR DE IMPACTO =====
    const renderSimuladorTab = () => {
        const regimeAtual = taxes.regimeTributario || 'Simples Nacional';
        
        // Estimativas por regime
        let ivaEstimadoRegime = ivaEstimado;
        let creditoEstimado = 0;
        let cargaEfetivaEstimada = ivaEstimado;
        let observacao = '';

        if (regimeAtual === 'Simples Nacional') {
            ivaEstimadoRegime = 27.5;
            creditoEstimado = 0;
            cargaEfetivaEstimada = calculatedRate; // Simples mantém regime próprio
            observacao = 'Empresas do Simples Nacional mantêm regime próprio durante a transição. A carga não muda diretamente, mas seus clientes B2B podem preferir fornecedores do regime geral (que geram créditos). Avalie o regime híbrido.';
        } else if (regimeAtual === 'Lucro Presumido') {
            ivaEstimadoRegime = 27.5;
            creditoEstimado = isServicos ? 5 : 15;
            cargaEfetivaEstimada = ivaEstimadoRegime - creditoEstimado;
            observacao = 'No Lucro Presumido, a presunção de lucro subiu de 32% para 35,2% (LC 224/2025). Com a CBS cheia em 2027, avalie migrar para Lucro Real se tiver muitos insumos para creditar.';
        } else {
            ivaEstimadoRegime = 27.5;
            creditoEstimado = isServicos ? 5 : 20;
            cargaEfetivaEstimada = ivaEstimadoRegime - creditoEstimado;
            observacao = 'No Lucro Real, a não-cumulatividade plena permite créditos sobre TODOS os insumos. Quanto mais insumos tributados você comprar, menor a carga efetiva. Mapeie toda sua cadeia de fornecedores.';
        }

        const impostoAtual = receitaBruta2025 * (calculatedRate / 100);
        const impostoFuturo = receitaBruta2025 * (cargaEfetivaEstimada / 100);
        const diferenca = impostoFuturo - impostoAtual;

        return (
            <div className="space-y-8">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200">
                    <h2 className="text-xl font-bold text-blue-900 mb-2">Simulador de Impacto da Reforma Tributária</h2>
                    <p className="text-sm text-blue-700">Estimativa baseada no seu regime tributário ({regimeAtual}) e receita bruta de 2025. Valores são aproximações para planejamento.</p>
                </div>

                {/* Comparativo Visual */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Comparativo: Modelo Atual vs Novo Sistema</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-5 bg-blue-50 rounded-xl border border-blue-200 text-center">
                            <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">Modelo Atual (2026)</p>
                            <p className="text-4xl font-extrabold text-blue-700 mt-3">{formatPercentage(calculatedRate)}</p>
                            <p className="text-sm text-blue-600 mt-1">Alíquota efetiva</p>
                            <div className="mt-3 pt-3 border-t border-blue-200">
                                <p className="text-xs text-blue-500">Imposto estimado/ano</p>
                                <p className="text-lg font-bold text-blue-800">{formatCurrency(impostoAtual)}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-center">
                            <div className="text-center">
                                <div className={`text-3xl font-extrabold ${diferenca > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {diferenca > 0 ? '+' : ''}{formatCurrency(diferenca)}
                                </div>
                                <p className="text-sm text-gray-500 mt-1">Diferença estimada/ano</p>
                                <div className="mt-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${diferenca > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {diferenca > 0 ? 'Aumento' : 'Redução'} de {formatPercentage(Math.abs(diferenca / (impostoAtual || 1)) * 100)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 bg-orange-50 rounded-xl border border-orange-200 text-center">
                            <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">Novo Sistema (2027+)</p>
                            <p className="text-4xl font-extrabold text-orange-700 mt-3">{formatPercentage(cargaEfetivaEstimada)}</p>
                            <p className="text-sm text-orange-600 mt-1">Carga efetiva estimada</p>
                            <div className="mt-3 pt-3 border-t border-orange-200">
                                <p className="text-xs text-orange-500">Imposto estimado/ano</p>
                                <p className="text-lg font-bold text-orange-800">{formatCurrency(impostoFuturo)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Detalhamento */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Detalhamento da Estimativa</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="text-left p-3 font-bold text-gray-700">Item</th>
                                    <th className="text-right p-3 font-bold text-gray-700">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <tr><td className="p-3 text-gray-700">Receita Bruta Anual (base 2025)</td><td className="p-3 text-right font-bold">{formatCurrency(receitaBruta2025)}</td></tr>
                                <tr><td className="p-3 text-gray-700">Alíquota IVA Bruta Estimada (CBS + IBS)</td><td className="p-3 text-right font-bold text-orange-600">{formatPercentage(ivaEstimadoRegime)}</td></tr>
                                <tr><td className="p-3 text-gray-700">Créditos Tributários Estimados</td><td className="p-3 text-right font-bold text-green-600">-{formatPercentage(creditoEstimado)}</td></tr>
                                <tr className="bg-orange-50"><td className="p-3 font-bold text-gray-900">Carga Efetiva Estimada</td><td className="p-3 text-right font-extrabold text-orange-700">{formatPercentage(cargaEfetivaEstimada)}</td></tr>
                                <tr><td className="p-3 text-gray-700">Imposto Anual Estimado (novo sistema)</td><td className="p-3 text-right font-bold text-red-600">{formatCurrency(impostoFuturo)}</td></tr>
                                <tr><td className="p-3 text-gray-700">Imposto Anual Atual</td><td className="p-3 text-right font-bold text-blue-600">{formatCurrency(impostoAtual)}</td></tr>
                                <tr className={diferenca > 0 ? 'bg-red-50' : 'bg-green-50'}>
                                    <td className="p-3 font-bold text-gray-900">Diferença Anual</td>
                                    <td className={`p-3 text-right font-extrabold ${diferenca > 0 ? 'text-red-700' : 'text-green-700'}`}>{diferenca > 0 ? '+' : ''}{formatCurrency(diferenca)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Observação do Regime */}
                <div className="p-5 bg-yellow-50 rounded-2xl border border-yellow-200">
                    <h3 className="font-bold text-yellow-800 text-base mb-2">Análise para o seu regime: {regimeAtual}</h3>
                    <p className="text-sm text-yellow-700 leading-relaxed">{observacao}</p>
                </div>

                {/* Impacto no Fluxo de Caixa */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Impacto no Fluxo de Caixa (Split Payment)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center">
                            <p className="text-xs font-bold text-red-500 uppercase">Capital de Giro Retido/Mês</p>
                            <p className="text-2xl font-extrabold text-red-700 mt-2">{formatCurrency(impostoFuturo / 12)}</p>
                            <p className="text-xs text-red-500 mt-1">Que antes ficava no seu caixa</p>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-200 text-center">
                            <p className="text-xs font-bold text-orange-500 uppercase">Impacto Diário</p>
                            <p className="text-2xl font-extrabold text-orange-700 mt-2">{formatCurrency(impostoFuturo / 365)}</p>
                            <p className="text-xs text-orange-500 mt-1">Retido automaticamente por dia</p>
                        </div>
                        <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200 text-center">
                            <p className="text-xs font-bold text-yellow-600 uppercase">Necessidade Extra de Capital</p>
                            <p className="text-2xl font-extrabold text-yellow-700 mt-2">{formatCurrency(impostoFuturo / 12 * 1.5)}</p>
                            <p className="text-xs text-yellow-600 mt-1">Reserva recomendada (1,5x mensal)</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ===== TAB: ENGENHARIA CONTÁBIL =====
    const renderEngenhariaTab = () => (
        <div className="space-y-8">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-200">
                <h2 className="text-xl font-bold text-indigo-900 mb-2">Soluções de Engenharia Contábil</h2>
                <p className="text-sm text-indigo-700">Estratégias legítimas de planejamento tributário para minimizar o impacto da Reforma Tributária no seu negócio.</p>
            </div>

            {/* Estratégia 1: Revisão do Regime */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-sm">1</div>
                    <h3 className="text-lg font-bold text-gray-900">Revisão do Regime Tributário</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    Com a Reforma, a escolha do regime tributário ganha uma nova dimensão. Não basta mais olhar apenas o faturamento - é preciso analisar a <strong>cadeia de fornecedores</strong>, o <strong>tipo de cliente</strong> (B2B ou B2C) e a <strong>estrutura de custos</strong>.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="text-left p-3 font-bold text-gray-700">Regime</th>
                                <th className="text-left p-3 font-bold text-gray-700">Quando é melhor</th>
                                <th className="text-left p-3 font-bold text-gray-700">Risco com a Reforma</th>
                                <th className="text-left p-3 font-bold text-gray-700">Ação recomendada</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="p-3 font-bold text-gray-900">Simples Nacional</td>
                                <td className="p-3 text-gray-600">Faturamento até R$ 4,8M. Venda para consumidor final (B2C).</td>
                                <td className="p-3 text-red-600">Clientes B2B preferirão fornecedores que geram crédito integral de IBS/CBS.</td>
                                <td className="p-3 text-indigo-600 font-medium">Avaliar regime híbrido até setembro/2026. Se vende para empresas, pode ser hora de sair do Simples.</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-bold text-gray-900">Lucro Presumido</td>
                                <td className="p-3 text-gray-600">Margens altas e estáveis. Poucos insumos para creditar.</td>
                                <td className="p-3 text-red-600">Presunção subiu para 35,2%. CBS cheia em 2027 pode tornar mais caro que Lucro Real.</td>
                                <td className="p-3 text-indigo-600 font-medium">Simular comparativo com Lucro Real. Se tem muitos insumos, migre.</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-bold text-gray-900">Lucro Real</td>
                                <td className="p-3 text-gray-600">Margens baixas, muitos insumos, operação complexa.</td>
                                <td className="p-3 text-green-600">Maior beneficiado: créditos plenos sobre todos os insumos.</td>
                                <td className="p-3 text-indigo-600 font-medium">Mapear TODOS os fornecedores. Exigir notas com CBS/IBS destacados.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Estratégia 2: Maximização de Créditos */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-sm">2</div>
                    <h3 className="text-lg font-bold text-gray-900">Maximização de Créditos Tributários</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    A <strong>não-cumulatividade plena</strong> é a maior mudança da Reforma. Diferente do sistema atual (onde poucos itens geram crédito), no novo sistema <strong>TODOS os insumos</strong> utilizados na atividade econômica geram crédito de CBS e IBS.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                        <h4 className="font-bold text-green-800 text-sm mb-3">O que GERA crédito (novo sistema)</h4>
                        <ul className="space-y-2 text-sm text-green-700">
                            <li className="flex items-start gap-2"><span className="text-green-500">&#10003;</span> Matéria-prima e insumos de produção</li>
                            <li className="flex items-start gap-2"><span className="text-green-500">&#10003;</span> Aluguel do imóvel comercial</li>
                            <li className="flex items-start gap-2"><span className="text-green-500">&#10003;</span> Energia elétrica e água</li>
                            <li className="flex items-start gap-2"><span className="text-green-500">&#10003;</span> Serviços de TI e software</li>
                            <li className="flex items-start gap-2"><span className="text-green-500">&#10003;</span> Frete e logística</li>
                            <li className="flex items-start gap-2"><span className="text-green-500">&#10003;</span> Material de escritório e limpeza</li>
                            <li className="flex items-start gap-2"><span className="text-green-500">&#10003;</span> Máquinas e equipamentos (imobilizado)</li>
                            <li className="flex items-start gap-2"><span className="text-green-500">&#10003;</span> Serviços contábeis e jurídicos</li>
                        </ul>
                    </div>
                    <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                        <h4 className="font-bold text-red-800 text-sm mb-3">O que NÃO gera crédito</h4>
                        <ul className="space-y-2 text-sm text-red-700">
                            <li className="flex items-start gap-2"><span className="text-red-500">&#10007;</span> Folha de pagamento (salários)</li>
                            <li className="flex items-start gap-2"><span className="text-red-500">&#10007;</span> Compras de fornecedores do Simples (crédito parcial)</li>
                            <li className="flex items-start gap-2"><span className="text-red-500">&#10007;</span> Despesas pessoais do sócio</li>
                            <li className="flex items-start gap-2"><span className="text-red-500">&#10007;</span> Bens de uso pessoal</li>
                        </ul>
                        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                            <p className="text-xs text-yellow-800"><strong>Atenção empresas de serviços:</strong> Como a maior despesa é folha (que não gera crédito), o impacto será maior. Busque terceirizar serviços quando possível para gerar créditos.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Estratégia 3: Planejamento de Caixa */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-sm">3</div>
                    <h3 className="text-lg font-bold text-gray-900">Planejamento de Fluxo de Caixa para o Split Payment</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    O Split Payment vai mudar radicalmente a gestão de caixa. Prepare-se agora:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { titulo: 'Revise o Capital de Giro', desc: 'Calcule quanto do seu caixa atual depende do "float" dos impostos (prazo entre venda e pagamento da guia). Esse dinheiro não estará mais disponível.' },
                        { titulo: 'Negocie Prazos com Fornecedores', desc: 'Se o imposto sai na hora da venda, você precisa de mais prazo para pagar fornecedores ou reduzir prazos de recebimento de clientes.' },
                        { titulo: 'Crie Reserva de Emergência', desc: 'Recomendação: tenha pelo menos 1,5x o valor mensal de impostos como reserva de caixa para absorver o impacto da transição.' },
                        { titulo: 'Avalie Linhas de Crédito', desc: 'Empresas que dependiam do float podem precisar de capital de giro bancário. Negocie agora, antes da demanda aumentar em 2027.' },
                    ].map((item, i) => (
                        <div key={i} className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                            <h4 className="font-bold text-indigo-800 text-sm mb-2">{item.titulo}</h4>
                            <p className="text-sm text-indigo-700">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Estratégia 4: Reestruturação */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-sm">4</div>
                    <h3 className="text-lg font-bold text-gray-900">Reestruturação Societária e Operacional</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-gray-800 text-sm mb-2">Cisão de Atividades</h4>
                        <p className="text-sm text-gray-600">Se sua empresa tem atividades mistas (comércio + serviços), pode ser vantajoso separar em duas empresas. Comércio gera mais créditos; serviços podem ficar no Simples.</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-gray-800 text-sm mb-2">Holding Patrimonial</h4>
                        <p className="text-sm text-gray-600">O ITCMD (imposto sobre herança) ficou progressivo. Revise seu planejamento sucessório. Holdings podem proteger patrimônio e otimizar a transmissão.</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-gray-800 text-sm mb-2">Revisão de Precificação</h4>
                        <p className="text-sm text-gray-600">Com o imposto "por fora" e transparente na nota, revise seus preços. O consumidor verá exatamente quanto paga de imposto. Ajuste a comunicação de valor.</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-gray-800 text-sm mb-2">Tecnologia e Compliance</h4>
                        <p className="text-sm text-gray-600">Atualize seu ERP, revise NCMs, integre com a Calculadora do Fisco. Erros de classificação fiscal que antes passavam despercebidos agora travarão notas.</p>
                    </div>
                </div>
            </div>

            {/* Estratégia 5: Checklist */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-200">
                <h3 className="text-lg font-bold text-green-900 mb-4">Checklist de Preparação para a Reforma</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                        'Simular carga tributária nos 3 regimes (Simples, Presumido, Real)',
                        'Mapear todos os fornecedores e verificar regime tributário de cada um',
                        'Atualizar sistema de emissão de notas fiscais',
                        'Revisar cadastro de produtos (NCMs e classificação fiscal)',
                        'Calcular necessidade de capital de giro sem o float dos impostos',
                        'Negociar linhas de crédito preventivas com bancos',
                        'Revisar precificação considerando imposto transparente',
                        'Avaliar cisão de atividades se empresa é mista',
                        'Revisar planejamento sucessório (ITCMD progressivo)',
                        'Treinar equipe contábil e financeira nas novas regras',
                        'Avaliar regime híbrido do Simples (prazo: setembro/2026)',
                        'Criar reserva de caixa equivalente a 1,5x impostos mensais',
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-100">
                            <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-bold text-green-700">{i + 1}</span>
                            </div>
                            <p className="text-sm text-gray-700">{item}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Disclaimer */}
            <div className="p-4 bg-gray-100 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500 leading-relaxed">
                    <strong>Aviso importante:</strong> As informações acima são de caráter educativo e baseadas na legislação vigente (EC 132/2023, LC 214/2025, LC 224/2025, PLP 108/24). As alíquotas definitivas do IBS ainda serão definidas por resolução do Senado. Consulte sempre um contador ou advogado tributarista para decisões específicas do seu negócio. Fontes: Receita Federal, TaxGroup, ContaAzul, Jota, FecomercioSP.
                </p>
            </div>
        </div>
    );

    const renderSugestaoTab = () => (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-brand-orange/10 rounded-xl flex items-center justify-center">
                        <span className="text-xl" dangerouslySetInnerHTML={{ __html: '&#129302;' }} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Sugestão Tributária Personalizada</h2>
                        <p className="text-sm text-gray-500">Análise com IA baseada nos dados do seu CNPJ</p>
                    </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    Com base nos dados do seu <strong>CNPJ</strong> (CNAE, porte, localização), no <strong>regime tributário</strong> configurado e na <strong>receita bruta</strong> de 2025, a IA vai analisar:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-xs font-bold text-gray-700">Diagnóstico do Regime</p>
                        <p className="text-xs text-gray-500">O regime atual é o melhor para você?</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-xs font-bold text-gray-700">Impacto da Reforma</p>
                        <p className="text-xs text-gray-500">Como a reforma afeta seu CNAE</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-xs font-bold text-gray-700">Simples Híbrido</p>
                        <p className="text-xs text-gray-500">Vale a pena aderir?</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-xs font-bold text-gray-700">Oportunidades</p>
                        <p className="text-xs text-gray-500">Créditos e benefícios disponíveis</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-xs font-bold text-gray-700">Plano de Ação</p>
                        <p className="text-xs text-gray-500">Cronograma 2026-2027</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-xs font-bold text-gray-700">Alertas</p>
                        <p className="text-xs text-gray-500">Riscos específicos do seu setor</p>
                    </div>
                </div>

                {/* Dados usados na análise */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                    <p className="text-xs font-bold text-gray-600 uppercase mb-2">Dados que serão usados na análise:</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <p className="text-xs text-gray-500">CNPJ</p>
                            <p className="text-sm font-semibold text-gray-800">{planData.companyProfile?.cnpj || 'Não configurado'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Regime Tributário</p>
                            <p className="text-sm font-semibold text-gray-800">{taxes.regimeTributario || 'Não informado'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Receita Bruta 2025</p>
                            <p className="text-sm font-semibold text-gray-800">{formatCurrency(receitaBruta2025)}</p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleGetTaxRecommendation}
                    disabled={isLoadingRecommendation || !planData.companyProfile?.cnpj}
                    className="w-full py-3 bg-brand-orange text-white font-bold rounded-xl hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isLoadingRecommendation ? (
                        <><span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span> Analisando com IA (pode levar até 30s)...</>
                    ) : (
                        <><span dangerouslySetInnerHTML={{ __html: '&#129302;' }} /> Gerar Sugestão Tributária Personalizada</>
                    )}
                </button>

                {!planData.companyProfile?.cnpj && (
                    <p className="text-xs text-red-500 mt-2 text-center">Configure o CNPJ da empresa em Configurações antes de gerar a sugestão.</p>
                )}
            </div>

            {/* Erro */}
            {recommendationError && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                    <p className="text-sm text-red-700 font-medium">{recommendationError}</p>
                </div>
            )}

            {/* Resultado */}
            {taxRecommendation && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">Análise Tributária Personalizada</h3>
                        <button
                            onClick={() => {
                                const blob = new Blob([taxRecommendation], { type: 'text/markdown' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'analise-tributaria.md';
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            className="text-sm text-brand-orange font-semibold hover:text-orange-700"
                        >
                            Baixar Relatório
                        </button>
                    </div>
                    <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-li:text-gray-700 prose-a:text-brand-orange">
                        <ReactMarkdown>{taxRecommendation}</ReactMarkdown>
                    </div>
                </div>
            )}

            {/* Disclaimer */}
            <div className="p-4 bg-gray-100 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500 leading-relaxed">
                    <strong>Aviso importante:</strong> Esta análise é gerada por inteligência artificial com base em dados públicos e legislação vigente. Não substitui a consultoria de um contador ou advogado tributarista. Sempre valide as recomendações com seu profissional de confiança antes de tomar decisões.
                </p>
            </div>
        </div>
    );

    const tabs: { id: TaxTab; label: string; icon: string }[] = [
        { id: 'config', label: 'Configuração', icon: '&#9881;' },
        { id: 'cenario', label: 'Cenário Tributário', icon: '&#128200;' },
        { id: 'simulador', label: 'Simulador de Impacto', icon: '&#9889;' },
        { id: 'engenharia', label: 'Engenharia Contábil', icon: '&#128736;' },
        { id: 'sugestao', label: 'Sugestão para seu Negócio', icon: '&#129302;' },
    ];

    return (
        <div className="space-y-8">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gradient-border">
                <h1 className="text-4xl font-bold text-gray-900">2. Configuração de Impostos</h1>
                <p className="text-lg text-gray-600 mt-2">
                    Configure seus impostos, entenda o cenário da Reforma Tributária e prepare sua empresa para as mudanças de 2027.
                </p>
            </header>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-brand-orange text-white shadow-md'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <span dangerouslySetInnerHTML={{ __html: tab.icon }} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'config' && renderConfigTab()}
            {activeTab === 'cenario' && renderCenarioTab()}
            {activeTab === 'simulador' && renderSimuladorTab()}
            {activeTab === 'engenharia' && renderEngenhariaTab()}
            {activeTab === 'sugestao' && renderSugestaoTab()}
        </div>
    );
};

export default Taxes;
