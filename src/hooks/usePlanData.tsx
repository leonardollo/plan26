
import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, updateProfile, sendEmailVerification } from 'firebase/auth';
import { PatchPlano } from '../services/dpeImport';
import {
    Acesso, StatusAcesso, ehAdministrador, obterOuCriarAcesso,
    listarAcessos as listarAcessosNoBanco, definirStatus,
} from '../services/acesso';
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
    LiquidityMetrics, FinancialKPIs, SensitivityMatrix, SaveStatus, EstadoDaCarga, PricingItem, FinancialSheetRow, CustomLineItem,
    BlueOceanFactor, BlueOceanFourActions, ScenarioProjectionData, StrategicObjectives, CustomProjectionLineItem,
    ListaInvestimento2026
} from '../types';
import { projetarCenario } from '../utils/calculos/cenario';
import { calcularPlanoFinanceiro2026 } from '../utils/calculos/planoFinanceiro';
import { custoContratacoesMensal } from '../utils/calculos/contratacoes';
import { investimento2026Vazio, normalizarInvestimento2026 } from '../utils/calculos/investimentos';
import { aliquotaDeducao, aliquotaDoAnoDoPlano, irpjCsllAnual } from '../utils/calculos/impostos';
import { nopat, paybackCacMeses } from '../utils/calculos/indicadores';
import { resumoDoCenario } from '../utils/calculos/resumo';
import { bonusDeProdutividade, scoreEstrategico } from '../utils/calculos/analise';
import {
    anoDoPrimeiroPlano, anosDoPlano, caminhoDoPlano, chaveLocalDoPlano, criarPlanoSeNaoExistir, listarPlanos,
    listarPlanosLocais, montarPlanoDoAnoSeguinte, proximoAnoDoPlano, type DadosDoPlano,
} from '../services/planos';

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
        // O próximo usuário deste navegador não pode herdar a chave de quem saiu.
        localStorage.removeItem('google_gemini_api_key');
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
    emailAtual: (): string | null => auth?.currentUser?.email ?? null,
    enviarVerificacaoDeEmail: async (): Promise<void> => {
        if (!isOfflineMode && auth?.currentUser) await sendEmailVerification(auth.currentUser);
    },
    recarregarUsuario: async (): Promise<void> => {
        if (isOfflineMode || !auth?.currentUser) return;
        await auth.currentUser.reload();
        // Token novo: sem ele a regra do banco ainda veria email_verified falso.
        await auth.currentUser.getIdToken(true);
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
    investment2026: investimento2026Vazio(),
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
};
const initialScenarios: Scenarios2026 = {
    'Otimista': { ...initialScenarioData, growthPercentage: 20 },
    'Conservador': { ...initialScenarioData, growthPercentage: 10 },
    'Disruptivo': { ...initialScenarioData, growthPercentage: -5 }
};

const initialTaxes: TaxesData = {
    regimeTributario: 'Simples Nacional', anexoSimples: '', aliquotaEfetiva: 0, simplesNacional: 0,
    iss: 0, icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, inssPatronal: 0, fgts: 0, ratTerceiros: 0,
    totalEncargosFolha: 0, totalImpostos2024: 0, totalImpostos2025: 0, cbsEfetiva: null
};

// Cenários em modo percentual e DRE do plano lido, pelas regras atuais e com os mesmos padrões que os setters da carga usam.
// Campo apagado ou inválido vira null (nunca NaN), como no resto do plano.
const numeroOuNulo = (value: string): number | null => {
    if (value === '') return null;
    const n = parseFloat(value);
    return Number.isNaN(n) ? null : n;
};

const novoItemInvestimento2026 = (lista: ListaInvestimento2026) => {
    const base = { id: uuidv4(), descricao: '', mes: 'jan' as Month, valor: null };
    if (lista === 'investimentos') return { ...base, vidaUtilAnos: null };
    if (lista === 'emprestimos') return { ...base, jurosMensalPct: null, parcelas: null };
    return base;
};

// `anoPlano` é o do plano que está sendo lido, não o do estado anterior: a alíquota do ano do plano depende dele.
const recalcularPlanoLido = (data: any, baseScenario: ScenarioName, anoPlano: number) => {
    const lido = data.planData || {};
    const financialSheet: FinancialSheetData = lido.financialSheet ?? initialPlanData.financialSheet;
    const modos = lido.scenariosInputMode ?? initialPlanData.scenariosInputMode;
    const investment = lido.investment ?? initialPlanData.investment;
    const investment2026 = normalizarInvestimento2026(lido.investment2026);
    const custoContratacoes = custoContratacoesMensal(lido.hiringProjection);
    const inflacao = { ...initialGoals, ...data.goals2026 }.inflacaoPrevista ?? 0;
    const taxes: TaxesData = { ...initialTaxes, ...data.taxes };
    const cenarios: Scenarios2026 = { ...initialScenarios, ...data.scenarios2026 };
    const recalculados: Partial<Scenarios2026> = {};
    // Score e bônus recalculados dos dados lidos, mesclados como no setter da carga: o valor gravado pode
    // estar desatualizado, e se os efeitos o corrigissem depois da carga, abrir o plano gravaria.
    const loadedFactors = lido.marketAnalysis?.blueOcean?.factors;
    const marketAnalysis: PlanData['marketAnalysis'] = {
        ...initialPlanData.marketAnalysis,
        ...lido.marketAnalysis,
        blueOcean: {
            ...initialPlanData.marketAnalysis.blueOcean,
            ...lido.marketAnalysis?.blueOcean,
            factors: (loadedFactors && loadedFactors.length > 0) ? loadedFactors : defaultBlueOceanFactors,
        },
    };
    const strategicScore = scoreEstrategico(marketAnalysis, lido.productPortfolio ?? initialPlanData.productPortfolio);
    const peopleAnalytics = bonusDeProdutividade(
        lido.people ?? initialPlanData.people,
        financialSheet.receitaBruta?.values2025,
        { ...initialGoals, ...data.goals2026 }.pessoas,
    );
    const score = strategicScore.total;
    const bonus = peopleAnalytics.productivityGainFactor;
    // Mesma condição do efeito de cenários: sem receita de 2025 não há base para projetar.
    const temReceita = MONTHS.some(m => (financialSheet.receitaBruta?.values2025?.[m] || 0) > 0);
    if (temReceita) {
        (['Otimista', 'Conservador', 'Disruptivo'] as ScenarioName[]).forEach(nome => {
            if (modos?.[nome] === 'manual') return;
            const cenario = cenarios[nome];
            const crescimento = (cenario?.growthPercentage || 0) + score + bonus;
            recalculados[nome] = { ...cenario, projection: projetarCenario(financialSheet, crescimento, inflacao, taxes, anoPlano, custoContratacoes) };
        });
    }
    const projecaoBase = (recalculados[baseScenario] ?? cenarios[baseScenario])?.projection;
    const financialPlan2026 = calcularPlanoFinanceiro2026(projecaoBase, taxes, investment, investment2026);
    return { recalculados, financialPlan2026, strategicScore, peopleAnalytics, investment2026 };
};

// "Erro" sozinho não ajuda ninguém. Quando o banco recusa por permissão, o problema é de acesso e não de
// rede — e a pessoa precisa saber disso para não ficar tentando de novo à toa.
const traduzirErroDeGravacao = (error: unknown): string => {
    const bruto = error instanceof Error ? error.message : String(error);
    return /permission|insufficient/i.test(bruto)
        ? 'O banco recusou a gravação: seu acesso não está liberado. Fale com a Gestão de Impacto.'
        : /offline|network|unavailable/i.test(bruto)
            ? 'Sem conexão com o banco. O que você escreveu não se perdeu; assim que voltar, salvo de novo.'
            : bruto;
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
    const [taxes, setTaxes] = useState<TaxesData>(initialTaxes);
    const [baseScenario, setBaseScenario] = useState<ScenarioName>('Conservador');
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('loading');
    const [souAdmin, setSouAdmin] = useState(false);
    const [motivoDoErroAoSalvar, setMotivoDoErroAoSalvar] = useState('');
    const [statusAcesso, setStatusAcesso] = useState<StatusAcesso | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [estadoDaCarga, setEstadoDaCargaState] = useState<EstadoDaCarga>('carregando');
    // Espelhos em ref: saveToFirebase, checkSubscription e o beforeunload precisam do valor atual, não o da closure.
    const estadoDaCargaRef = useRef<EstadoDaCarga>('carregando');
    const saveStatusRef = useRef<SaveStatus>('idle');
    const subscriptionStatusRef = useRef<SubscriptionStatus>('loading');
    // Marca o commit em que o plano lido entra no estado; os efeitos abaixo o ignoram.
    const acabouDeCarregar = useRef(false);
    // Ano cujos dados estão na tela: entra no estado no mesmo commit dos dados, e é para ele que a gravação vai.
    const [anoCarregado, setAnoCarregado] = useState<number | null>(null);
    // Ano da última carga pedida (null enquanto a lista de anos não foi lida).
    const [anoPedido, setAnoPedido] = useState<number | null>(null);
    const anoPedidoRef = useRef<number | null>(null);
    const [anosSalvosState, setAnosSalvosState] = useState<number[]>([]);
    const anosSalvos = useRef<number[]>([]);
    // Número da carga mais recente: uma carga que termina depois de outra mais nova é descartada.
    const cargaAtual = useRef(0);
    // Escrita no banco ainda sem resposta: trocar de ano espera por ela antes de gravar de novo.
    const gravacaoEmAndamento = useRef<Promise<void> | null>(null);
    const [criandoAno, setCriandoAno] = useState(false);
    // Ref além do estado: duas chamadas no mesmo tique ainda não veem o estado novo.
    const criandoAnoRef = useRef(false);

    const definirAnosSalvos = (anos: number[]) => {
        const lista = [...new Set(anos)].sort((a, b) => a - b);
        anosSalvos.current = lista;
        setAnosSalvosState(lista);
    };

    const setEstadoDaCarga = (estado: EstadoDaCarga) => {
        estadoDaCargaRef.current = estado;
        setEstadoDaCargaState(estado);
    };

    useEffect(() => { saveStatusRef.current = saveStatus; }, [saveStatus]);
    useEffect(() => { subscriptionStatusRef.current = subscriptionStatus; }, [subscriptionStatus]);

    const saveToFirebase = useCallback(async (manual: boolean = false) => {
        if (!user.uid) return Promise.resolve();
        if (estadoDaCargaRef.current !== 'carregado' || anoCarregado === null) {
            // Gravar antes de ler o plano trocaria o plano real pelo estado vazio da tela.
            const motivo = 'O plano ainda não foi carregado';
            setMotivoDoErroAoSalvar(motivo);
            setSaveStatus('error');
            return Promise.reject(new Error(motivo));
        }
        setSaveStatus('saving');
        try {
            // O caminho vem do ano dos dados desta renderização, nunca do ano escolhido no seletor.
            if (!isOfflineMode && db) {
                const docRef = doc(db, ...(caminhoDoPlano(user.uid, anoCarregado) as [string, ...string[]]));
                const escrita = setDoc(docRef, { planData, goals2026, scenarios2026, tracking2026, taxes, pricingItems }, { merge: true });
                gravacaoEmAndamento.current = escrita.catch(() => {});
                await escrita;
            } else {
                localStorage.setItem(chaveLocalDoPlano(user.uid, anoCarregado), JSON.stringify({ planData, goals2026, scenarios2026, tracking2026, taxes, pricingItems }));
            }
            if (!anosSalvos.current.includes(anoCarregado)) definirAnosSalvos([...anosSalvos.current, anoCarregado]);
            setSaveStatus('saved');
            setMotivoDoErroAoSalvar('');
            setLastSaved(new Date());
            if (!manual) {
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
            return Promise.resolve();
        } catch (error) {
            console.error("Error saving data:", error);
            setMotivoDoErroAoSalvar(traduzirErroDeGravacao(error));
            setSaveStatus('error');
            return Promise.reject(error);
        }
    }, [planData, goals2026, scenarios2026, tracking2026, taxes, pricingItems, user.uid, anoCarregado]);
    // A gravação antes de sair usa os dados da última renderização, não os da closure de quem chamou.
    const gravarRef = useRef(saveToFirebase);
    gravarRef.current = saveToFirebase;

    const carregarPlano = async (ano: number): Promise<void> => {
        if (!user.uid) return;
        const carga = ++cargaAtual.current;
        anoPedidoRef.current = ano;
        setAnoPedido(ano);
        setEstadoDaCarga('carregando');
        // O navegador só guarda a chave de quem acabou de entrar.
        localStorage.removeItem('google_gemini_api_key');
        try {
            let data: any = null;
            if (!isOfflineMode && db) {
                const docSnap = await getDoc(doc(db, ...(caminhoDoPlano(user.uid, ano) as [string, ...string[]])));
                if (docSnap.exists()) data = docSnap.data();
            } else {
                const stored = localStorage.getItem(chaveLocalDoPlano(user.uid, ano));
                if (stored) data = JSON.parse(stored);
            }
            // Uma carga mais nova (troca de ano) já foi pedida: este resultado é de outro ano.
            if (carga !== cargaAtual.current) return;
            const lido = data ?? {};
            const p = lido.planData ?? {};
            // Recalcula na própria carga, também sem plano salvo: o commit da carga não é gravado, então abrir não salva.
            const recalculado = recalcularPlanoLido(lido, baseScenario, ano);
            const { strategicScore, peopleAnalytics } = recalculado;
            const loadedFactors = p.marketAnalysis?.blueOcean?.factors;
            const validFactors = (loadedFactors && loadedFactors.length > 0) ? loadedFactors : defaultBlueOceanFactors;
            // Monta dos valores iniciais, nunca do `prev`: carregar outro ano a partir do `prev` mostraria e gravaria o ano anterior.
            setPlanData({
                ...initialPlanData,
                ...p,
                marketAnalysis: {
                    ...initialPlanData.marketAnalysis,
                    ...p.marketAnalysis,
                    blueOcean: {
                        ...initialPlanData.marketAnalysis.blueOcean,
                        ...p.marketAnalysis?.blueOcean,
                        factors: validFactors
                    }
                },
                analysis: { ...(p.analysis ?? initialPlanData.analysis), strategicScore, peopleAnalytics },
                // Bloco completado na própria carga: se um efeito o completasse depois, abrir o plano gravaria.
                investment2026: recalculado.investment2026,
                financialPlan2026: recalculado.financialPlan2026
            });
            setScenarios2026({ ...initialScenarios, ...lido.scenarios2026, ...recalculado.recalculados });
            // Só depois da leitura: a chave gravada é a do plano de quem entrou.
            if (p.companyProfile?.geminiApiKey) {
                localStorage.setItem('google_gemini_api_key', p.companyProfile.geminiApiKey);
            }
            setGoals2026({ ...initialGoals, ...lido.goals2026 });
            setTracking2026({ ...lido.tracking2026 });
            setTaxes({ ...initialTaxes, ...lido.taxes });
            setPricingItems(lido.pricingItems ?? []);
            setAnoCarregado(ano);
            // No mesmo tique dos setters acima: o commit que traz o plano lido é o mesmo que entra em 'carregado'.
            acabouDeCarregar.current = true;
            setEstadoDaCarga('carregado');
        } catch (error) {
            console.error("Error loading data:", error);
            if (carga === cargaAtual.current) setEstadoDaCarga('falhou');
        }
    };

    // Lê os anos salvos e abre o mais recente; sem nenhum, o ano do primeiro plano (sem gravar nada).
    const abrirPlano = async (): Promise<void> => {
        if (!user.uid) return;
        const carga = ++cargaAtual.current;
        anoPedidoRef.current = null;
        setAnoPedido(null);
        setEstadoDaCarga('carregando');
        localStorage.removeItem('google_gemini_api_key');
        try {
            const lista = !isOfflineMode && db
                ? await listarPlanos(db, user.uid)
                : listarPlanosLocais(localStorage, user.uid);
            if (carga !== cargaAtual.current) return;
            definirAnosSalvos(lista);
            await carregarPlano(lista.length > 0 ? lista[lista.length - 1] : anoDoPrimeiroPlano(new Date()));
        } catch (error) {
            console.error("Error listing plans:", error);
            if (carga === cargaAtual.current) setEstadoDaCarga('falhou');
        }
    };

    // Antes de trocar de ano, o que foi editado vai para o ano aberto; se não gravar, a troca não acontece.
    const gravarAntesDeSair = async (): Promise<boolean> => {
        const status = saveStatusRef.current;
        if (status !== 'unsaved' && status !== 'saving' && status !== 'error') return true;
        if (gravacaoEmAndamento.current) await gravacaoEmAndamento.current;
        try {
            await gravarRef.current(true);
            return true;
        } catch {
            return false;
        }
    };

    const trocarAno = async (ano: number): Promise<boolean> => {
        if (!(await gravarAntesDeSair())) return false;
        await carregarPlano(ano);
        return true;
    };

    const comecarProximoAno = async (): Promise<boolean> => {
        if (!user.uid || criandoAnoRef.current) return false;
        criandoAnoRef.current = true;
        setCriandoAno(true);
        // Uma troca de ano pedida durante a criação vence: ao terminar, o ano novo só entra na lista.
        const cargaNoInicio = cargaAtual.current;
        try {
            if (!(await gravarAntesDeSair())) return false;
            const ano = proximoAnoDoPlano(anosSalvos.current, new Date());
            if (ano === null) return false;
            const anoOrigem = Math.max(...anosSalvos.current);
            const iniciais: DadosDoPlano = {
                planData: initialPlanData, goals2026: initialGoals, scenarios2026: initialScenarios,
                tracking2026: {}, taxes: initialTaxes, pricingItems: [],
            };
            try {
                if (!isOfflineMode && db) {
                    await criarPlanoSeNaoExistir(db, user.uid, ano, anoOrigem, iniciais);
                } else if (!listarPlanosLocais(localStorage, user.uid).includes(ano)) {
                    const origem = localStorage.getItem(chaveLocalDoPlano(user.uid, anoOrigem));
                    const novo = montarPlanoDoAnoSeguinte(origem ? JSON.parse(origem) : {}, iniciais);
                    localStorage.setItem(chaveLocalDoPlano(user.uid, ano), JSON.stringify(novo));
                }
            } catch (error) {
                console.error('Error creating plan:', error);
                setMotivoDoErroAoSalvar(traduzirErroDeGravacao(error));
                return false;
            }
            definirAnosSalvos([...anosSalvos.current, ano]);
            if (cargaAtual.current === cargaNoInicio) await carregarPlano(ano);
            return true;
        } finally {
            criandoAnoRef.current = false;
            setCriandoAno(false);
        }
    };

    // Sem ano escolhido (a listagem falhou), refaz a listagem; senão recarrega o mesmo ano.
    const tentarCarregarDeNovo = (): Promise<void> =>
        anoPedidoRef.current === null ? abrirPlano() : carregarPlano(anoPedidoRef.current);

    useEffect(() => {
        if (!user.uid) return;
        abrirPlano();
        checkSubscription();
    }, [user.uid]);

    useEffect(() => {
        if (!user.uid || estadoDaCarga !== 'carregado') return;
        // O que acabou de ser lido não é edição; regravar arriscaria sobrescrever o banco com o estado de antes da carga.
        if (acabouDeCarregar.current) return;
        setSaveStatus('unsaved');
        const saveDataTimeout = setTimeout(() => {
            saveToFirebase().catch(() => {}); // o motivo já fica em saveStatus/motivoDoErroAoSalvar
        }, 3000);
        return () => {
            clearTimeout(saveDataTimeout);
        };
    }, [planData, goals2026, scenarios2026, tracking2026, taxes, pricingItems, user.uid, saveToFirebase, estadoDaCarga]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const status = saveStatusRef.current;
            if (status === 'unsaved' || status === 'saving' || status === 'error') {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    /**
     * Confere se esta pessoa pode usar o sistema.
     *
     * Antes isto era `setSubscriptionStatus('active')` fixo: qualquer um que se
     * cadastrasse entrava com acesso total. Agora quem chega entra na fila como
     * pendente e não alcança dado nenhum até um administrador liberar.
     *
     * Esta função é para a pessoa entender o que está acontecendo. Quem de fato
     * barra é a regra do Firestore — o código do navegador não protege nada.
     */
    const aplicarStatusDeAcesso = async (novo: SubscriptionStatus) => {
        const anterior = subscriptionStatusRef.current;
        setSubscriptionStatus(novo);
        // Pendente → liberado: a primeira carga foi negada pela regra; sem isto o app abriria vazio.
        // Na primeira conferência (anterior 'loading') não recarrega: a falha ali é da carga em si e a tela oferece "Tentar de novo".
        if (novo === 'active' && anterior !== 'loading' && estadoDaCargaRef.current === 'falhou') {
            await tentarCarregarDeNovo();
        }
    };

    const checkSubscription = async () => {
        if (isOfflineMode || !db) {
            // sem banco não há fila; o modo local é para desenvolver
            setSouAdmin(true);
            setStatusAcesso('liberado');
            setSubscriptionStatus('active');
            return;
        }
        try {
            // reload() não dispara onAuthStateChanged: o user do App fica com o valor antigo.
            const verificado = auth?.currentUser ? auth.currentUser.emailVerified : user.emailVerified;
            const admin = await ehAdministrador(db, user.email);

            if (admin && !verificado) {
                // A regra só reconhece admin com e-mail verificado; sem isto o app abriria um painel que o banco recusa.
                setSouAdmin(false);
                setStatusAcesso(null);
                await aplicarStatusDeAcesso('verificar_email');
                return;
            }
            setSouAdmin(admin);

            if (admin) {
                setStatusAcesso('liberado');
                await aplicarStatusDeAcesso('active');
                return;
            }

            const acesso = await obterOuCriarAcesso(db, user.uid, user.email, user.name, verificado);
            setStatusAcesso(acesso.status);
            await aplicarStatusDeAcesso(
                acesso.status === 'liberado' ? 'active'
                    : acesso.status === 'bloqueado' ? 'inactive'
                        : 'not_found'
            );
        } catch (e) {
            // Não liberar por causa de erro: falha de rede não pode virar
            // porta aberta. Melhor a pessoa ver a tela de espera e tentar de novo.
            console.error('Falha ao conferir acesso', e);
            setStatusAcesso('pendente');
            setSubscriptionStatus('not_found');
        }
    };

    const listarAcessosDoBanco = async (): Promise<Acesso[]> => {
        if (!db) return [];
        return listarAcessosNoBanco(db);
    };

    const mudarStatusDeAcesso = async (uid: string, status: StatusAcesso): Promise<void> => {
        if (!db) return;
        await definirStatus(db, uid, status, user.email || '');
    };

    useEffect(() => {
        const { total: totalScore, components } = scoreEstrategico(planData.marketAnalysis, planData.productPortfolio);

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
        const { productivityGainFactor: totalProductivityGain, projectedRevenue: projectedRevenueCalc } =
            bonusDeProdutividade(planData.people, planData.financialSheet.receitaBruta.values2025, goals2026.pessoas);

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
        // O plano recém-lido já traz os cenários gravados (inclusive os manuais); recalcular aqui os sobrescreveria.
        if (!hasData || estadoDaCargaRef.current !== 'carregado' || acabouDeCarregar.current) return;

        const strategicScore = planData.analysis.strategicScore.total || 0;
        const scenarioNames: ScenarioName[] = ['Otimista', 'Conservador', 'Disruptivo'];
        
        let hasChanges = false;
        const newScenarios = { ...scenarios2026 };

        scenarioNames.forEach(name => {
            // O que o cliente digitou no modo manual nunca é sobrescrito pelo recálculo automático.
            if (planData.scenariosInputMode?.[name] === 'manual') return;
            const scenario = scenarios2026[name];
            const growthPct = scenario.growthPercentage || 0;
            const newProjection = calculateScenarioProjection(planData.financialSheet, growthPct, strategicScore);

            // Compara a projeção inteira: inflação e impostos mudam linhas sem mudar a receita.
            if (JSON.stringify(newProjection) !== JSON.stringify(scenario.projection)) {
                newScenarios[name] = { ...scenario, projection: newProjection };
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setScenarios2026(newScenarios);
        }
    }, [
        JSON.stringify(planData.financialSheet),
        planData.analysis.strategicScore.total,
        planData.analysis.peopleAnalytics.productivityGainFactor,
        goals2026.inflacaoPrevista,
        JSON.stringify(taxes),
        JSON.stringify(planData.scenariosInputMode),
        JSON.stringify(planData.hiringProjection)
    ]);

    // === DRE/DFC/BP acompanham a projeção do cenário base e os impostos: o relatório nunca usa uma DRE velha ===
    useEffect(() => {
        // A carga já traz a DRE recalculada; o commit dela não é edição.
        if (estadoDaCargaRef.current !== 'carregado' || acabouDeCarregar.current) return;
        calculateFinancialPlan2026();
    }, [
        baseScenario,
        JSON.stringify(scenarios2026[baseScenario]?.projection),
        JSON.stringify(taxes),
        JSON.stringify(planData.investment),
        JSON.stringify(planData.investment2026)
    ]);

    // Declarado depois dos efeitos que olham acabouDeCarregar: só é limpo quando todos já viram o commit da carga.
    useEffect(() => { acabouDeCarregar.current = false; });

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
        const mediaClientesAtivos = totalClientesValues.length > 0 ? totalClientesValues.reduce((a,b)=>a+b,0)/totalClientesValues.length : 0;
        const ticketMedio = mediaClientesAtivos > 0 ? (receitaBrutaTotal / 12) / mediaClientesAtivos : 0;
        const ltv = ticketMedio * 12 * 3; 
        const roiMarketing = investMktTotal > 0 ? (receitaTotal - investMktTotal) / investMktTotal : 0;
        const margemContribuicaoPercent = receitaTotal > 0 ? (margemBruta / receitaTotal) : 0;

        /**
         * Ponto de equilíbrio MENSAL.
         *
         * A conta clássica (custo fixo ÷ margem de contribuição %) devolve o
         * faturamento do PERÍODO dos custos usados — aqui, o ano inteiro. O
         * dashboard chamava esse número de "receita mínima mensal" e o comparava
         * com a receita de um mês: um erro de fator 12, que acusava prejuízo em
         * empresa lucrativa. Agora o número já sai mensal, que é como consultor
         * fala e como o card sempre prometeu.
         */
        const custoFixoMensalMedio = custosFixosTotal / 12;
        const pontoEquilibrioContabil = margemContribuicaoPercent > 0 ? custoFixoMensalMedio / margemContribuicaoPercent : 0;

        /**
         * Conversão e retenção saíam fixadas em zero e apareciam assim no
         * relatório entregue ao cliente — dizendo que a empresa não converte
         * nenhum lead e não retém nenhum cliente. Os dados para calcular as
         * duas sempre estiveram na Coleta; ninguém tinha ligado os fios.
         *
         * Quando não há base para a conta, continua 0 — mas quem exibe precisa
         * mostrar "não medido", nunca "0%". Ver `temBaseConversao`/`temBaseRetencao`.
         */
        const leadsTotal = sumRawMonthlyData(commercial.funilComercial.leadsGerados);
        const vendasFechadasTotal = sumRawMonthlyData(commercial.funilComercial.vendasFechadas);
        const temBaseConversao = leadsTotal > 0 && vendasFechadasTotal > 0;
        const taxaConversaoLeadCliente = temBaseConversao ? (vendasFechadasTotal / leadsTotal) * 100 : 0;

        const clientesPerdidosTotal = sumRawMonthlyData(commercial.clientes.clientesPerdidos);
        const temBaseRetencao = mediaClientesAtivos > 0 && clientesPerdidosTotal > 0;
        const taxaRetencao = temBaseRetencao
            ? Math.max(0, (1 - clientesPerdidosTotal / mediaClientesAtivos) * 100)
            : 0;

        return {
            receitaTotal, receitaBrutaTotal, custosTotal: custosVariaveisTotal, custosVariaveisTotal, cmvTotal, custosFixosTotal, despesasTotal: custosFixosTotal,
            margemBruta, margemBrutaPercent: receitaTotal > 0 ? (margemBruta/receitaTotal)*100 : 0,
            ebitda, margemEbitda: receitaTotal > 0 ? (ebitda/receitaTotal)*100 : 0,
            // margemContribuicao era declarada no tipo e nunca devolvida: o relatório
            // entregue ao cliente mostrava "Margem de Contribuição R$ 0,00" numa
            // linha central do DRE, porque formatCurrency(undefined) devolve zero.
            margemContribuicao: margemBruta,
            margemContribuicaoPercent: margemContribuicaoPercent * 100,
            temBaseConversao, temBaseRetencao,
            novosClientesTotal: novosClientes, ticketMedio, taxaRetencao, taxaConversaoLeadCliente, classARevenuePercent: 0,
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
        const cacPayback = paybackCacMeses(cac, ticketMedio, margemBrutaPercent);
        const receitaBrutaAnual = MONTHS.reduce((s, m) => s + (dre.receitaBruta?.[m] || 0), 0);
        return { 
            liquidity: { monthlyNCG, cashBurnRate, runwayMonths, cashBalanceProjection: bp.caixa || {}, cycleSummary: { pmr: workingCapital.prazoMedioRecebimento || 0, pme: workingCapital.prazoMedioEstocagem || 0, pmp: workingCapital.prazoMedioPagamento || 0, financialCycle: workingCapital.cicloFinanceiro || 0 } }, 
            ratios: { liquidity: { currentRatio: endCurrentLiabilities > 0 ? endCurrentAssets / endCurrentLiabilities : 0, quickRatio: endCurrentLiabilities > 0 ? (endCurrentAssets - endInventory) / endCurrentLiabilities : 0, cashRatio: endCurrentLiabilities > 0 ? endCash / endCurrentLiabilities : 0 }, solvency: { debtToEbitda: totalEbitda > 0 ? netDebt / totalEbitda : 0, debtToEquity: endEquity > 0 ? endDebt / endEquity : 0 }, profitability: { roe: endEquity > 0 ? (totalNetProfit / endEquity) * 100 : 0, roic: investedCapital > 0 ? (nopat(taxes, receitaBrutaAnual, totalEbitda) / investedCapital) * 100 : 0, netMargin: totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0 }, efficiency: { cacPayback, assetTurnover: endAssets > 0 ? totalRevenue / endAssets : 0 } }
        };
    }, [planData.financialPlan2026, planData.investment, summary2025, taxes]);

    const calculateSensitivityAnalysis = (baseRevenue: number, baseVariableCost: number, baseFixedCost: number, range: number = 20): SensitivityMatrix => {
        const steps = [-range, -range/2, 0, range/2, range];
        const matrix: SensitivityMatrix = [];
        // A matriz recebe receita líquida; o Presumido cobra IRPJ/CSLL sobre a bruta, então ela é reconstruída.
        const fracaoLiquida = 1 - aliquotaDoAnoDoPlano(taxes, anoPlano, planData.financialSheet) / 100;
        steps.forEach(volumeChangePct => {
            const row: any[] = [];
            steps.forEach(priceChangePct => {
                const volMult = 1 + (volumeChangePct / 100);
                const priceMult = 1 + (priceChangePct / 100);
                const newRevenue = baseRevenue * volMult * priceMult;
                const newVariableCost = baseVariableCost * volMult;
                const newFixedCost = baseFixedCost;
                const newEbit = newRevenue - newVariableCost - newFixedCost;
                const receitaBruta = fracaoLiquida > 0 ? newRevenue / fracaoLiquida : newRevenue;
                const impostoDeRenda = irpjCsllAnual(taxes, receitaBruta, newEbit);
                const newNetProfit = newEbit - impostoDeRenda;
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

    // As duas chaves custom guardam LISTA, não linha com values2025. Aceitar
    // `keyof FinancialSheetData` prometia um contrato que a função não cumpre:
    // chamar com 'customCustosFixos' quebraria em tempo de execução.
    type LinhaSimples = Exclude<keyof FinancialSheetData, 'customCustosFixos' | 'customCustosVariaveis'>;
    const updateSheetValue = (rowKey: LinhaSimples, month: Month, value: string) => {
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

    // Antes de a carga terminar, o ano mostrado é o pedido; antes da lista, o do primeiro plano.
    const anosAbertos = anosDoPlano(anoCarregado ?? anoPedido ?? anoDoPrimeiroPlano(new Date()));
    const { anoPlano, anoBase } = anosAbertos;

    const generateGoalSuggestions = async () => {
        const suggestions = await api.getGoalSuggestions(planData, summary2025, anosAbertos);
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
        return projetarCenario(baseSheet, growthPct + strategicScore + productivityBonus, goals2026.inflacaoPrevista ?? 0, taxes, anoPlano, custoContratacoesMensal(planData.hiringProjection));
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
        // Só os impostos sobre a receita: IRPJ/CSLL do Presumido e do Real entram na DRE, sobre o lucro.
        const rate = aliquotaDeducao(taxes) / 100;

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
        const result = await api.getDecisionTriggers(planData, summary2025, scenario, anosAbertos);
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
        const result = await api.getScenarioAnalysis(scenarios2026, triggers, actions, anosAbertos);
        setPlanData(p => ({...p, analysis: {...p.analysis, strategicSummary: result}}));
    };

    const getStrategicScoreAnalysis = async (scenarioName: ScenarioName) => {
        const result = await api.getStrategicScoreImpactAnalysis(planData.analysis.strategicScore, anosAbertos);
        setPlanData(prev => ({
            ...prev,
            scenarioRelatedData: {
                ...prev.scenarioRelatedData,
                [scenarioName]: { ...prev.scenarioRelatedData[scenarioName], scenarioAnalysis: result }
            }
        }));
    };

    const calculateFinancialPlan2026 = () => {
        const plano = calcularPlanoFinanceiro2026(scenarios2026[baseScenario].projection, taxes, planData.investment, planData.investment2026);
        // Liquidez e Indicadores chamam ao montar: sem mudança real, não mexe no estado nem dispara gravação.
        setPlanData(prev => JSON.stringify(prev.financialPlan2026) === JSON.stringify(plano)
            ? prev
            : { ...prev, financialPlan2026: plano });
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
    
    /**
     * Aplica ao PLAN o que veio do diagnóstico (DPE-GI).
     *
     * Junta pedaço por pedaço em vez de espalhar um objeto inteiro por cima.
     * A diferença importa: `{...prev, ...patch}` num bloco aninhado apagaria
     * tudo o que o patch não trouxesse — o Blue Ocean e o Bowman sumiriam
     * junto com `marketAnalysis`, e o trabalho de quem preencheu iria embora
     * sem aviso. Aqui só é escrito o que o diagnóstico realmente trouxe.
     *
     * Listas (portfólio, ações, KPIs) são a exceção: essas substituem, porque
     * misturar duas origens numa lista gera duplicata. A tela avisa antes.
     */
    const aplicarImportacaoDpe = (patch: PatchPlano, metas: Partial<Goals2026>) => {
        setPlanData(prev => {
            const novo: PlanData = { ...prev };

            if (patch.companyProfile) {
                novo.companyProfile = { ...prev.companyProfile, ...patch.companyProfile };
            }
            if (patch.financialSheet) {
                novo.financialSheet = { ...prev.financialSheet, ...patch.financialSheet };
            }
            if (patch.commercial) {
                novo.commercial = { ...prev.commercial, ...patch.commercial };
            }
            if (patch.people) {
                novo.people = { ...prev.people, ...patch.people };
            }
            if (patch.marketing) {
                novo.marketing = { ...prev.marketing, ...patch.marketing };
            }
            if (patch.investment) {
                novo.investment = {
                    ...prev.investment,
                    ...patch.investment,
                    workingCapital: { ...prev.investment.workingCapital, ...(patch.investment.workingCapital || {}) },
                    financing: { ...prev.investment.financing, ...(patch.investment.financing || {}) },
                };
            }
            if (patch.productPortfolio) novo.productPortfolio = patch.productPortfolio;
            if (patch.actionPlan) novo.actionPlan = patch.actionPlan;

            if (patch.marketCompetition || patch.swot) {
                novo.marketAnalysis = {
                    ...prev.marketAnalysis,
                    marketCompetition: patch.marketCompetition
                        ? { ...prev.marketAnalysis.marketCompetition, ...patch.marketCompetition }
                        : prev.marketAnalysis.marketCompetition,
                    // o texto vem do diagnóstico; as notas de impacto continuam
                    // as que o consultor já tinha dado
                    swot: patch.swot
                        ? { ...prev.marketAnalysis.swot, ...patch.swot }
                        : prev.marketAnalysis.swot,
                };
            }

            if (patch.kpis) {
                novo.okrsAndKpis = { ...prev.okrsAndKpis, kpis: patch.kpis };
            }

            if (patch.driverBasedPlanning || patch.salesFunnel) {
                novo.commercialPlanning = {
                    ...prev.commercialPlanning,
                    driverBasedPlanning: patch.driverBasedPlanning
                        ? { ...prev.commercialPlanning.driverBasedPlanning, ...patch.driverBasedPlanning }
                        : prev.commercialPlanning.driverBasedPlanning,
                    salesFunnel: patch.salesFunnel
                        ? { ...prev.commercialPlanning.salesFunnel, ...patch.salesFunnel }
                        : prev.commercialPlanning.salesFunnel,
                };
            }

            // MFV, dependência do dono e causas-raiz não têm campo próprio no
            // PLAN. Até terem, ficam como texto de diagnóstico — melhor do que
            // se perderem na passagem.
            if (patch.diagnosticoOperacional) {
                novo.analysis = {
                    ...prev.analysis,
                    diagnosisReportAnalysis: patch.diagnosticoOperacional,
                };
            }

            return novo;
        });

        if (Object.keys(metas).length) {
            setGoals2026(prev => ({
                ...prev,
                ...metas,
                financeiras: { ...prev.financeiras, ...(metas.financeiras || {}) },
                comerciais: { ...prev.comerciais, ...(metas.comerciais || {}) },
                pessoas: { ...prev.pessoas, ...(metas.pessoas || {}) },
                objetivosEstrategicos: { ...prev.objetivosEstrategicos, ...(metas.objetivosEstrategicos || {}) },
            }));
        }
    };

    // ... (value object definition) ...
    const anosDisponiveis = [...new Set([...anosSalvosState, anoPlano])].sort((a, b) => a - b);

    const value: PlanContextType = {
        anoPlano, anoBase, anosDisponiveis,
        trocarAno, comecarProximoAno, criandoAno,
        proximoAnoDisponivel: proximoAnoDoPlano(anosSalvosState, new Date()),
        souAdmin, statusAcesso, listarAcessosDoBanco, mudarStatusDeAcesso, motivoDoErroAoSalvar,
        estadoDaCarga, tentarCarregarDeNovo,
        aplicarImportacaoDpe,
        planData, goals2026, scenarios2026, tracking2026, taxes, baseScenario, summary2025, subscriptionStatus,
        progressStatus: {} as any, 
        saveStatus, saveDataNow: () => saveToFirebase(true), lastSaved,
        pricingItems, addPricingItem, updatePricingItem, removePricingItem,
        updateCompanyProfile, updateSheetValue, updateSheetAllValues, updateCustomItem, updateCustomItemAllValues, addCustomItem, removeCustomItem, importFinancialDataFromTsv,
        updateCommercialData, updatePeopleData, updateMarketingData, updateInvestmentData, updateProductPortfolioItem, addProductPortfolioItem, removeProductPortfolioItem,
        updateMarketCompetitionData, updateSWOTData, updateSwotImpact, updateBlueOceanFactor, addBlueOceanFactor, removeBlueOceanFactor, updateBlueOceanFourActions, updateBowmanClockProduct, addBowmanClockProduct, removeBowmanClockProduct,
        generateOkrKpiSuggestions: async () => { const s = await api.getOkrKpiSuggestions(planData, goals2026, summary2025, anosAbertos); setPlanData(p => ({...p, okrsAndKpis: s})); },
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
        // mesEntrada é um mês (texto); parseFloat o transformaria em NaN.
        updateHiringProjectionItem: (id, field, value) => setPlanData(p => ({...p, hiringProjection: p.hiringProjection.map(i => i.id === id ? {...i, [field]: field === 'department' ? value : field === 'mesEntrada' ? (value === '' ? null : value) : (value === '' ? null : parseFloat(value))} : i)})),
        addHiringProjectionItem: () => setPlanData(p => ({...p, hiringProjection: [...p.hiringProjection, { id: uuidv4(), department: '', currentHeadcount: 0, newHires: 0, avgAnnualCost: 0, mesEntrada: 'jan' }]})),
        removeHiringProjectionItem: (id) => setPlanData(p => ({...p, hiringProjection: p.hiringProjection.filter(i => i.id !== id)})),
        updateJurosDividaAtual: (value) => setPlanData(p => ({...p, investment2026: {...p.investment2026, jurosDividaAtualPct: numeroOuNulo(value)}})),
        addItemInvestimento2026: (lista) => setPlanData(p => ({...p, investment2026: {...p.investment2026, [lista]: [...p.investment2026[lista], novoItemInvestimento2026(lista)]}})),
        updateItemInvestimento2026: (lista, id, campo, value) => setPlanData(p => ({...p, investment2026: {...p.investment2026, [lista]: (p.investment2026[lista] as { id: string }[]).map(i => i.id === id ? {...i, [campo]: campo === 'descricao' ? value : campo === 'mes' ? (value === '' ? null : value) : numeroOuNulo(value)} : i)}})),
        removeItemInvestimento2026: (lista, id) => setPlanData(p => ({...p, investment2026: {...p.investment2026, [lista]: (p.investment2026[lista] as { id: string }[]).filter(i => i.id !== id)}})),
        generateFunnelSuggestions: async () => { const result = await api.getFunnelSuggestions(planData.commercialPlanning.salesFunnel, undefined, anosAbertos); setPlanData(p => ({...p, commercialPlanning: {...p.commercialPlanning, funnelSuggestions: result}})); },
        generateMarketingFunnelAnalysis: async (f25, f26) => { const result = await api.generateMarketingFunnelAnalysis(f25, f26, anosAbertos); setPlanData(p => ({...p, analysis: {...p.analysis, marketingFunnelAnalysis: result}})); },
        addActionPlanItem: () => setPlanData(p => ({...p, actionPlan: [...p.actionPlan, { id: uuidv4(), what: '', why: '', who: '', when: '', where: '', how: '', howMuch: 0, status: 'Não Iniciado', category: 'Estratégico' as const, priority: 'Média' as const, expectedResult: '' }]})),
        removeActionPlanItem: (id) => setPlanData(p => ({...p, actionPlan: p.actionPlan.filter(i => i.id !== id)})),
        updateActionPlanItem: (id, field, val) => setPlanData(p => ({...p, actionPlan: p.actionPlan.map(i => i.id === id ? {...i, [field]: field === 'howMuch' ? parseFloat(val) : val} : i)})),
        generateGoalSuggestions, updateGoal, updateObjective, updateInflation,
        updateScenarioGrowthPercentage, updateScenarioInputMode, updateScenarioManualValue, updateScenarioProjectionValue, updateScenarioProjectionAllValues,
        updateScenarioCustomItem, updateScenarioCustomItemAllValues, addScenarioCustomItem, removeScenarioCustomItem,
        applyWhatIfSimulation: (t, v) => {}, 
        updateDecisionTrigger, updateStrategicAction, generateDecisionTriggers, getScenarioAnalysis, getStrategicScoreAnalysis,
        calculateFinancialPlan2026, setBaseScenario, updateTracking2026, updateTaxes,
        generateBenchmarkAnalysis: async () => { const result = await api.getBenchmarkAnalysis(planData.companyProfile, summary2025, anosAbertos); setPlanData(p => ({...p, analysis: {...p.analysis, benchmarkAnalysis: result}})); },
        generateStrategicSummaryAndActions: async () => { const result = await api.generateComprehensiveStrategicAnalysis(planData, summary2025, goals2026, anosAbertos); setPlanData(p => ({...p, analysis: {...p.analysis, strategicSummary: result.analysisText}, actionPlan: [...p.actionPlan, ...result.actionPlanItems.map(i => ({...i, id: uuidv4(), status: 'Não Iniciado' as const, category: i.category || 'Estratégico' as const, priority: i.priority || 'Alta' as const, expectedResult: i.expectedResult || ''}))]})); },
        generateMonthlyAnalysis: async (m) => { const actual = tracking2026[m]; const resumo = resumoDoCenario(scenarios2026[baseScenario]?.projection); const projected = { receita: resumo.receita[m], custos: resumo.custos[m], despesas: resumo.despesas[m] }; 
            const pMC = (projected.receita||0) - (projected.custos||0);
            const pPE = pMC > 0 ? (projected.despesas||0) / (pMC / (projected.receita||1)) : 0;
            const aMC = (actual?.receitaRealizada||0) - (actual?.custosRealizados||0);
            const aPE = aMC > 0 ? (actual?.despesasRealizadas||0) / (aMC / (actual?.receitaRealizada||1)) : 0;
            const result = await api.getMonthlyVarianceAnalysis(m, {receita: projected.receita, custosVariaveis: projected.custos, despesasFixas: projected.despesas, margemContribuicao: pMC, pontoEquilibrio: pPE}, {receita: actual?.receitaRealizada || 0, custosVariaveis: actual?.custosRealizados||0, despesasFixas: actual?.despesasRealizadas||0, margemContribuicao: aMC, pontoEquilibrio: aPE});
            updateTracking2026(m, 'analysisText', result);
        },
        generateDiagnosisReport: async () => { const result = await api.generateDiagnosisReportAnalysis(planData, summary2025, anosAbertos); setPlanData(p => ({...p, analysis: {...p.analysis, diagnosisReportAnalysis: result}})); },
        generatePlanReport: async () => { const result = await api.generatePlanReportAnalysis(planData, goals2026, scenarios2026, baseScenario, anosAbertos); setPlanData(p => ({...p, analysis: {...p.analysis, planReportAnalysis: result}})); },
        resetAllData: async () => {
            setPlanData(initialPlanData);
            setGoals2026(initialGoals);
            setScenarios2026(initialScenarios);
            setTracking2026({});
            setPricingItems([]);
            setTaxes({
                regimeTributario: 'Simples Nacional', anexoSimples: '', aliquotaEfetiva: 0, simplesNacional: 0,
                iss: 0, icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, inssPatronal: 0, fgts: 0, ratTerceiros: 0,
                totalEncargosFolha: 0, totalImpostos2024: 0, totalImpostos2025: 0, cbsEfetiva: null
            });
            localStorage.removeItem('google_gemini_api_key');
            try {
                // Apaga só o ano aberto: os outros anos do cliente ficam intactos.
                if (!isOfflineMode && db && anoCarregado !== null) {
                    const docRef = doc(db, ...(caminhoDoPlano(user.uid, anoCarregado) as [string, ...string[]]));
                    await setDoc(docRef, {
                        planData: initialPlanData,
                        goals2026: initialGoals,
                        scenarios2026: initialScenarios,
                        tracking2026: {},
                        taxes: {
                            regimeTributario: 'Simples Nacional', anexoSimples: '', aliquotaEfetiva: 0, simplesNacional: 0,
                            iss: 0, icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, inssPatronal: 0, fgts: 0, ratTerceiros: 0,
                            totalEncargosFolha: 0, totalImpostos2024: 0, totalImpostos2025: 0, cbsEfetiva: null
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
