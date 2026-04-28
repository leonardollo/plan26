
import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import * as api from '../services/geminiService';
import {
    PlanData, Goals2026, Scenarios2026, Tracking2026, TaxesData, Summary2025,
    PlanContextType, User, ScenarioName, Month, MONTHS,
    CommercialData2025, PeopleData2025, MarketingData2025, InvestmentData2025,
    SubscriptionStatus, CompanyProfile, FinancialSheetData, OkrsAndKpis, CommercialPlanning2026,
    FinancialPlan2026, ProductPortfolioItem, MarketCompetitionData, SWOTData, BlueOceanData, BowmanClockProduct,
    ActionPlanItem, ScenarioData, DriverBasedPlanningData, MonthlyData, DRE2026, DFC2026, BP2026,
    LiquidityMetrics, FinancialKPIs, SensitivityMatrix, SaveStatus, PricingItem, FinancialSheetRow, CustomLineItem,
    BlueOceanFactor, BlueOceanFourActions, ScenarioProjectionData, StrategicObjectives, CustomProjectionLineItem
} from '../types';

// Firebase configuration - loaded from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB5fB2J-D431lc4m3NrTDDVEpTtvd_U_1A",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "plan-ea4cc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "plan-ea4cc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "plan-ea4cc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1007485589925",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1007485589925:web:9514ab68c669cf5a52b04c"
};
const isConfigValid = firebaseConfig.apiKey && firebaseConfig.apiKey !== "COLE_SUA_API_KEY_AQUI";
const isOfflineMode = !isConfigValid;

let app: any;
let auth: any;
let db: any;

if (!isOfflineMode) {
    try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("✅ Firebase Conectado!");
    } catch (e) {
        console.error("Erro ao conectar no Firebase. Verifique suas chaves.", e);
    }
} else {
    console.log("ℹ️ Modo Local Ativado: Preencha o `firebaseConfig` no topo do arquivo `hooks/usePlanData.tsx` para salvar na nuvem.");
}

export const authService = {
    login: async (email: string, password: string) => {
        if (!isOfflineMode && auth) return signInWithEmailAndPassword(auth, email, password);
        const storedUserJSON = localStorage.getItem('local_user');
        if (storedUserJSON) {
            const user = JSON.parse(storedUserJSON);
            if (user.email === email) {
                localStorage.setItem('local_session_active', 'true');
                return { user };
            }
        }
        const demoUser = { uid: 'local-user-123', email, displayName: 'Usuário Local' };
        localStorage.setItem('local_user', JSON.stringify(demoUser));
        localStorage.setItem('local_session_active', 'true');
        return { user: demoUser };
    },
    signup: async (email: string, password: string, name: string) => {
        if (!isOfflineMode && auth) {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            if (result.user) {
                await updateProfile(result.user, { displayName: name });
            }
            return result;
        }
        const user = { uid: 'local-user-' + Date.now(), email, displayName: name };
        localStorage.setItem('local_user', JSON.stringify(user));
        localStorage.setItem('local_session_active', 'true');
        return { user };
    },
    logout: async () => {
        if (!isOfflineMode && auth) return signOut(auth);
        localStorage.removeItem('local_session_active');
    },
    loginWithGoogle: async () => {
        if (!isOfflineMode && auth) {
            const provider = new GoogleAuthProvider();
            return signInWithPopup(auth, provider);
        }
        throw new Error("Login com Google indisponível no Modo Local. Configure o Firebase no código.");
    },
    resetPassword: async (email: string) => {
        if (!isOfflineMode && auth) return sendPasswordResetEmail(auth, email);
        alert(`[MODO LOCAL] Simulação: Um link de redefinição foi enviado para ${email}`);
    },
    subscribe: (callback: (user: any) => void) => {
        if (!isOfflineMode && auth) return onAuthStateChanged(auth, callback);
        const isActive = localStorage.getItem('local_session_active') === 'true';
        const storedUserJSON = localStorage.getItem('local_user');
        if (isActive && storedUserJSON) {
            callback(JSON.parse(storedUserJSON));
        } else {
            callback(null);
        }
        return () => {}; 
    }
};

const initialCompanyProfile: CompanyProfile = { name: '', cnpj: '', industry: '', geminiApiKey: '' };
const initialFinancialSheet: FinancialSheetData = {
    receitaBruta: { values2025: {} },
    impostosSobreFaturamento: { values2025: {} },
    folhaPagamento: { values2025: {} },
    aluguel: { values2025: {} },
    despesasOperacionais: { values2025: {} },
    marketingFixo: { values2025: {} },
    administrativo: { values2025: {} },
    customCustosFixos: [],
    cmv: { values2025: {} },
    comissoes: { values2025: {} },
    fretes: { values2025: {} },
    customCustosVariaveis: []
};
const initialCommercial: CommercialData2025 = {
    clientes: { totalClientesAtivos: {}, novosClientes: {}, clientesPerdidos: {} },
    funilComercial: { leadsGerados: {}, leadsQualificados: {}, propostasEnviadas: {}, vendasFechadas: {} },
    pipeline: { pipelineAtual: {}, ticketMedioPipeline: {}, cicloVendas: {} }
};
const initialPeople: PeopleData2025 = {
    headcount: { totalColaboradores: {}, contratacoes: {}, desligamentosVoluntarios: {}, desligamentosInvoluntarios: {} },
    custos: { folhaTotalAnual: {} },
    treinamento: { investimentoTD: {}, horasTreinamento: {}, ganhoTreinamento: {} },
    clima: { taxaAbsenteismo: {}, eNPS: {} }
};
const initialMarketing: MarketingData2025 = {
    investimentos: { investimentoTotal: {}, midiaPaga: {}, conteudo: {} },
    performance: { impressoes: {}, cliques: {}, conversoes: {} }
};
const initialInvestment: InvestmentData2025 = {
    capex: { maquinasEquipamentos: 0, software: 0, pesquisaDesenvolvimento: 0, totalCapex: 0 },
    workingCapital: { prazoMedioRecebimento: 0, prazoMedioEstocagem: 0, prazoMedioPagamento: 0, cicloFinanceiro: 0 },
    financing: { financiamentoCurtoPrazo: 0, financiamentoLongoPrazo: 0, aporteCapital: 0, saldoCaixaFinal2025: 0 }
};
const initialAnalysis = {
    benchmarkAnalysis: '',
    strategicSummary: '',
    diagnosisReportAnalysis: null,
    planReportAnalysis: null,
    marketingFunnelAnalysis: '',
    strategicScore: { total: 0, components: [] },
    peopleAnalytics: { productivityGainFactor: 0, projectedRevenue: 0 }
};
const defaultBlueOceanFactors = [
    { id: 'price', name: 'Preço', yourCompanyScore: 3, competitorScore: 3 },
    { id: 'quality', name: 'Qualidade do Produto', yourCompanyScore: 3, competitorScore: 3 },
    { id: 'support', name: 'Atendimento/Suporte', yourCompanyScore: 3, competitorScore: 3 },
    { id: 'tech', name: 'Inovação/Tecnologia', yourCompanyScore: 3, competitorScore: 3 },
    { id: 'speed', name: 'Rapidez de Entrega', yourCompanyScore: 3, competitorScore: 3 },
];
const initialPlanData: PlanData = {
    companyProfile: initialCompanyProfile,
    financialSheet: initialFinancialSheet,
    commercial: initialCommercial,
    people: initialPeople,
    marketing: initialMarketing,
    investment: initialInvestment,
    productPortfolio: [],
    marketAnalysis: {
        marketCompetition: { tamanhoMercado: 0, taxaCrescimentoMercado: 0, suaParticipacao: 0, numConcorrentesDiretos: 0, principalConcorrente: '', seuDiferencial: '' },
        swot: { strengths: '', strengthsImpact: 1, weaknesses: '', weaknessesImpact: 1, opportunities: '', opportunitiesImpact: 1, threats: '', threatsImpact: 1 },
        blueOcean: { 
            factors: defaultBlueOceanFactors, 
            fourActions: { eliminate: '', reduce: '', raise: '', create: '' } 
        },
        bowmanClockProducts: []
    },
    okrsAndKpis: { okrs: [], kpis: { financeiro: [], comercial: [], pessoas: [], operacoes: [] } },
    commercialPlanning: {
        demandPlanning: { channels: [], analysis: '' },
        salesFunnel: { workingDays: 252, conversionRateLeadToMql: 0, conversionRateMqlToSql: 0, conversionRateSqlToSale: 0, activitiesPerRep: 0, avgTicket: 0, rampUpTime: 0 },
        funnelSuggestions: '',
        driverBasedPlanning: { leadsQualificados: {}, taxaConversao: {}, clientesRecorrentes: {}, ticketMedio: {} }
    },
    hiringProjection: [],
    actionPlan: [],
    financialPlan2026: { dre: {} as any, dfc: {} as any, bp: {} as any },
    scenarioRelatedData: {
        'Otimista': { decisionTriggers: '', strategicActions: '', scenarioAnalysis: '' },
        'Conservador': { decisionTriggers: '', strategicActions: '', scenarioAnalysis: '' },
        'Disruptivo': { decisionTriggers: '', strategicActions: '', scenarioAnalysis: '' }
    },
    scenariosInputMode: { 'Otimista': 'percentage', 'Conservador': 'percentage', 'Disruptivo': 'percentage' },
    analysis: initialAnalysis
};
const initialGoals: Goals2026 = {
    inflacaoPrevista: 4.5,
    financeiras: { metaReceita: {}, metaMargemEbitda: 0, metaLucroLiquido: 0 },
    comerciais: { metaNumClientes: {}, metaTicketMedio: 0, metaTaxaConversao: 0 },
    pessoas: { metaHeadcount: 0, metaTurnover: 0, metaInvestimentoTD: 0, metaRoiTreinamento: 0, metaAbsenteismo: 0 },
    objetivosEstrategicos: { objective1: '', objective2: '', objective3: '' }
};
const initialScenarioData: ScenarioData = {
    growthPercentage: 0,
    projection: {
        receitaBruta: {}, impostosSobreFaturamento: {}, folhaPagamento: {}, aluguel: {}, despesasOperacionais: {},
        marketingFixo: {}, administrativo: {}, customCustosFixos: [], cmv: {}, comissoes: {}, fretes: {}, customCustosVariaveis: []
    },
    receitaProjetada: {}, custosProjetados: {}, despesasProjetadas: {}
};
const initialScenarios: Scenarios2026 = {
    'Otimista': { ...initialScenarioData, growthPercentage: 20 },
    'Conservador': { ...initialScenarioData, growthPercentage: 10 },
    'Disruptivo': { ...initialScenarioData, growthPercentage: -5 }
};

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export const usePlan = () => {
    const context = useContext(PlanContext);
    if (!context) {
        throw new Error('usePlan must be used within a PlanProvider');
    }
    return context;
};

export const PlanProvider: React.FC<{ children: React.ReactNode, user: User }> = ({ children, user }) => {
    const [planData, setPlanData] = useState<PlanData>(initialPlanData);
    const [goals2026, setGoals2026] = useState<Goals2026>(initialGoals);
    const [scenarios2026, setScenarios2026] = useState<Scenarios2026>(initialScenarios);
    const [tracking2026, setTracking2026] = useState<Tracking2026>({});
    const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
    const [taxes, setTaxes] = useState<TaxesData>({
        regimeTributario: 'Simples Nacional', anexoSimples: '', aliquotaEfetiva: 0, simplesNacional: 0,
        iss: 0, icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, inssPatronal: 0, fgts: 0, ratTerceiros: 0,
        totalEncargosFolha: 0, totalImpostos2024: 0, totalImpostos2025: 0
    });
    const [baseScenario, setBaseScenario] = useState<ScenarioName>('Conservador');
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('loading');
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const isInitialLoad = useRef(true);

    const saveToFirebase = useCallback(async (manual: boolean = false) => {
        if (!user.uid) return Promise.resolve();
        setSaveStatus('saving');
        try {
            if (!isOfflineMode && db) {
                const docRef = doc(db, 'users', user.uid);
                await setDoc(docRef, { planData, goals2026, scenarios2026, tracking2026, taxes, pricingItems }, { merge: true });
            } else {
                localStorage.setItem(`plan_data_${user.uid}`, JSON.stringify({ planData, goals2026, scenarios2026, tracking2026, taxes, pricingItems }));
            }
            setSaveStatus('saved');
            setLastSaved(new Date());
            if (!manual) {
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
            return Promise.resolve();
        } catch (error) {
            console.error("Error saving data:", error);
            setSaveStatus('error');
            return Promise.reject(error);
        }
    }, [planData, goals2026, scenarios2026, tracking2026, taxes, pricingItems, user.uid]);

    useEffect(() => {
        if (!user.uid) return;
        const loadData = async () => {
            try {
                let data: any = null;
                if (!isOfflineMode && db) {
                    const docRef = doc(db, 'users', user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        data = docSnap.data();
                    }
                } else {
                    const stored = localStorage.getItem(`plan_data_${user.uid}`);
                    if (stored) data = JSON.parse(stored);
                }
                if (data) {
                    if (data.planData) {
                        const loadedFactors = data.planData.marketAnalysis?.blueOcean?.factors;
                        const validFactors = (loadedFactors && loadedFactors.length > 0) ? loadedFactors : defaultBlueOceanFactors;
                        setPlanData(prev => ({
                            ...prev,
                            ...data.planData,
                            marketAnalysis: {
                                ...prev.marketAnalysis,
                                ...data.planData.marketAnalysis,
                                blueOcean: {
                                    ...prev.marketAnalysis.blueOcean,
                                    ...data.planData.marketAnalysis?.blueOcean,
                                    factors: validFactors
                                }
                            }
                        }));
                    }
                    // Sync geminiApiKey do Firebase para localStorage
                    if (data.planData?.companyProfile?.geminiApiKey) {
                        localStorage.setItem('google_gemini_api_key', data.planData.companyProfile.geminiApiKey);
                    }
                    if (data.goals2026) setGoals2026(prev => ({ ...prev, ...data.goals2026 }));
                    if (data.scenarios2026) setScenarios2026(prev => ({ ...prev, ...data.scenarios2026 }));
                    if (data.tracking2026) setTracking2026(prev => ({ ...prev, ...data.tracking2026 }));
                    if (data.taxes) setTaxes(prev => ({ ...prev, ...data.taxes }));
                    if (data.pricingItems) setPricingItems(data.pricingItems);
                }
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setTimeout(() => { isInitialLoad.current = false; }, 1000);
            }
        };
        loadData();
        checkSubscription();
    }, [user.uid]);

    useEffect(() => {
        if (!user.uid || isInitialLoad.current) return;
        setSaveStatus('unsaved');
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (saveStatus === 'unsaved' || saveStatus === 'saving') {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        const saveDataTimeout = setTimeout(() => {
            saveToFirebase();
        }, 3000); 
        return () => {
            clearTimeout(saveDataTimeout);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [planData, goals2026, scenarios2026, tracking2026, taxes, pricingItems, user.uid, saveToFirebase]);

    const checkSubscription = async () => {
        setSubscriptionStatus('active');
        return;
    };

    useEffect(() => {
        const { swot, blueOcean, marketCompetition, bowmanClockProducts } = planData.marketAnalysis;
        const products = planData.productPortfolio;
        
        const swotRaw = (swot.strengthsImpact || 0) - (swot.weaknessesImpact || 0) + (swot.opportunitiesImpact || 0) - (swot.threatsImpact || 0);
        const swotImpact = swotRaw * 1.5;

        let blueOceanRaw = 0;
        if (blueOcean.factors.length > 0) {
            const totalDiff = blueOcean.factors.reduce((acc, f) => acc + ((f.yourCompanyScore || 0) - (f.competitorScore || 0)), 0);
            blueOceanRaw = totalDiff / blueOcean.factors.length;
        }
        const blueOceanImpact = blueOceanRaw * 1.2;

        const growth = marketCompetition.taxaCrescimentoMercado || 0;
        const marketRaw = growth > 10 ? 2 : (growth > 5 ? 1 : (growth > 0 ? 0.5 : -1));
        const marketImpact = marketRaw * 1.5; 

        let abcRaw = 0;
        const totalRev = products.reduce((s, p) => s + (p.revenue2025 || 0), 0);
        if (totalRev > 0) {
            const sorted = [...products].sort((a,b) => (b.revenue2025||0) - (a.revenue2025||0));
            const top1Rev = sorted[0]?.revenue2025 || 0;
            const concentration = top1Rev / totalRev;
            abcRaw = concentration > 0.5 ? -2 : (concentration > 0.3 ? -0.5 : 1); 
        }
        const abcImpact = abcRaw;

        // Bowman: considera a relação valor/preço (não apenas valor)
        // Valor alto + Preço baixo = excelente posição (diferenciação)
        // Valor baixo + Preço alto = péssima posição (destinado ao fracasso)
        let clockRaw = 0;
        if (bowmanClockProducts.length > 0) {
            const avgVal = bowmanClockProducts.reduce((s, p) => s + (p.perceivedValue || 0), 0) / bowmanClockProducts.length;
            const avgPrice = bowmanClockProducts.reduce((s, p) => s + (p.priceLevel || 0), 0) / bowmanClockProducts.length;
            const relacao = avgVal - avgPrice; // Positivo = valor > preço (bom)
            if (relacao >= 2) clockRaw = 2;       // Valor muito acima do preço
            else if (relacao >= 1) clockRaw = 1.5; // Valor acima do preço
            else if (relacao >= 0) clockRaw = 0.5; // Valor = preço (híbrido)
            else if (relacao >= -1) clockRaw = -0.5; // Preço acima do valor
            else clockRaw = -2;                    // Preço muito acima do valor
        }
        const clockImpact = clockRaw * 1.2; 

        const totalScore = swotImpact + blueOceanImpact + marketImpact + abcImpact + clockImpact;

        const components = [
            { name: "Análise SWOT", score: swotImpact, weight: 0 },
            { name: "Oceano Azul (Diferenciação)", score: blueOceanImpact, weight: 0 },
            { name: "Tendência de Mercado", score: marketImpact, weight: 0 },
            { name: "Risco de Portfólio (ABC)", score: abcImpact, weight: 0 },
            { name: "Percepção de Valor (Bowman)", score: clockImpact, weight: 0 }
        ];

        setPlanData(prev => {
            if (Math.abs(prev.analysis.strategicScore.total - totalScore) < 0.01) return prev;
            return {
                ...prev,
                analysis: { ...prev.analysis, strategicScore: { total: totalScore, components } }
            };
        });

    }, [
        JSON.stringify(planData.marketAnalysis.swot),
        JSON.stringify(planData.marketAnalysis.blueOcean.factors),
        planData.marketAnalysis.marketCompetition.taxaCrescimentoMercado,
        JSON.stringify(planData.productPortfolio.map(p => ({ id: p.id, revenue: p.revenue2025 }))),
        JSON.stringify(planData.marketAnalysis.bowmanClockProducts.map(p => ({ id: p.id, price: p.priceLevel, value: p.perceivedValue })))
    ]);

    // === CÁLCULO AUTOMÁTICO DO BÔNUS DE PRODUTIVIDADE ===
    // Baseado em: redução de turnover, ROI de treinamento e investimento em T&D
    useEffect(() => {
        const { people } = planData;
        const sumRaw = (data: MonthlyData): number => Object.values(data || {}).reduce((acc: number, val: number | null) => acc + (val || 0), 0);
        
        // Dados de People 2025
        const headcountValues = Object.values(people.headcount.totalColaboradores || {}).filter(v => v !== undefined && v !== null) as number[];
        const headcountMedio = headcountValues.length > 0 ? headcountValues.reduce((a, b) => a + b, 0) / headcountValues.length : 0;
        const totalDesligamentos = sumRaw(people.headcount.desligamentosVoluntarios) + sumRaw(people.headcount.desligamentosInvoluntarios);
        const turnoverAtual = headcountMedio > 0 ? (totalDesligamentos / headcountMedio) * 100 : 0;
        const investTD = sumRaw(people.treinamento.investimentoTD);
        const ganhoTD = sumRaw(people.treinamento.ganhoTreinamento);
        const roiTreinamentoAtual = investTD > 0 ? ganhoTD / investTD : 0;
        const receitaTotal = (() => {
            const { financialSheet } = planData;
            return MONTHS.reduce((acc, m) => acc + (Number(financialSheet.receitaBruta.values2025?.[m]) || 0), 0);
        })();
        const receitaPorColab = headcountMedio > 0 ? receitaTotal / headcountMedio : 0;

        // Metas 2026
        const metaTurnover = goals2026.pessoas.metaTurnover || 0;
        const metaRoiTD = goals2026.pessoas.metaRoiTreinamento || 0;
        const metaHeadcount = goals2026.pessoas.metaHeadcount || 0;

        // Componente 1: Redução de Turnover (até 3%)
        // Cada 1pp de redução de turnover = ~0.5% de ganho de produtividade
        let turnoverBonus = 0;
        if (turnoverAtual > 0 && metaTurnover < turnoverAtual) {
            const reducao = turnoverAtual - metaTurnover;
            turnoverBonus = Math.min(reducao * 0.5, 3); // Máximo 3%
        }

        // Componente 2: ROI de Treinamento (até 3%)
        // Se ROI de treinamento melhora, indica equipe mais capacitada
        let treinamentoBonus = 0;
        if (metaRoiTD > roiTreinamentoAtual) {
            const melhoria = metaRoiTD - roiTreinamentoAtual;
            treinamentoBonus = Math.min(melhoria * 1.5, 3); // Máximo 3%
        } else if (roiTreinamentoAtual > 0) {
            treinamentoBonus = Math.min(roiTreinamentoAtual * 0.5, 2); // Mantém ROI positivo = até 2%
        }

        // Componente 3: Investimento em T&D como % da folha (até 2%)
        const folhaTotal = sumRaw(people.custos.folhaTotalAnual);
        let investTDBonus = 0;
        if (folhaTotal > 0 && investTD > 0) {
            const tdPercentFolha = (investTD / folhaTotal) * 100;
            // Benchmark: empresas top investem 3-5% da folha em T&D
            investTDBonus = tdPercentFolha >= 5 ? 2 : (tdPercentFolha >= 3 ? 1.5 : (tdPercentFolha >= 1 ? 0.5 : 0));
        }

        const totalProductivityGain = Math.round((turnoverBonus + treinamentoBonus + investTDBonus) * 10) / 10;
        const projectedRevenueCalc = receitaPorColab * (1 + totalProductivityGain / 100) * (metaHeadcount || headcountMedio);

        setPlanData(prev => {
            const prevGain = prev.analysis.peopleAnalytics.productivityGainFactor;
            const prevRev = prev.analysis.peopleAnalytics.projectedRevenue;
            if (Math.abs(prevGain - totalProductivityGain) < 0.01 && Math.abs(prevRev - projectedRevenueCalc) < 1) return prev;
            return {
                ...prev,
                analysis: {
                    ...prev.analysis,
                    peopleAnalytics: {
                        productivityGainFactor: totalProductivityGain,
                        projectedRevenue: projectedRevenueCalc
                    }
                }
            };
        });
    }, [
        JSON.stringify(planData.people),
        JSON.stringify(planData.financialSheet.receitaBruta.values2025),
        goals2026.pessoas.metaTurnover,
        goals2026.pessoas.metaRoiTreinamento,
        goals2026.pessoas.metaHeadcount
    ]);

    // === AUTO-RECALCULATE CENÁRIOS quando dados base (financialSheet, strategicScore, produtividade) mudam ===
    useEffect(() => {
        // Verifica se há dados na financialSheet (receita bruta preenchida)
        const hasData = MONTHS.some(m => (planData.financialSheet.receitaBruta.values2025?.[m] || 0) > 0);
        if (!hasData || isInitialLoad.current) return;

        const strategicScore = planData.analysis.strategicScore.total || 0;
        const scenarioNames: ScenarioName[] = ['Otimista', 'Conservador', 'Disruptivo'];
        
        let hasChanges = false;
        const newScenarios = { ...scenarios2026 };

        scenarioNames.forEach(name => {
            const scenario = scenarios2026[name];
            // Recalcula todos os cenários quando dados base mudam (inclusive manual)
            
            const growthPct = scenario.growthPercentage || 0;
            const newProjection = calculateScenarioProjection(planData.financialSheet, growthPct, strategicScore);
            
            // Verifica se realmente mudou para evitar loops
            const oldReceitaTotal = MONTHS.reduce((s, m) => s + (scenario.projection?.receitaBruta?.[m] || 0), 0);
            const newReceitaTotal = MONTHS.reduce((s, m) => s + (newProjection.receitaBruta?.[m] || 0), 0);
            
            if (Math.abs(oldReceitaTotal - newReceitaTotal) > 1) {
                newScenarios[name] = { ...scenario, projection: newProjection };
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setScenarios2026(newScenarios);
        }
    }, [
        JSON.stringify(planData.financialSheet.receitaBruta.values2025),
        JSON.stringify(planData.financialSheet.impostosSobreFaturamento.values2025),
        planData.analysis.strategicScore.total,
        planData.analysis.peopleAnalytics.productivityGainFactor
    ]);

    const summary2025: Summary2025 = useMemo(() => {
        const { financialSheet, commercial, people, marketing } = planData;

        const getVal = (row: FinancialSheetRow, m: string) => Number(row.values2025?.[m]) || 0;
        const getCustomSum = (items: CustomLineItem[], m: string) => items.reduce((acc, item) => acc + (Number(item.values2025?.[m]) || 0), 0);
        const sumRawMonthlyData = (data: MonthlyData): number => Object.values(data || {}).reduce((acc: number, val: number | null) => acc + (val || 0), 0);

        const monthlyStats = MONTHS.map(m => {
            const rb = getVal(financialSheet.receitaBruta, m);
            const imp = getVal(financialSheet.impostosSobreFaturamento, m);
            const rl = rb - imp;

            const cmv = getVal(financialSheet.cmv, m);
            const com = getVal(financialSheet.comissoes, m);
            const fre = getVal(financialSheet.fretes, m);
            const varCustom = getCustomSum(financialSheet.customCustosVariaveis, m);
            const custosVariaveis = cmv + com + fre + varCustom;

            const lb = rl - custosVariaveis;

            const folha = getVal(financialSheet.folhaPagamento, m);
            const aluguel = getVal(financialSheet.aluguel, m);
            const ops = getVal(financialSheet.despesasOperacionais, m);
            const mkt = getVal(financialSheet.marketingFixo, m);
            const admin = getVal(financialSheet.administrativo, m);
            const fixCustom = getCustomSum(financialSheet.customCustosFixos, m);
            const custosFixos = folha + aluguel + ops + mkt + admin + fixCustom;

            const ebitda = lb - custosFixos;

            return {
                month: m,
                receitaBruta: rb,
                impostos: imp,
                receitaLiquida: rl,
                custosVariaveis,
                lucroBruto: lb,
                custosFixos,
                ebitda
            };
        });

        const sum = (key: keyof typeof monthlyStats[0]) => monthlyStats.reduce((acc, item) => acc + (item[key] as number), 0);

        const receitaBrutaTotal = sum('receitaBruta');
        const receitaTotal = sum('receitaLiquida');
        const custosVariaveisTotal = sum('custosVariaveis');
        const cmvTotal = sumRawMonthlyData(financialSheet.cmv.values2025); 
        const custosFixosTotal = sum('custosFixos');
        const margemBruta = sum('lucroBruto');
        const ebitda = sum('ebitda');

        const headcountValues = Object.values(people.headcount.totalColaboradores || {}).filter(v => v !== undefined && v !== null) as number[];
        const headcountFinal = headcountValues.length > 0 ? headcountValues[headcountValues.length - 1] : 0;
        const headcountMedio = headcountValues.length > 0 ? headcountValues.reduce((a, b) => a + b, 0) / headcountValues.length : 0;
        const totalDesligamentos = sumRawMonthlyData(people.headcount.desligamentosVoluntarios) + sumRawMonthlyData(people.headcount.desligamentosInvoluntarios);
        const turnoverPercent = headcountMedio > 0 ? (totalDesligamentos / headcountMedio) * 100 : 0;
        const totalFolhaAnual = sumRawMonthlyData(people.custos.folhaTotalAnual);
        const salarioMedioMensal = headcountMedio > 0 ? (totalFolhaAnual / headcountMedio) / 12 : 0;
        const custoColaboradorAno = headcountMedio > 0 ? totalFolhaAnual / headcountMedio : 0;
        const investTD = sumRawMonthlyData(people.treinamento.investimentoTD);
        const ganhoTD = sumRawMonthlyData(people.treinamento.ganhoTreinamento);
        const roiTreinamento = investTD > 0 ? ganhoTD / investTD : 0;
        const investMktTotal = sumRawMonthlyData(marketing.investimentos.investimentoTotal);
        const novosClientes = sumRawMonthlyData(commercial.clientes.novosClientes);
        const cac = novosClientes > 0 ? investMktTotal / novosClientes : 0;
        const totalClientesValues = Object.values(commercial.clientes.totalClientesAtivos || {}).filter(v => v != null) as number[];
        const mediaClientes = totalClientesValues.length > 0 ? totalClientesValues.reduce((a,b)=>a+b,0)/totalClientesValues.length : 0;
        const ticketMedio = mediaClientes > 0 ? (receitaBrutaTotal / 12) / mediaClientes : 0;
        const ltv = ticketMedio * 12 * 3; 
        const roiMarketing = investMktTotal > 0 ? (receitaTotal - investMktTotal) / investMktTotal : 0;
        const margemContribuicaoPercent = receitaTotal > 0 ? (margemBruta / receitaTotal) : 0;
        const pontoEquilibrioContabil = margemContribuicaoPercent > 0 ? custosFixosTotal / margemContribuicaoPercent : 0;

        return {
            receitaTotal, receitaBrutaTotal, custosTotal: custosVariaveisTotal, custosVariaveisTotal, cmvTotal, custosFixosTotal, despesasTotal: custosFixosTotal,
            margemBruta, margemBrutaPercent: receitaTotal > 0 ? (margemBruta/receitaTotal)*100 : 0,
            ebitda, margemEbitda: receitaTotal > 0 ? (ebitda/receitaTotal)*100 : 0,
            novosClientesTotal: novosClientes, ticketMedio, taxaRetencao: 0, taxaConversaoLeadCliente: 0, classARevenuePercent: 0,
            headcountFinal, headcountMedio, turnoverPercent, salarioMedioMensal, custoColaboradorAno, roiTreinamento,
            investimentoMarketingTotal: investMktTotal, cac, ltv, relacaoLtvCac: cac > 0 ? ltv/cac : 0, roiMarketing,
            pontoEquilibrioContabil, pontoEquilibrioFinanceiro: 0, roas: 0,
            monthlySummary: monthlyStats.map(stat => ({
                month: stat.month,
                receita: stat.receitaLiquida, 
                custos: stat.custosVariaveis + stat.custosFixos, 
                custosVariaveis: stat.custosVariaveis, // NEW: Monthly Variable Costs
                custosFixos: stat.custosFixos,         // NEW: Monthly Fixed Costs
                ebitda: stat.ebitda
            }))
        };
    }, [planData.financialSheet, planData.commercial, planData.people, planData.marketing]);

    const financialIndicators = useMemo(() => {
        const { dre, bp, dfc } = planData.financialPlan2026;
        const { workingCapital } = planData.investment;
        const monthlyNCG: MonthlyData = {};
        let lastMonthCash = 0;
        MONTHS.forEach(m => {
            const ar = bp.contasAReceber?.[m] || 0;
            const inv = bp.estoques?.[m] || 0;
            const ap = bp.fornecedores?.[m] || 0;
            monthlyNCG[m] = (ar + inv) - ap;
            lastMonthCash = bp.caixa?.[m] || 0;
        });
        const negativeMonths = MONTHS.filter(m => (dfc.variacaoCaixa?.[m] || 0) < 0);
        const totalBurn = negativeMonths.reduce((sum, m) => sum + Math.abs(dfc.variacaoCaixa?.[m] || 0), 0);
        const cashBurnRate = negativeMonths.length > 0 ? totalBurn / negativeMonths.length : 0;
        const currentCashPosition = lastMonthCash;
        const runwayMonths = cashBurnRate > 0 ? currentCashPosition / cashBurnRate : 999;
        const totalRevenue = MONTHS.reduce((s, m) => s + (dre.receitaLiquida?.[m] || 0), 0);
        const totalEbitda = MONTHS.reduce((s, m) => s + (dre.ebitda?.[m] || 0), 0);
        const totalNetProfit = MONTHS.reduce((s, m) => s + (dre.lucroLiquido?.[m] || 0), 0);
        const endAssets = bp.totalAtivos?.['dez'] || 0;
        const endEquity = bp.patrimonioLiquido?.['dez'] || 0;
        const endCurrentAssets = bp.ativoCirculante?.['dez'] || 0;
        const endCurrentLiabilities = bp.passivoCirculante?.['dez'] || 0;
        const endInventory = bp.estoques?.['dez'] || 0;
        const endCash = bp.caixa?.['dez'] || 0;
        const endDebt = (bp.emprestimosCurtoPrazo?.['dez'] || 0) + (bp.emprestimosLongoPrazo?.['dez'] || 0);
        const netDebt = endDebt - endCash;
        const investedCapital = endEquity + endDebt - endCash;
        const { margemBrutaPercent, cac, ticketMedio } = summary2025;
        const monthlyGrossProfitPerCustomer = (ticketMedio / 12) * (margemBrutaPercent / 100);
        const cacPayback = monthlyGrossProfitPerCustomer > 0 ? cac / monthlyGrossProfitPerCustomer : 0;
        return { 
            liquidity: { monthlyNCG, cashBurnRate, runwayMonths, cashBalanceProjection: bp.caixa || {}, cycleSummary: { pmr: workingCapital.prazoMedioRecebimento || 0, pme: workingCapital.prazoMedioEstocagem || 0, pmp: workingCapital.prazoMedioPagamento || 0, financialCycle: workingCapital.cicloFinanceiro || 0 } }, 
            ratios: { liquidity: { currentRatio: endCurrentLiabilities > 0 ? endCurrentAssets / endCurrentLiabilities : 0, quickRatio: endCurrentLiabilities > 0 ? (endCurrentAssets - endInventory) / endCurrentLiabilities : 0, cashRatio: endCurrentLiabilities > 0 ? endCash / endCurrentLiabilities : 0 }, solvency: { debtToEbitda: totalEbitda > 0 ? netDebt / totalEbitda : 0, debtToEquity: endEquity > 0 ? endDebt / endEquity : 0 }, profitability: { roe: endEquity > 0 ? (totalNetProfit / endEquity) * 100 : 0, roic: investedCapital > 0 ? ((totalEbitda * 0.76) / investedCapital) * 100 : 0, netMargin: totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0 }, efficiency: { cacPayback, assetTurnover: endAssets > 0 ? totalRevenue / endAssets : 0 } }
        };
    }, [planData.financialPlan2026, planData.investment, summary2025]);

    const calculateSensitivityAnalysis = (baseRevenue: number, baseVariableCost: number, baseFixedCost: number, range: number = 20): SensitivityMatrix => {
        const steps = [-range, -range/2, 0, range/2, range];
        const matrix: SensitivityMatrix = [];
        steps.forEach(volumeChangePct => {
            const row: any[] = [];
            steps.forEach(priceChangePct => {
                const volMult = 1 + (volumeChangePct / 100);
                const priceMult = 1 + (priceChangePct / 100);
                const newRevenue = baseRevenue * volMult * priceMult;
                const newVariableCost = baseVariableCost * volMult;
                const newFixedCost = baseFixedCost;
                const newEbit = newRevenue - newVariableCost - newFixedCost;
                const taxes = newEbit > 0 ? newEbit * 0.24 : 0;
                const newNetProfit = newEbit - taxes;
                const newMargin = newRevenue > 0 ? (newNetProfit / newRevenue) * 100 : 0;
                row.push({ priceChange: priceChangePct, volumeChange: volumeChangePct, revenue: newRevenue, ebit: newEbit, netProfit: newNetProfit, margin: newMargin });
            });
            matrix.push(row);
        });
        return matrix;
    };
    const addPricingItem = (item: PricingItem) => setPricingItems(prev => [...prev, item]);
    const updatePricingItem = (id: string, updates: Partial<PricingItem>) => setPricingItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    const removePricingItem = (id: string) => setPricingItems(prev => prev.filter(item => item.id !== id));

    const updateCompanyProfile = (field: keyof CompanyProfile, value: string) => {
        setPlanData(prev => ({ ...prev, companyProfile: { ...prev.companyProfile, [field]: value } }));
    };

    const updateSheetValue = (rowKey: keyof FinancialSheetData, month: Month, value: string) => {
        setPlanData(prev => ({
            ...prev,
            financialSheet: {
                ...prev.financialSheet,
                [rowKey]: {
                    ...prev.financialSheet[rowKey],
                    values2025: { ...prev.financialSheet[rowKey].values2025, [month]: parseFloat(value) || 0 }
                }
            }
        }));
    };

    const updateSheetAllValues = (rowKey: keyof FinancialSheetData, newValues: MonthlyData) => {
        setPlanData(prev => ({
            ...prev,
            financialSheet: {
                ...prev.financialSheet,
                [rowKey]: {
                    ...prev.financialSheet[rowKey],
                    values2025: newValues
                }
            }
        }));
    };

    const updateCustomItem = (type: 'customCustosFixos' | 'customCustosVariaveis', id: string, field: 'name' | 'hint' | Month, value: string) => {
        setPlanData(prev => ({
            ...prev,
            financialSheet: {
                ...prev.financialSheet,
                [type]: prev.financialSheet[type].map(item => {
                    if (item.id !== id) return item;
                    if (field === 'name') return { ...item, name: value };
                    if (field === 'hint') return { ...item, hint: value };
                    return { ...item, values2025: { ...item.values2025, [field]: parseFloat(value) || 0 } };
                })
            }
        }));
    };

    const updateCustomItemAllValues = (type: 'customCustosFixos' | 'customCustosVariaveis', id: string, newValues: MonthlyData) => {
        setPlanData(prev => ({
            ...prev,
            financialSheet: {
                ...prev.financialSheet,
                [type]: prev.financialSheet[type].map(item => 
                    item.id === id ? { ...item, values2025: newValues } : item
                )
            }
        }));
    };

    const addCustomItem = (type: 'customCustosFixos' | 'customCustosVariaveis') => {
        setPlanData(prev => ({
            ...prev,
            financialSheet: {
                ...prev.financialSheet,
                [type]: [...prev.financialSheet[type], { id: uuidv4(), name: 'Novo Item', values2025: {} }]
            }
        }));
    };

    const removeCustomItem = (type: 'customCustosFixos' | 'customCustosVariaveis', id: string) => {
        setPlanData(prev => ({
            ...prev,
            financialSheet: {
                ...prev.financialSheet,
                [type]: prev.financialSheet[type].filter(item => item.id !== id)
            }
        }));
    };

    const importFinancialDataFromTsv = (tsvData: string) => {
        const lines = tsvData.split('\n');
        const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;
        
        // Fix: Use specific keys that are FinancialSheetRow
        type FinancialSheetRowKeys = keyof Omit<FinancialSheetData, 'customCustosFixos' | 'customCustosVariaveis'>;
        
        const keyMap: {[key: string]: FinancialSheetRowKeys} = {
            'Receita Bruta Total': 'receitaBruta',
            '(-) Impostos': 'impostosSobreFaturamento',
            'Folha de Pagamento': 'folhaPagamento',
            'Aluguel': 'aluguel',
            'Despesas Operacionais': 'despesasOperacionais',
            'Marketing': 'marketingFixo',
            'Administrativo': 'administrativo',
            'CMV': 'cmv',
            'Comissões': 'comissoes',
            'Fretes': 'fretes',
        };

        const updates: Partial<FinancialSheetData> = {};

        lines.forEach(line => {
            const cols = line.split('\t');
            if (cols.length < 13) return;
            const label = cols[0].trim().replace(/\s\(R\$\)$/, '');
            
            const matchedKey = Object.keys(keyMap).find(k => label.includes(k));
            if (matchedKey) {
                const key = keyMap[matchedKey];
                const values: MonthlyData = {};
                months.forEach((m, idx) => {
                    const val = parseFloat(cols[idx + 1].replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
                    values[m] = val;
                });
                updates[key] = { values2025: values };
            }
        });

        if (Object.keys(updates).length > 0) {
            setPlanData(prev => ({
                ...prev,
                financialSheet: {
                    ...prev.financialSheet,
                    ...updates
                }
            }));
        }
    };

    const updateCommercialData = (section: keyof CommercialData2025, metric: string, month: Month, value: string) => {
        setPlanData(prev => ({
            ...prev,
            commercial: {
                ...prev.commercial,
                [section]: {
                    ...prev.commercial[section],
                    [metric]: {
                        ...(prev.commercial[section] as any)[metric],
                        [month]: parseFloat(value) || 0
                    }
                }
            }
        }));
    };

    const updatePeopleData = (section: keyof PeopleData2025, metric: string, month: Month, value: string) => {
        setPlanData(prev => ({
            ...prev,
            people: {
                ...prev.people,
                [section]: {
                    ...prev.people[section],
                    [metric]: {
                        ...(prev.people[section] as any)[metric],
                        [month]: parseFloat(value) || 0
                    }
                }
            }
        }));
    };

    const updateMarketingData = (section: keyof MarketingData2025, metric: string, month: Month, value: string) => {
        setPlanData(prev => ({
            ...prev,
            marketing: {
                ...prev.marketing,
                [section]: {
                    ...prev.marketing[section],
                    [metric]: {
                        ...(prev.marketing[section] as any)[metric],
                        [month]: parseFloat(value) || 0
                    }
                }
            }
        }));
    };

    const updateInvestmentData = (section: keyof InvestmentData2025, metric: string, value: string) => {
        setPlanData(prev => ({
            ...prev,
            investment: {
                ...prev.investment,
                [section]: {
                    ...prev.investment[section],
                    [metric]: parseFloat(value) || 0
                }
            }
        }));
    };

    const updateProductPortfolioItem = (id: string, field: keyof Omit<ProductPortfolioItem, 'id'>, value: string) => {
        setPlanData(prev => ({
            ...prev,
            productPortfolio: prev.productPortfolio.map(item => 
                item.id === id ? { ...item, [field]: field === 'name' ? value : parseFloat(value) || 0 } : item
            )
        }));
    };

    const addProductPortfolioItem = () => {
        setPlanData(prev => ({
            ...prev,
            productPortfolio: [...prev.productPortfolio, { id: uuidv4(), name: '', revenue2025: 0, cost2025: 0, quantitySold2025: 0 }]
        }));
    };

    const removeProductPortfolioItem = (id: string) => {
        setPlanData(prev => ({
            ...prev,
            productPortfolio: prev.productPortfolio.filter(item => item.id !== id)
        }));
    };

    const updateMarketCompetitionData = (field: keyof MarketCompetitionData, value: string) => {
        setPlanData(prev => ({
            ...prev,
            marketAnalysis: {
                ...prev.marketAnalysis,
                marketCompetition: {
                    ...prev.marketAnalysis.marketCompetition,
                    [field]: field === 'principalConcorrente' || field === 'seuDiferencial' ? value : parseFloat(value) || 0
                }
            }
        }));
    };

    const updateSWOTData = (field: keyof SWOTData, value: string) => {
        setPlanData(prev => ({
            ...prev,
            marketAnalysis: {
                ...prev.marketAnalysis,
                swot: { ...prev.marketAnalysis.swot, [field]: value }
            }
        }));
    };

    const updateSwotImpact = (field: keyof Pick<SWOTData, 'strengthsImpact' | 'weaknessesImpact' | 'opportunitiesImpact' | 'threatsImpact'>, value: number) => {
        setPlanData(prev => ({
            ...prev,
            marketAnalysis: {
                ...prev.marketAnalysis,
                swot: { ...prev.marketAnalysis.swot, [field]: value }
            }
        }));
    };

    const updateBlueOceanFactor = (id: string, field: keyof Omit<BlueOceanFactor, 'id'>, value: string) => {
        setPlanData(prev => ({
            ...prev,
            marketAnalysis: {
                ...prev.marketAnalysis,
                blueOcean: {
                    ...prev.marketAnalysis.blueOcean,
                    factors: prev.marketAnalysis.blueOcean.factors.map(f => f.id === id ? { ...f, [field]: field === 'name' ? value : parseFloat(value) || 0 } : f)
                }
            }
        }));
    };

    const addBlueOceanFactor = () => {
        setPlanData(prev => ({
            ...prev,
            marketAnalysis: {
                ...prev.marketAnalysis,
                blueOcean: {
                    ...prev.marketAnalysis.blueOcean,
                    factors: [...prev.marketAnalysis.blueOcean.factors, { id: uuidv4(), name: '', yourCompanyScore: 0, competitorScore: 0 }]
                }
            }
        }));
    };

    const removeBlueOceanFactor = (id: string) => {
        setPlanData(prev => ({
            ...prev,
            marketAnalysis: {
                ...prev.marketAnalysis,
                blueOcean: {
                    ...prev.marketAnalysis.blueOcean,
                    factors: prev.marketAnalysis.blueOcean.factors.filter(f => f.id !== id)
                }
            }
        }));
    };

    const updateBlueOceanFourActions = (field: keyof BlueOceanFourActions, value: string) => {
        setPlanData(prev => ({
            ...prev,
            marketAnalysis: {
                ...prev.marketAnalysis,
                blueOcean: {
                    ...prev.marketAnalysis.blueOcean,
                    fourActions: { ...prev.marketAnalysis.blueOcean.fourActions, [field]: value }
                }
            }
        }));
    };

    const updateBowmanClockProduct = (id: string, field: keyof Omit<BowmanClockProduct, 'id'>, value: string) => {
        setPlanData(prev => ({
            ...prev,
            marketAnalysis: {
                ...prev.marketAnalysis,
                bowmanClockProducts: prev.marketAnalysis.bowmanClockProducts.map(p => p.id === id ? { ...p, [field]: field === 'name' ? value : parseFloat(value) || 0 } : p)
            }
        }));
    };

    const addBowmanClockProduct = () => {
        setPlanData(prev => ({
            ...prev,
            marketAnalysis: {
                ...prev.marketAnalysis,
                bowmanClockProducts: [...prev.marketAnalysis.bowmanClockProducts, { id: uuidv4(), name: '', priceLevel: 3, perceivedValue: 3 }]
            }
        }));
    };

    const removeBowmanClockProduct = (id: string) => {
        setPlanData(prev => ({
            ...prev,
            marketAnalysis: {
                ...prev.marketAnalysis,
                bowmanClockProducts: prev.marketAnalysis.bowmanClockProducts.filter(p => p.id !== id)
            }
        }));
    };

    const generateGoalSuggestions = async () => {
        const suggestions = await api.getGoalSuggestions(planData, summary2025);
        setGoals2026(prev => ({ ...prev, ...suggestions }));
    };

    const updateGoal = (category: keyof Omit<Goals2026, 'inflacaoPrevista' | 'objetivosEstrategicos'>, metric: string, value: string, month?: Month) => {
        setGoals2026(prev => {
            if (month) {
                const currentData = (prev[category] as any)[metric] as MonthlyData;
                return {
                    ...prev,
                    [category]: {
                        ...prev[category],
                        [metric]: { ...currentData, [month]: parseFloat(value) || 0 }
                    }
                };
            } else {
                return {
                    ...prev,
                    [category]: {
                        ...prev[category],
                        [metric]: parseFloat(value) || 0
                    }
                };
            }
        });
    };

    const updateObjective = (metric: keyof StrategicObjectives, value: string) => {
        setGoals2026(prev => ({
            ...prev,
            objetivosEstrategicos: { ...prev.objetivosEstrategicos, [metric]: value }
        }));
    };

    const updateInflation = (value: string) => {
        setGoals2026(prev => ({ ...prev, inflacaoPrevista: parseFloat(value) || 0 }));
    };

    const calculateScenarioProjection = (baseSheet: FinancialSheetData, growthPct: number, strategicScore: number): ScenarioProjectionData => {
        // Fórmula completa: Crescimento Base + Fator Estratégico + Bônus de Produtividade
        const productivityBonus = planData.analysis.peopleAnalytics.productivityGainFactor || 0;
        const growthFactor = 1 + ((growthPct + strategicScore + productivityBonus) / 100);
        
        const applyGrowth = (data: MonthlyData) => {
            const result: MonthlyData = {};
            MONTHS.forEach(m => {
                result[m] = (data[m] || 0) * growthFactor;
            });
            return result;
        };

        const applyGrowthToCustom = (items: CustomLineItem[]) => {
            return items.map(item => ({
                ...item,
                values: applyGrowth(item.values2025)
            }));
        };

        return {
            receitaBruta: applyGrowth(baseSheet.receitaBruta.values2025),
            impostosSobreFaturamento: applyGrowth(baseSheet.impostosSobreFaturamento.values2025),
            folhaPagamento: applyGrowth(baseSheet.folhaPagamento.values2025),
            aluguel: applyGrowth(baseSheet.aluguel.values2025),
            despesasOperacionais: applyGrowth(baseSheet.despesasOperacionais.values2025),
            marketingFixo: applyGrowth(baseSheet.marketingFixo.values2025),
            administrativo: applyGrowth(baseSheet.administrativo.values2025),
            customCustosFixos: applyGrowthToCustom(baseSheet.customCustosFixos),
            cmv: applyGrowth(baseSheet.cmv.values2025),
            comissoes: applyGrowth(baseSheet.comissoes.values2025),
            fretes: applyGrowth(baseSheet.fretes.values2025),
            customCustosVariaveis: applyGrowthToCustom(baseSheet.customCustosVariaveis)
        };
    };

    const recalculateScenario = (scenario: ScenarioName) => {
        const growthPct = scenarios2026[scenario].growthPercentage || 0;
        const strategicScore = planData.analysis.strategicScore.total || 0;
        const newProjection = calculateScenarioProjection(planData.financialSheet, growthPct, strategicScore);
        
        setScenarios2026(prev => ({
            ...prev,
            [scenario]: {
                ...prev[scenario],
                projection: newProjection
            }
        }));
    };

    const recalculateAllScenarios = () => {
        const scenarioNames: ScenarioName[] = ['Otimista', 'Conservador', 'Disruptivo'];
        const strategicScore = planData.analysis.strategicScore.total || 0;
        const newScenarios = { ...scenarios2026 };
        scenarioNames.forEach(name => {
            const growthPct = scenarios2026[name].growthPercentage || 0;
            const newProjection = calculateScenarioProjection(planData.financialSheet, growthPct, strategicScore);
            newScenarios[name] = { ...newScenarios[name], projection: newProjection };
        });
        setScenarios2026(newScenarios);
    };

    const updateScenarioGrowthPercentage = (scenario: ScenarioName, value: string) => {
        const val = parseFloat(value) || 0;
        setScenarios2026(prev => ({
            ...prev,
            [scenario]: { ...prev[scenario], growthPercentage: val }
        }));
        
        // Auto-recalculate if in percentage mode
        if (planData.scenariosInputMode[scenario] === 'percentage') {
            const strategicScore = planData.analysis.strategicScore.total || 0;
            const newProjection = calculateScenarioProjection(planData.financialSheet, val, strategicScore);
             setScenarios2026(prev => ({
                ...prev,
                [scenario]: {
                    ...prev[scenario],
                    growthPercentage: val,
                    projection: newProjection
                }
            }));
        }
    };

    const applyTaxesTo2025 = () => {
        const { receitaBruta } = planData.financialSheet;
        const { regimeTributario, simplesNacional, iss, icms, pis, cofins, irpj, csll, aliquotaEfetiva } = taxes;
        
        let rate = 0;
        if (aliquotaEfetiva > 0) {
            rate = aliquotaEfetiva / 100;
        } else if (regimeTributario === 'Simples Nacional') {
            rate = (simplesNacional || 0) / 100;
        } else {
            rate = ((iss || 0) + (icms || 0) + (pis || 0) + (cofins || 0) + (irpj || 0) + (csll || 0)) / 100;
        }

        const newImpostos: MonthlyData = {};
        MONTHS.forEach(m => {
            const rb = receitaBruta.values2025[m] || 0;
            newImpostos[m] = rb * rate;
        });

        updateSheetAllValues('impostosSobreFaturamento', newImpostos);
    };

    const updateScenarioInputMode = (scenario: ScenarioName, mode: 'percentage' | 'manual') => {
        setPlanData(prev => ({
            ...prev,
            scenariosInputMode: { ...prev.scenariosInputMode, [scenario]: mode }
        }));
    };

    const updateScenarioManualValue = (scenario: ScenarioName, metricKey: keyof Omit<ScenarioData, 'growthPercentage'>, month: Month, value: string) => {
        // Implementation for manual value update if needed
    };

    const updateScenarioProjectionValue = (scenario: ScenarioName, rowKey: keyof ScenarioProjectionData, month: Month, value: string) => {
        setScenarios2026(prev => ({
            ...prev,
            [scenario]: {
                ...prev[scenario],
                projection: {
                    ...prev[scenario].projection,
                    [rowKey]: { ...prev[scenario].projection[rowKey], [month]: parseFloat(value) || 0 }
                }
            }
        }));
    };

    const updateScenarioProjectionAllValues = (scenario: ScenarioName, rowKey: keyof ScenarioProjectionData, newValues: MonthlyData) => {
        setScenarios2026(prev => ({
            ...prev,
            [scenario]: {
                ...prev[scenario],
                projection: {
                    ...prev[scenario].projection,
                    [rowKey]: newValues
                }
            }
        }));
    };

    const updateScenarioCustomItem = (scenario: ScenarioName, type: 'customCustosFixos' | 'customCustosVariaveis', id: string, field: 'name' | Month, value: string) => {
        setScenarios2026(prev => ({
            ...prev,
            [scenario]: {
                ...prev[scenario],
                projection: {
                    ...prev[scenario].projection,
                    [type]: prev[scenario].projection[type].map(item => {
                        if (item.id !== id) return item;
                        if (field === 'name') return { ...item, name: value };
                        return { ...item, values: { ...item.values, [field]: parseFloat(value) || 0 } };
                    })
                }
            }
        }));
    };

    const updateScenarioCustomItemAllValues = (scenario: ScenarioName, type: 'customCustosFixos' | 'customCustosVariaveis', id: string, newValues: MonthlyData) => {
        setScenarios2026(prev => ({
            ...prev,
            [scenario]: {
                ...prev[scenario],
                projection: {
                    ...prev[scenario].projection,
                    [type]: prev[scenario].projection[type].map(item => 
                        item.id === id ? { ...item, values: newValues } : item
                    )
                }
            }
        }));
    };

    const addScenarioCustomItem = (scenario: ScenarioName, type: 'customCustosFixos' | 'customCustosVariaveis') => {
        setScenarios2026(prev => ({
            ...prev,
            [scenario]: {
                ...prev[scenario],
                projection: {
                    ...prev[scenario].projection,
                    [type]: [...prev[scenario].projection[type], { id: uuidv4(), name: 'Novo Item (Cenário)', values: {} }]
                }
            }
        }));
    };

    const removeScenarioCustomItem = (scenario: ScenarioName, type: 'customCustosFixos' | 'customCustosVariaveis', id: string) => {
        setScenarios2026(prev => ({
            ...prev,
            [scenario]: {
                ...prev[scenario],
                projection: {
                    ...prev[scenario].projection,
                    [type]: prev[scenario].projection[type].filter(item => item.id !== id)
                }
            }
        }));
    };

    const updateDecisionTrigger = (scenario: ScenarioName, value: string) => {
        setPlanData(prev => ({
            ...prev,
            scenarioRelatedData: { ...prev.scenarioRelatedData, [scenario]: { ...prev.scenarioRelatedData[scenario], decisionTriggers: value } }
        }));
    };

    const updateStrategicAction = (scenario: ScenarioName, value: string) => {
        setPlanData(prev => ({
            ...prev,
            scenarioRelatedData: { ...prev.scenarioRelatedData, [scenario]: { ...prev.scenarioRelatedData[scenario], strategicActions: value } }
        }));
    };

    const generateDecisionTriggers = async (scenario: ScenarioName) => {
        const result = await api.getDecisionTriggers(planData, summary2025, scenario);
        updateDecisionTrigger(scenario, result);
    };

    const getScenarioAnalysis = async () => {
        const triggers = {
            'Otimista': planData.scenarioRelatedData.Otimista.decisionTriggers,
            'Conservador': planData.scenarioRelatedData.Conservador.decisionTriggers,
            'Disruptivo': planData.scenarioRelatedData.Disruptivo.decisionTriggers
        };
        const actions = {
            'Otimista': planData.scenarioRelatedData.Otimista.strategicActions,
            'Conservador': planData.scenarioRelatedData.Conservador.strategicActions,
            'Disruptivo': planData.scenarioRelatedData.Disruptivo.strategicActions
        };
        const result = await api.getScenarioAnalysis(scenarios2026, triggers, actions);
        setPlanData(p => ({...p, analysis: {...p.analysis, strategicSummary: result}}));
    };

    const getStrategicScoreAnalysis = async (scenarioName: ScenarioName) => {
        const result = await api.getStrategicScoreImpactAnalysis(planData.analysis.strategicScore);
        setPlanData(prev => ({
            ...prev,
            scenarioRelatedData: {
                ...prev.scenarioRelatedData,
                [scenarioName]: { ...prev.scenarioRelatedData[scenarioName], scenarioAnalysis: result }
            }
        }));
    };

    const calculateFinancialPlan2026 = () => {
        const scenario = scenarios2026[baseScenario];
        const proj = scenario.projection;

        const dre: DRE2026 = {} as any;
        dre.receitaBruta = proj.receitaBruta;
        dre.impostosVendas = proj.impostosSobreFaturamento;
        dre.receitaLiquida = {};
        dre.custosVariaveis = {}; 
        dre.outrosCustosVariaveis = {}; 
        dre.lucroBruto = {};
        dre.despesasFolha = {};
        dre.despesasMarketing = {};
        dre.despesasOperacionais = {};
        dre.outrasDespesasFixas = {};
        dre.ebitda = {};
        dre.depreciacao = {};
        dre.ebit = {};
        dre.despesasFinanceiras = {};
        dre.lucroAntesImpostos = {};
        dre.irpjCsll = {};
        dre.lucroLiquido = {};

        MONTHS.forEach(m => {
            const rb = proj.receitaBruta[m] || 0;
            const imp = proj.impostosSobreFaturamento[m] || 0;
            dre.receitaLiquida[m] = rb - imp;
            
            const cmv = proj.cmv[m] || 0;
            const com = proj.comissoes[m] || 0;
            const fre = proj.fretes[m] || 0;
            dre.custosVariaveis[m] = cmv + com + fre;
            
            const custVarCustom = proj.customCustosVariaveis.reduce((s, i) => s + (i.values[m] || 0), 0);
            dre.outrosCustosVariaveis[m] = custVarCustom;
            
            dre.lucroBruto[m] = dre.receitaLiquida[m] - dre.custosVariaveis[m] - custVarCustom;
            
            dre.despesasFolha[m] = proj.folhaPagamento[m] || 0;
            dre.despesasMarketing[m] = proj.marketingFixo[m] || 0;
            dre.despesasOperacionais[m] = (proj.despesasOperacionais[m] || 0) + (proj.aluguel[m] || 0);
            dre.outrasDespesasFixas[m] = (proj.administrativo[m] || 0) + proj.customCustosFixos.reduce((s, i) => s + (i.values[m] || 0), 0);
            
            const totalDespesas = dre.despesasFolha[m] + dre.despesasMarketing[m] + dre.despesasOperacionais[m] + dre.outrasDespesasFixas[m];
            dre.ebitda[m] = dre.lucroBruto[m] - totalDespesas;
            
            dre.depreciacao[m] = 0; 
            dre.ebit[m] = dre.ebitda[m] - dre.depreciacao[m];
            dre.despesasFinanceiras[m] = 0;
            dre.lucroAntesImpostos[m] = dre.ebit[m] - dre.despesasFinanceiras[m];
            
            const taxRate = 0.34;
            dre.irpjCsll[m] = dre.lucroAntesImpostos[m] > 0 ? dre.lucroAntesImpostos[m] * taxRate : 0;
            dre.lucroLiquido[m] = dre.lucroAntesImpostos[m] - dre.irpjCsll[m];
        });

        const dfc: DFC2026 = { fco: {}, fci: {}, fcf: {}, variacaoCaixa: {}, saldoInicialCaixa: {}, saldoFinalCaixa: {} } as any;
        let currentCash = planData.investment.financing.saldoCaixaFinal2025 || 0;
        
        MONTHS.forEach(m => {
            dfc.fco[m] = dre.ebitda[m] - dre.irpjCsll[m];
            dfc.fci[m] = -(planData.investment.capex.totalCapex || 0) / 12;
            dfc.fcf[m] = 0;
            
            dfc.variacaoCaixa[m] = dfc.fco[m] + dfc.fci[m] + dfc.fcf[m];
            dfc.saldoInicialCaixa[m] = currentCash;
            currentCash += dfc.variacaoCaixa[m];
            dfc.saldoFinalCaixa[m] = currentCash;
        });

        const bp: BP2026 = { caixa: {}, contasAReceber: {}, estoques: {}, ativoCirculante: {}, ativoNaoCirculante: {}, totalAtivos: {}, fornecedores: {}, emprestimosCurtoPrazo: {}, passivoCirculante: {}, emprestimosLongoPrazo: {}, passivoNaoCirculante: {}, capitalSocial: {}, lucrosAcumulados: {}, patrimonioLiquido: {}, totalPassivoPL: {} } as any;
        
        MONTHS.forEach(m => {
            bp.caixa[m] = dfc.saldoFinalCaixa[m];
            bp.contasAReceber[m] = dre.receitaBruta[m] * (planData.investment.workingCapital.prazoMedioRecebimento || 30) / 30;
            bp.estoques[m] = dre.custosVariaveis[m] * (planData.investment.workingCapital.prazoMedioEstocagem || 30) / 30;
            bp.ativoCirculante[m] = bp.caixa[m] + bp.contasAReceber[m] + bp.estoques[m];
            bp.ativoNaoCirculante[m] = 0; 
            bp.totalAtivos[m] = bp.ativoCirculante[m] + bp.ativoNaoCirculante[m];
            
            bp.fornecedores[m] = (dre.custosVariaveis[m] + dre.despesasOperacionais[m]) * (planData.investment.workingCapital.prazoMedioPagamento || 30) / 30;
            bp.passivoCirculante[m] = bp.fornecedores[m];
            bp.passivoNaoCirculante[m] = 0;
            bp.patrimonioLiquido[m] = bp.totalAtivos[m] - bp.passivoCirculante[m] - bp.passivoNaoCirculante[m];
            bp.totalPassivoPL[m] = bp.passivoCirculante[m] + bp.passivoNaoCirculante[m] + bp.patrimonioLiquido[m];
        });

        setPlanData(prev => ({
            ...prev,
            financialPlan2026: { dre, dfc, bp }
        }));
    };

    const updateTracking2026 = (month: Month, field: string, value: string) => {
        setTracking2026(prev => ({
            ...prev,
            [month]: {
                ...prev[month],
                [field]: field === 'analysisText' ? value : (parseFloat(value) || 0)
            }
        }));
    };

    const updateTaxes = (field: keyof TaxesData, value: string) => {
        setTaxes(prev => ({
            ...prev,
            [field]: field === 'regimeTributario' || field === 'anexoSimples' ? value : (parseFloat(value) || 0)
        }));
    };
    
    // ... (value object definition) ...
    const value: PlanContextType = {
        planData, goals2026, scenarios2026, tracking2026, taxes, baseScenario, summary2025, subscriptionStatus,
        progressStatus: {} as any, 
        saveStatus, saveDataNow: () => saveToFirebase(true), lastSaved,
        pricingItems, addPricingItem, updatePricingItem, removePricingItem,
        updateCompanyProfile, updateSheetValue, updateSheetAllValues, updateCustomItem, updateCustomItemAllValues, addCustomItem, removeCustomItem, importFinancialDataFromTsv,
        updateCommercialData, updatePeopleData, updateMarketingData, updateInvestmentData, updateProductPortfolioItem, addProductPortfolioItem, removeProductPortfolioItem,
        updateMarketCompetitionData, updateSWOTData, updateSwotImpact, updateBlueOceanFactor, addBlueOceanFactor, removeBlueOceanFactor, updateBlueOceanFourActions, updateBowmanClockProduct, addBowmanClockProduct, removeBowmanClockProduct,
        generateOkrKpiSuggestions: async () => { const s = await api.getOkrKpiSuggestions(planData, goals2026, summary2025); setPlanData(p => ({...p, okrsAndKpis: s})); },
        addOkr: () => setPlanData(p => ({...p, okrsAndKpis: {...p.okrsAndKpis, okrs: [...p.okrsAndKpis.okrs, { id: uuidv4(), objective: '', keyResults: [] }]}})),
        updateOkr: (id, val) => setPlanData(p => ({...p, okrsAndKpis: {...p.okrsAndKpis, okrs: p.okrsAndKpis.okrs.map(o => o.id === id ? {...o, objective: val} : o)}})),
        removeOkr: (id) => setPlanData(p => ({...p, okrsAndKpis: {...p.okrsAndKpis, okrs: p.okrsAndKpis.okrs.filter(o => o.id !== id)}})),
        addKeyResult: (okrId) => setPlanData(p => ({...p, okrsAndKpis: {...p.okrsAndKpis, okrs: p.okrsAndKpis.okrs.map(o => o.id === okrId ? {...o, keyResults: [...o.keyResults, { id: uuidv4(), name: '', startValue: 0, targetValue: 0, currentValue: 0, unit: 'number' }]} : o)}})),
        updateKeyResult: (okrId, krId, field, val) => setPlanData(p => ({...p, okrsAndKpis: {...p.okrsAndKpis, okrs: p.okrsAndKpis.okrs.map(o => o.id === okrId ? {...o, keyResults: o.keyResults.map(k => k.id === krId ? {...k, [field]: field === 'name' || field === 'unit' ? val : parseFloat(val)} : k)} : o)}})),
        removeKeyResult: (okrId, krId) => setPlanData(p => ({...p, okrsAndKpis: {...p.okrsAndKpis, okrs: p.okrsAndKpis.okrs.map(o => o.id === okrId ? {...o, keyResults: o.keyResults.filter(k => k.id !== krId)} : o)}})),
        addKpi: (dept) => setPlanData(p => ({...p, okrsAndKpis: {...p.okrsAndKpis, kpis: {...p.okrsAndKpis.kpis, [dept]: [...p.okrsAndKpis.kpis[dept], { id: uuidv4(), name: '', value2025: 0, target2026: 0, unit: 'number' }]}}})),
        updateKpi: (dept, id, field, val) => setPlanData(p => ({...p, okrsAndKpis: {...p.okrsAndKpis, kpis: {...p.okrsAndKpis.kpis, [dept]: p.okrsAndKpis.kpis[dept].map(k => k.id === id ? {...k, [field]: field === 'name' || field === 'unit' ? val : parseFloat(val)} : k)}}})),
        removeKpi: (dept, id) => setPlanData(p => ({...p, okrsAndKpis: {...p.okrsAndKpis, kpis: {...p.okrsAndKpis.kpis, [dept]: p.okrsAndKpis.kpis[dept].filter(k => k.id !== id)}}})),
        updateCommercialPlanning: (sec, field, val) => setPlanData(p => ({...p, commercialPlanning: {...p.commercialPlanning, [sec]: {...p.commercialPlanning[sec], [field]: parseFloat(val)}}})),
        addDemandChannel: () => setPlanData(p => ({...p, commercialPlanning: {...p.commercialPlanning, demandPlanning: {...p.commercialPlanning.demandPlanning, channels: [...p.commercialPlanning.demandPlanning.channels, { id: uuidv4(), name: '', budget: 0, leads: 0, expectedRevenue: 0 }]}}})),
        removeDemandChannel: (id) => setPlanData(p => ({...p, commercialPlanning: {...p.commercialPlanning, demandPlanning: {...p.commercialPlanning.demandPlanning, channels: p.commercialPlanning.demandPlanning.channels.filter(c => c.id !== id)}}})),
        updateDemandChannel: (id, field, val) => setPlanData(p => ({...p, commercialPlanning: {...p.commercialPlanning, demandPlanning: {...p.commercialPlanning.demandPlanning, channels: p.commercialPlanning.demandPlanning.channels.map(c => c.id === id ? {...c, [field]: field === 'name' ? val : parseFloat(val)} : c)}}})),
        generateChannelAnalysis: async () => { const result = await api.getChannelMixAnalysis(planData.companyProfile, planData.commercialPlanning.demandPlanning.channels); setPlanData(p => ({...p, commercialPlanning: {...p.commercialPlanning, demandPlanning: {...p.commercialPlanning.demandPlanning, analysis: result}}})); },
        updateDriverBasedPlanning: (metric, month, value) => { setPlanData(p => ({ ...p, commercialPlanning: { ...p.commercialPlanning, driverBasedPlanning: { ...p.commercialPlanning.driverBasedPlanning, [metric]: { ...p.commercialPlanning.driverBasedPlanning[metric], [month]: value === '' ? null : parseFloat(value) } } } })); },
        updateHiringProjectionItem: (id, field, value) => setPlanData(p => ({...p, hiringProjection: p.hiringProjection.map(i => i.id === id ? {...i, [field]: field === 'department' ? value : (value === '' ? null : parseFloat(value))} : i)})),
        addHiringProjectionItem: () => setPlanData(p => ({...p, hiringProjection: [...p.hiringProjection, { id: uuidv4(), department: '', currentHeadcount: 0, newHires: 0, avgAnnualCost: 0 }]})),
        removeHiringProjectionItem: (id) => setPlanData(p => ({...p, hiringProjection: p.hiringProjection.filter(i => i.id !== id)})),
        generateFunnelSuggestions: async () => { const result = await api.getFunnelSuggestions(planData.commercialPlanning.salesFunnel); setPlanData(p => ({...p, commercialPlanning: {...p.commercialPlanning, funnelSuggestions: result}})); },
        generateMarketingFunnelAnalysis: async (f25, f26) => { const result = await api.generateMarketingFunnelAnalysis(f25, f26); setPlanData(p => ({...p, analysis: {...p.analysis, marketingFunnelAnalysis: result}})); },
        addActionPlanItem: () => setPlanData(p => ({...p, actionPlan: [...p.actionPlan, { id: uuidv4(), what: '', why: '', who: '', when: '', where: '', how: '', howMuch: 0, status: 'Não Iniciado', category: 'Estratégico' as const, priority: 'Média' as const, expectedResult: '' }]})),
        removeActionPlanItem: (id) => setPlanData(p => ({...p, actionPlan: p.actionPlan.filter(i => i.id !== id)})),
        updateActionPlanItem: (id, field, val) => setPlanData(p => ({...p, actionPlan: p.actionPlan.map(i => i.id === id ? {...i, [field]: field === 'howMuch' ? parseFloat(val) : val} : i)})),
        generateGoalSuggestions, updateGoal, updateObjective, updateInflation,
        updateScenarioGrowthPercentage, updateScenarioInputMode, updateScenarioManualValue, updateScenarioProjectionValue, updateScenarioProjectionAllValues,
        updateScenarioCustomItem, updateScenarioCustomItemAllValues, addScenarioCustomItem, removeScenarioCustomItem,
        applyWhatIfSimulation: (t, v) => {}, 
        updateDecisionTrigger, updateStrategicAction, generateDecisionTriggers, getScenarioAnalysis, getStrategicScoreAnalysis,
        calculateFinancialPlan2026, setBaseScenario, updateTracking2026, updateTaxes,
        generateBenchmarkAnalysis: async () => { const result = await api.getBenchmarkAnalysis(planData.companyProfile, summary2025); setPlanData(p => ({...p, analysis: {...p.analysis, benchmarkAnalysis: result}})); },
        generateStrategicSummaryAndActions: async () => { const result = await api.generateComprehensiveStrategicAnalysis(planData, summary2025, goals2026); setPlanData(p => ({...p, analysis: {...p.analysis, strategicSummary: result.analysisText}, actionPlan: [...p.actionPlan, ...result.actionPlanItems.map(i => ({...i, id: uuidv4(), status: 'Não Iniciado' as const, category: i.category || 'Estratégico' as const, priority: i.priority || 'Alta' as const, expectedResult: i.expectedResult || ''}))]})); },
        generateMonthlyAnalysis: async (m) => { const actual = tracking2026[m]; const projected = { receita: scenarios2026[baseScenario].receitaProjetada[m], custos: scenarios2026[baseScenario].custosProjetados[m], despesas: scenarios2026[baseScenario].despesasProjetadas[m] }; 
            const pMC = (projected.receita||0) - (projected.custos||0);
            const pPE = pMC > 0 ? (projected.despesas||0) / (pMC / (projected.receita||1)) : 0;
            const aMC = (actual?.receitaRealizada||0) - (actual?.custosRealizados||0);
            const aPE = aMC > 0 ? (actual?.despesasRealizadas||0) / (aMC / (actual?.receitaRealizada||1)) : 0;
            const result = await api.getMonthlyVarianceAnalysis(m, {receita: projected.receita, custosVariaveis: projected.custos, despesasFixas: projected.despesas, margemContribuicao: pMC, pontoEquilibrio: pPE}, {receita: actual?.receitaRealizada || 0, custosVariaveis: actual?.custosRealizados||0, despesasFixas: actual?.despesasRealizadas||0, margemContribuicao: aMC, pontoEquilibrio: aPE});
            updateTracking2026(m, 'analysisText', result);
        },
        generateDiagnosisReport: async () => { const result = await api.generateDiagnosisReportAnalysis(planData, summary2025); setPlanData(p => ({...p, analysis: {...p.analysis, diagnosisReportAnalysis: result}})); },
        generatePlanReport: async () => { const result = await api.generatePlanReportAnalysis(planData, goals2026, scenarios2026, baseScenario); setPlanData(p => ({...p, analysis: {...p.analysis, planReportAnalysis: result}})); },
        resetAllData: async () => {
            setPlanData(initialPlanData);
            setGoals2026(initialGoals);
            setScenarios2026(initialScenarios);
            setTracking2026({});
            setPricingItems([]);
            setTaxes({
                regimeTributario: 'Simples Nacional', anexoSimples: '', aliquotaEfetiva: 0, simplesNacional: 0,
                iss: 0, icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, inssPatronal: 0, fgts: 0, ratTerceiros: 0,
                totalEncargosFolha: 0, totalImpostos2024: 0, totalImpostos2025: 0
            });
            localStorage.removeItem('google_gemini_api_key');
            try {
                if (!isOfflineMode && db) {
                    const docRef = doc(db, 'users', user.uid);
                    await setDoc(docRef, {
                        planData: initialPlanData,
                        goals2026: initialGoals,
                        scenarios2026: initialScenarios,
                        tracking2026: {},
                        taxes: {
                            regimeTributario: 'Simples Nacional', anexoSimples: '', aliquotaEfetiva: 0, simplesNacional: 0,
                            iss: 0, icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, inssPatronal: 0, fgts: 0, ratTerceiros: 0,
                            totalEncargosFolha: 0, totalImpostos2024: 0, totalImpostos2025: 0
                        },
                        pricingItems: []
                    });
                }
            } catch (error) {
                console.error('Erro ao limpar dados no Firebase:', error);
            }
        },
        checkSubscription,
        financialIndicators,
        calculateSensitivityAnalysis,
        recalculateScenario,
        recalculateAllScenarios,
        applyTaxesTo2025
    };

    return (
        <PlanContext.Provider value={value}>
            {children}
        </PlanContext.Provider>
    );
};
