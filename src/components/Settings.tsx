
import React, { useState } from 'react';
import { usePlan } from '../hooks/usePlanData';
import { CompanyProfile } from '../types';
import { getIndustryFromCnpj, getMarketResearchFromCnpj, CnpjData } from '../services/geminiService';
import { markdownSeguro } from '../utils/markdownSeguro';

const Settings: React.FC = () => {
    const { planData, updateCompanyProfile, updateMarketCompetitionData, saveDataNow, resetAllData } = usePlan();
    const [isSearching, setIsSearching] = useState(false);
    const [isResearching, setIsResearching] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);
    const [marketAnalysis, setMarketAnalysis] = useState<string>('');
    const [researchError, setResearchError] = useState<string>('');
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetConfirmText, setResetConfirmText] = useState('');
    const [isResetting, setIsResetting] = useState(false);
    const RESET_CONFIRMATION_WORD = 'APAGAR TUDO';
    
    const handleSaveKey = async () => {
        const key = planData.companyProfile.geminiApiKey?.trim() || '';
        if (key) {
            localStorage.setItem('google_gemini_api_key', key);
            updateCompanyProfile('geminiApiKey', key);
            try {
                await saveDataNow();
                setSaveMessage('Chave salva com sucesso no seu perfil!');
            } catch {
                setSaveMessage('Chave salva localmente. Sera sincronizada automaticamente.');
            }
            setTimeout(() => setSaveMessage(''), 4000);
        } else {
            localStorage.removeItem('google_gemini_api_key');
            updateCompanyProfile('geminiApiKey', '');
            setSaveMessage('Chave removida.');
            setTimeout(() => setSaveMessage(''), 3000);
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        updateCompanyProfile(name as keyof CompanyProfile, value);
    };

    const handleCnpjSearch = async () => {
        if (!planData.companyProfile.cnpj) return;
        setIsSearching(true);
        setCnpjData(null);
        setMarketAnalysis('');
        setResearchError('');
        try {
            const industry = await getIndustryFromCnpj(planData.companyProfile.cnpj);
            updateCompanyProfile('industry', industry.trim());
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : 'Nao foi possivel pesquisar o CNPJ.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleMarketResearch = async () => {
        if (!planData.companyProfile.cnpj) return;
        setIsResearching(true);
        setResearchError('');
        setMarketAnalysis('');
        setCnpjData(null);
        try {
            const result = await getMarketResearchFromCnpj(planData.companyProfile.cnpj);
            setCnpjData(result.cnpjData);
            setMarketAnalysis(result.marketAnalysis);
            
            // Auto-preencher dados estratégicos
            if (result.cnpjData.nomeFantasia && !planData.companyProfile.name) {
                updateCompanyProfile('name', result.cnpjData.nomeFantasia);
            }
            if (result.cnpjData.cnaeDescricao) {
                updateCompanyProfile('industry', result.cnpjData.cnaeDescricao);
            }
        } catch (error) {
            console.error(error);
            setResearchError(error instanceof Error ? error.message : 'Erro ao pesquisar mercado.');
        } finally {
            setIsResearching(false);
        }
    };

    const formatCnpjDataValue = (value: string | number | undefined) => {
        if (value === undefined || value === null || value === '') return '-';
        if (typeof value === 'number') return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        return value;
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <header className="text-center">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Configurações</h1>
                <p className="text-gray-500 mt-2">
                    Gerencie os dados da sua empresa e as integracoes do sistema.
                </p>
            </header>
            
            {/* GEMINI AI CONFIG SECTION */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Configuração de IA (Google Gemini)</h2>
                
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-sm text-blue-800">
                    <p>Para utilizar as analises inteligentes e sugestoes de metas, você precisa de uma <strong>Chave de API do Google</strong>. </p>
                    <p className="mt-2">
                        1. Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="font-bold underline">Google AI Studio</a>.<br/>
                        2. Clique em "Create API Key".<br/>
                        3. Copie e cole a chave abaixo.
                    </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-sm text-green-800">
                    <p><strong>A chave e salva no seu perfil (Firebase).</strong> Você pode acessar de qualquer dispositivo sem precisar configurar novamente.</p>
                </div>

                <div>
                    <label htmlFor="geminiApiKey" className="block text-sm font-medium text-gray-700">Sua Chave de API (Gemini API Key)</label>
                    <div className="mt-1 flex flex-col gap-2">
                        <div className="flex gap-2 items-center">
                            <div className="relative flex-grow">
                                <input
                                    type={showKey ? "text" : "password"}
                                    name="geminiApiKey"
                                    id="geminiApiKey"
                                    value={planData.companyProfile.geminiApiKey || ''}
                                    onChange={(e) => { updateCompanyProfile('geminiApiKey', e.target.value); setSaveMessage(''); }}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm p-3 pr-10 bg-white text-gray-900"
                                    placeholder="Cole sua chave aqui (AIzaSy...)"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    {showKey ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.742L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" /></svg>
                                    )}
                                </button>
                            </div>
                            <button
                                onClick={handleSaveKey}
                                className="flex-shrink-0 px-4 py-2 h-11 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm transition-colors"
                            >
                                Salvar Chave
                            </button>
                        </div>
                        {saveMessage && <p className="text-sm font-medium text-green-600 animate-fadeIn">{saveMessage}</p>}
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Informações da Empresa</h2>
                
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome da Empresa</label>
                    <input
                        type="text"
                        name="name"
                        id="name"
                        value={planData.companyProfile.name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm p-3 bg-white text-gray-900"
                        placeholder="Sua Empresa Ltda."
                    />
                </div>
                
                <div>
                    <label htmlFor="cnpj" className="block text-sm font-medium text-gray-700">CNPJ</label>
                    <div className="mt-1 flex gap-2 items-center">
                        <input
                            type="text"
                            name="cnpj"
                            id="cnpj"
                            value={planData.companyProfile.cnpj}
                            onChange={handleInputChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm p-3 bg-white text-gray-900"
                            placeholder="00.000.000/0001-00"
                            disabled={isSearching || isResearching}
                        />
                         <button
                            onClick={handleCnpjSearch}
                            disabled={isSearching || isResearching || !planData.companyProfile.cnpj}
                            className="flex-shrink-0 px-4 py-2 h-11 text-sm font-semibold text-white bg-brand-orange rounded-xl hover:bg-orange-700 transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isSearching ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                'Buscar CNAE'
                            )}
                        </button>
                    </div>
                </div>
                
                <div>
                    <label htmlFor="industry" className="block text-sm font-medium text-gray-700">Ramo de Atividade</label>
                    <input
                        type="text"
                        name="industry"
                        id="industry"
                        value={planData.companyProfile.industry}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm p-3 bg-white text-gray-900"
                        placeholder="Ex: Tecnologia, Varejo, Servicos Financeiros"
                    />
                     <p className="mt-2 text-xs text-gray-500">
                        Seja especifico. Isso ajuda a IA a fornecer insights mais relevantes sobre o seu setor.
                    </p>
                </div>
            </div>

            {/* MARKET RESEARCH SECTION */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <div className="flex items-center justify-between border-b pb-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Pesquisa de Mercado por CNPJ</h2>
                        <p className="text-sm text-gray-500 mt-1">Análise automática do mercado regional usando dados oficiais + IA</p>
                    </div>
                    <button
                        onClick={handleMarketResearch}
                        disabled={isResearching || !planData.companyProfile.cnpj || !planData.companyProfile.geminiApiKey}
                        className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {isResearching ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Pesquisando...
                            </>
                        ) : (
                            <>
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                Pesquisar Mercado
                            </>
                        )}
                    </button>
                </div>

                {!planData.companyProfile.geminiApiKey && (
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800">
                        <strong>Atencao:</strong> Configure sua chave de API do Gemini acima para usar a pesquisa de mercado.
                    </div>
                )}

                {!planData.companyProfile.cnpj && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-600">
                        Preencha o CNPJ da empresa acima para habilitar a pesquisa de mercado.
                    </div>
                )}

                {researchError && (
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-sm text-red-700">
                        <strong>Erro:</strong> {researchError}
                    </div>
                )}

                {isResearching && (
                    <div className="text-center py-12">
                        <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <p className="text-gray-600 font-medium">Consultando Receita Federal e analisando mercado...</p>
                        <p className="text-gray-400 text-sm mt-1">Isso pode levar de 15 a 30 segundos</p>
                    </div>
                )}

                {cnpjData && !isResearching && (
                    <div className="space-y-6">
                        {/* CNPJ Data Card */}
                        <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-6 rounded-xl border border-blue-100">
                            <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                Dados Oficiais (Receita Federal)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[
                                    { label: 'Razao Social', value: cnpjData.razaoSocial },
                                    { label: 'Nome Fantasia', value: cnpjData.nomeFantasia },
                                    { label: 'CNAE', value: `${cnpjData.cnaeCodigo} - ${cnpjData.cnaeDescricao}` },
                                    { label: 'Porte', value: cnpjData.porte },
                                    { label: 'Natureza Juridica', value: cnpjData.naturezaJuridica },
                                    { label: 'Municipio/UF', value: `${cnpjData.municipio}/${cnpjData.uf}` },
                                    { label: 'Capital Social', value: formatCnpjDataValue(cnpjData.capitalSocial) },
                                    { label: 'Data de Abertura', value: cnpjData.dataAbertura },
                                    { label: 'Situação', value: cnpjData.situacao },
                                ].map((item, i) => (
                                    <div key={i} className="bg-white/70 p-3 rounded-lg">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{item.label}</span>
                                        <p className="text-sm font-medium text-gray-800 mt-0.5">{item.value || '-'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Market Analysis */}
                        {marketAnalysis && (
                            <div className="bg-white p-6 rounded-xl border border-gray-200">
                                <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    Analise de Mercado Regional
                                </h3>
                                <div 
                                    className="prose prose-sm max-w-none text-gray-700 
                                        prose-headings:text-gray-900 prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
                                        prose-strong:text-gray-900
                                        prose-ul:my-2 prose-li:my-0.5
                                        prose-p:my-2"
                                    dangerouslySetInnerHTML={{ __html: markdownSeguro(marketAnalysis, 'analise') }}
                                />
                                <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                                    <p className="text-xs text-amber-700">
                                        <strong>Nota:</strong> Esta analise foi gerada por IA com base em dados publicos e pesquisa na internet. 
                                        Os dados sao estimativas e devem ser validados com pesquisas de mercado especificas do seu setor.
                                        Use como ponto de partida para preencher a Analise Estrategica do seu plano.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!cnpjData && !isResearching && !researchError && planData.companyProfile.cnpj && planData.companyProfile.geminiApiKey && (
                    <div className="text-center py-8 text-gray-400">
                        <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <p className="text-sm">Clique em <strong>"Pesquisar Mercado"</strong> para gerar uma análise completa do seu setor e região.</p>
                    </div>
                )}
            </div>

            {/* ZONA DE PERIGO */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-red-200 space-y-6">
                <h2 className="text-lg font-bold text-red-700 border-b border-red-200 pb-3 flex items-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    Zona de Perigo
                </h2>
                
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800">
                        <strong>Atenção:</strong> A ação abaixo irá apagar permanentemente todos os dados do seu planejamento, incluindo dados financeiros, metas, cenários, plano de ação e todas as configurações. Esta ação <strong>não pode ser desfeita</strong>.
                    </p>
                </div>

                <button
                    onClick={() => { setShowResetModal(true); setResetConfirmText(''); }}
                    className="px-6 py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm flex items-center gap-2"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Limpar Todos os Dados
                </button>
            </div>

            {/* MODAL DE CONFIRMAÇÃO */}
            {showResetModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-6">
                        <div className="text-center">
                            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Tem certeza absoluta?</h3>
                            <p className="text-sm text-gray-600 mt-2">
                                Todos os seus dados serão apagados permanentemente. Isso inclui dados financeiros, metas, OKRs, cenários, plano de ação, precificação e todas as análises geradas.
                            </p>
                        </div>

                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <p className="text-sm text-red-800 font-medium text-center">
                                Para confirmar, digite <strong className="text-red-900 bg-red-200 px-2 py-0.5 rounded">{RESET_CONFIRMATION_WORD}</strong> no campo abaixo:
                            </p>
                        </div>

                        <input
                            type="text"
                            value={resetConfirmText}
                            onChange={(e) => setResetConfirmText(e.target.value)}
                            placeholder={`Digite: ${RESET_CONFIRMATION_WORD}`}
                            className="block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-center text-lg font-bold p-3 bg-white text-gray-900 tracking-wider"
                            autoFocus
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowResetModal(false); setResetConfirmText(''); }}
                                className="flex-1 px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                disabled={isResetting}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    if (resetConfirmText !== RESET_CONFIRMATION_WORD) return;
                                    setIsResetting(true);
                                    try {
                                        await resetAllData();
                                        setShowResetModal(false);
                                        setResetConfirmText('');
                                    } catch (error) {
                                        console.error('Erro ao limpar dados:', error);
                                        alert('Erro ao limpar dados. Tente novamente.');
                                    } finally {
                                        setIsResetting(false);
                                    }
                                }}
                                disabled={resetConfirmText !== RESET_CONFIRMATION_WORD || isResetting}
                                className="flex-1 px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isResetting ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Apagando...
                                    </>
                                ) : (
                                    'Apagar Todos os Dados'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
