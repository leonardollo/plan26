
export type Month = 'jan' | 'fev' | 'mar' | 'abr' | 'mai' | 'jun' | 'jul' | 'ago' | 'set' | 'out' | 'nov' | 'dez';
export const MONTHS: Month[] = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MONTH_LABELS: { [key in Month]: string } = {
    jan: 'Janeiro', fev: 'Fevereiro', mar: 'Março', abr: 'Abril', mai: 'Maio', jun: 'Junho',
    jul: 'Julho', ago: 'Agosto', set: 'Setembro', out: 'Outubro', nov: 'Novembro', dez: 'Dezembro'
};

export type View = 'dashboard' | 'settings' | 'import-dpe' | 'data-collection' | 'strategic-analysis' | 'goal-setting' | 'okrs-kpis' | 'commercial-planning' | 'marketing-funnel' | 'action-plan' | 'scenario-planning' | 'financial-planning' | 'plan-summary' | 'monthly-tracking' | 'dre-comparison' | 'taxes' | 'pricing-calculator' | 'report-generator' | 'liquidity-dashboard' | 'financial-ratios' | 'sensitivity-analysis' | 'help-guide';

export type SubscriptionStatus = 'loading' | 'active' | 'inactive' | 'expired' | 'not_found';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'unsaved';

export interface MonthlyData {
  [key: string]: number | null;
}

export interface User {
  uid: string;
  email: string | null;
  name: string | null;
}

export interface CompanyProfile {
    name: string;
    cnpj: string;
    industry: string;
    geminiApiKey: string;
}

export interface FinancialSheetRow {
    values2025: MonthlyData;
}

export interface CustomLineItem extends FinancialSheetRow {
    id: string;
    name: string;
    hint?: string;
}

export interface FinancialSheetData {
    receitaBruta: FinancialSheetRow;
    impostosSobreFaturamento: FinancialSheetRow;
    folhaPagamento: FinancialSheetRow;
    aluguel: FinancialSheetRow;
    despesasOperacionais: FinancialSheetRow;
    marketingFixo: FinancialSheetRow;
    administrativo: FinancialSheetRow;
    customCustosFixos: CustomLineItem[];
    cmv: FinancialSheetRow;
    comissoes: FinancialSheetRow;
    fretes: FinancialSheetRow;
    customCustosVariaveis: CustomLineItem[];
}

export interface CommercialData2025 {
    clientes: {
        totalClientesAtivos: MonthlyData;
        novosClientes: MonthlyData;
        clientesPerdidos: MonthlyData;
    };
    funilComercial: {
        leadsGerados: MonthlyData;
        leadsQualificados: MonthlyData;
        propostasEnviadas: MonthlyData;
        vendasFechadas: MonthlyData;
    };
    pipeline: {
        pipelineAtual: MonthlyData;
        ticketMedioPipeline: MonthlyData;
        cicloVendas: MonthlyData;
    };
}

export interface PeopleData2025 {
    headcount: {
        totalColaboradores: MonthlyData;
        contratacoes: MonthlyData;
        desligamentosVoluntarios: MonthlyData;
        desligamentosInvoluntarios: MonthlyData;
    };
    custos: {
        folhaTotalAnual: MonthlyData;
    };
    treinamento: {
        investimentoTD: MonthlyData;
        horasTreinamento: MonthlyData;
        ganhoTreinamento: MonthlyData; 
    };
    clima: {
        taxaAbsenteismo: MonthlyData;
        eNPS: MonthlyData;
    };
}

export interface MarketingData2025 {
    investimentos: {
        investimentoTotal: MonthlyData;
        midiaPaga: MonthlyData;
        conteudo: MonthlyData;
    };
    performance: {
        impressoes: MonthlyData;
        cliques: MonthlyData;
        conversoes: MonthlyData;
    };
}

export interface InvestmentData2025 {
    capex: {
        maquinasEquipamentos: number | null;
        software: number | null;
        pesquisaDesenvolvimento: number | null;
        totalCapex: number | null;
    };
    workingCapital: { 
        prazoMedioRecebimento: number | null;
        prazoMedioEstocagem: number | null; 
        prazoMedioPagamento: number | null; 
        cicloFinanceiro: number | null; 
    };
    financing: {
        financiamentoCurtoPrazo: number | null;
        financiamentoLongoPrazo: number | null;
        aporteCapital: number | null;
        saldoCaixaFinal2025: number | null; // NEW FIELD
    };
}

export interface ProductPortfolioItem {
    id: string;
    name: string;
    revenue2025: number | null;
    cost2025: number | null;
    quantitySold2025: number | null;
}

export interface MarketCompetitionData {
    tamanhoMercado: number | null;
    taxaCrescimentoMercado: number | null;
    suaParticipacao: number | null; 
    numConcorrentesDiretos: number | null;
    principalConcorrente: string;
    seuDiferencial: string;
}

export interface SWOTData {
    strengths: string;
    strengthsImpact: number;
    weaknesses: string;
    weaknessesImpact: number;
    opportunities: string;
    opportunitiesImpact: number;
    threats: string;
    threatsImpact: number;
}

export interface BlueOceanFactor {
    id: string;
    name: string;
    yourCompanyScore: number | null;
    competitorScore: number | null;
}

export interface BlueOceanFourActions {
    eliminate: string;
    reduce: string;
    raise: string;
    create: string;
}

export interface BlueOceanData {
    factors: BlueOceanFactor[];
    fourActions: BlueOceanFourActions;
}

export interface BowmanClockProduct {
    id: string;
    name: string;
    priceLevel: number | null; 
    perceivedValue: number | null; 
}

export type ActionPlanStatus = 'Não Iniciado' | 'Em Andamento' | 'Concluído' | 'Atrasado';
export type ActionPlanCategory = 'Comercial' | 'Financeiro' | 'Pessoas' | 'Operacional' | 'Marketing' | 'Estratégico';
export type ActionPlanPriority = 'Alta' | 'Média' | 'Baixa';

export interface ActionPlanItem {
    id: string;
    what: string; 
    why: string; 
    who: string; 
    when: string; 
    where: string; 
    how: string; 
    howMuch: number | null; 
    status: ActionPlanStatus;
    category: ActionPlanCategory;
    priority: ActionPlanPriority;
    expectedResult: string;
}

export interface KeyResult {
    id: string;
    name: string;
    startValue: number | null;
    currentValue: number | null; 
    targetValue: number | null;
    unit: 'number' | 'currency' | 'percentage';
}

export interface OKR {
    id: string;
    objective: string;
    keyResults: KeyResult[];
}

export interface KPI {
    id: string;
    name: string;
    value2025: number | null; 
    target2026: number | null;
    unit: 'number' | 'currency' | 'percentage';
}

export interface OkrsAndKpis {
    okrs: OKR[];
    kpis: {
        financeiro: KPI[];
        comercial: KPI[];
        pessoas: KPI[];
        operacoes: KPI[];
    }
}

export interface DemandChannel {
    id: string;
    name: string;
    budget: number | null;
    leads: number | null;
    expectedRevenue: number | null;
}

export interface DemandPlanning {
    channels: DemandChannel[];
    analysis: string;
}

export interface SalesFunnelData {
    workingDays: number | null;
    conversionRateLeadToMql: number | null;
    conversionRateMqlToSql: number | null;
    conversionRateSqlToSale: number | null;
    activitiesPerRep: number | null;
    avgTicket: number | null;
    rampUpTime: number | null; 
}

export interface HiringProjectionItem {
    id: string;
    department: string;
    currentHeadcount: number | null;
    newHires: number | null;
    avgAnnualCost: number | null;
}

export interface DriverBasedPlanningData {
    leadsQualificados: MonthlyData;
    taxaConversao: MonthlyData;
    clientesRecorrentes: MonthlyData;
    ticketMedio: MonthlyData;
}

export interface CommercialPlanning2026 {
    demandPlanning: DemandPlanning;
    salesFunnel: SalesFunnelData;
    funnelSuggestions: string;
    driverBasedPlanning: DriverBasedPlanningData;
}

export interface FinancialPlanSheetRow {
    [key: string]: number | null;
}

export interface DRE2026 {
    [key: string]: FinancialPlanSheetRow;
    receitaBruta: FinancialPlanSheetRow;
    impostosVendas: FinancialPlanSheetRow;
    receitaLiquida: FinancialPlanSheetRow;
    custosVariaveis: FinancialPlanSheetRow;
    outrosCustosVariaveis: FinancialPlanSheetRow; // New aggregated field
    lucroBruto: FinancialPlanSheetRow;
    despesasFolha: FinancialPlanSheetRow;
    despesasMarketing: FinancialPlanSheetRow;
    despesasOperacionais: FinancialPlanSheetRow;
    outrasDespesasFixas: FinancialPlanSheetRow; // New aggregated field
    ebitda: FinancialPlanSheetRow;
    depreciacao: FinancialPlanSheetRow;
    ebit: FinancialPlanSheetRow;
    despesasFinanceiras: FinancialPlanSheetRow;
    lucroAntesImpostos: FinancialPlanSheetRow;
    irpjCsll: FinancialPlanSheetRow;
    lucroLiquido: FinancialPlanSheetRow;
}

export interface DFC2026 {
    [key: string]: FinancialPlanSheetRow;
    fco: FinancialPlanSheetRow;
    fci: FinancialPlanSheetRow;
    fcf: FinancialPlanSheetRow;
    variacaoCaixa: FinancialPlanSheetRow;
    saldoInicialCaixa: FinancialPlanSheetRow;
    saldoFinalCaixa: FinancialPlanSheetRow;
}

export interface BP2026 {
    [key: string]: FinancialPlanSheetRow;
    caixa: FinancialPlanSheetRow;
    contasAReceber: FinancialPlanSheetRow;
    estoques: FinancialPlanSheetRow;
    ativoCirculante: FinancialPlanSheetRow;
    ativoNaoCirculante: FinancialPlanSheetRow;
    totalAtivos: FinancialPlanSheetRow;
    fornecedores: FinancialPlanSheetRow;
    emprestimosCurtoPrazo: FinancialPlanSheetRow;
    passivoCirculante: FinancialPlanSheetRow;
    emprestimosLongoPrazo: FinancialPlanSheetRow;
    passivoNaoCirculante: FinancialPlanSheetRow;
    capitalSocial: FinancialPlanSheetRow;
    lucrosAcumulados: FinancialPlanSheetRow;
    patrimonioLiquido: FinancialPlanSheetRow;
    totalPassivoPL: FinancialPlanSheetRow;
}

export interface FinancialPlan2026 {
    dre: DRE2026;
    dfc: DFC2026;
    bp: BP2026;
}

export interface ScenarioRelatedData {
    decisionTriggers: string;
    strategicActions: string;
    scenarioAnalysis: string;
}

export type ScenarioName = 'Otimista' | 'Conservador' | 'Disruptivo';
export type ScenarioInputMode = 'percentage' | 'manual';

export interface PlanData {
    companyProfile: CompanyProfile;
    financialSheet: FinancialSheetData;
    commercial: CommercialData2025;
    people: PeopleData2025;
    marketing: MarketingData2025;
    investment: InvestmentData2025;
    productPortfolio: ProductPortfolioItem[];
    marketAnalysis: {
        marketCompetition: MarketCompetitionData;
        swot: SWOTData;
        blueOcean: BlueOceanData;
        bowmanClockProducts: BowmanClockProduct[];
    };
    okrsAndKpis: OkrsAndKpis;
    commercialPlanning: CommercialPlanning2026;
    hiringProjection: HiringProjectionItem[];
    actionPlan: ActionPlanItem[];
    financialPlan2026: FinancialPlan2026;
    scenarioRelatedData: {
        'Otimista': ScenarioRelatedData;
        'Conservador': ScenarioRelatedData;
        'Disruptivo': ScenarioRelatedData;
    };
    scenariosInputMode: {
        [key in ScenarioName]: ScenarioInputMode;
    };
    analysis: {
        benchmarkAnalysis: string;
        strategicSummary: string;
        diagnosisReportAnalysis: string | null;
        planReportAnalysis: string | null;
        marketingFunnelAnalysis: string;
        strategicScore: {
            total: number;
            components: { name: string; score: number; weight: number; }[];
        };
        peopleAnalytics: {
            productivityGainFactor: number;
            projectedRevenue: number;
        };
    };
}

export interface FinancialGoals {
    metaReceita: MonthlyData;
    metaMargemEbitda: number | null;
    metaLucroLiquido: number | null;
}

export interface CommercialGoals {
    metaNumClientes: MonthlyData;
    metaTicketMedio: number | null;
    metaTaxaConversao: number | null;
}

export interface PeopleGoals {
    metaHeadcount: number | null;
    metaTurnover: number | null;
    metaInvestimentoTD: number | null;
    metaRoiTreinamento: number | null;
    metaAbsenteismo: number | null;
}

export interface StrategicObjectives {
    objective1: string;
    objective2: string;
    objective3: string;
}

export interface Goals2026 {
    inflacaoPrevista: number | null;
    financeiras: FinancialGoals;
    comerciais: CommercialGoals;
    pessoas: PeopleGoals;
    objetivosEstrategicos: StrategicObjectives;
}

export interface CustomProjectionLineItem {
    id: string;
    name: string;
    values: MonthlyData;
}

export interface ScenarioProjectionData {
    receitaBruta: MonthlyData;
    impostosSobreFaturamento: MonthlyData;
    folhaPagamento: MonthlyData;
    aluguel: MonthlyData;
    despesasOperacionais: MonthlyData;
    marketingFixo: MonthlyData;
    administrativo: MonthlyData;
    customCustosFixos: CustomProjectionLineItem[];
    cmv: MonthlyData;
    comissoes: MonthlyData;
    fretes: MonthlyData;
    customCustosVariaveis: CustomProjectionLineItem[];
}

export interface ScenarioData {
    growthPercentage: number | null;
    projection: ScenarioProjectionData;
    receitaProjetada: MonthlyData;
    custosProjetados: MonthlyData; 
    despesasProjetadas: MonthlyData; 
}

export interface Scenarios2026 {
    'Otimista': ScenarioData;
    'Conservador': ScenarioData;
    'Disruptivo': ScenarioData;
}

export interface MonthlyTrackingData {
    receitaRealizada: number | null;
    custosRealizados: number | null;
    despesasRealizadas: number | null;
    analysisText: string | null;
    [key: string]: number | string | null; 
}

export interface Tracking2026 {
    [key: string]: MonthlyTrackingData;
}

export interface ImageEditResult {
  original: string;
  edited: string;
}

export interface TaxesData {
    regimeTributario: string;
    anexoSimples: string;
    aliquotaEfetiva: number | null;
    simplesNacional: number | null;
    iss: number | null;
    icms: number | null;
    pis: number | null;
    cofins: number | null;
    irpj: number | null;
    csll: number | null;
    inssPatronal: number | null;
    fgts: number | null;
    ratTerceiros: number | null;
    totalEncargosFolha: number | null;
    totalImpostos2024: number | null;
    totalImpostos2025: number | null;
}

export interface Summary2025 {
    receitaTotal: number;
    receitaBrutaTotal: number;
    custosTotal: number;
    custosVariaveisTotal: number;
    cmvTotal: number;
    custosFixosTotal: number; 
    margemContribuicao: number;
    margemContribuicaoPercent: number;
    margemBruta: number;
    margemBrutaPercent: number;
    despesasTotal: number;
    ebitda: number;
    margemEbitda: number;
    novosClientesTotal: number;
    ticketMedio: number;
    taxaRetencao: number;
    taxaConversaoLeadCliente: number;
    classARevenuePercent: number;
    headcountFinal: number;
    headcountMedio: number;
    turnoverPercent: number;
    salarioMedioMensal: number;
    custoColaboradorAno: number;
    roiTreinamento: number;
    investimentoMarketingTotal: number;
    cac: number;
    ltv: number;
    relacaoLtvCac: number;
    roiMarketing: number;
    /** Receita MENSAL mínima para não dar prejuízo. */
    pontoEquilibrioContabil: number;
    /** Falso quando não há leads/vendas para calcular conversão — não exibir 0%. */
    temBaseConversao: boolean;
    /** Falso quando não há clientes perdidos para calcular retenção — não exibir 0%. */
    temBaseRetencao: boolean;
    pontoEquilibrioFinanceiro: number;
    roas: number;
    monthlySummary: {
        month: string;
        receita: number;
        custos: number;
        custosVariaveis: number; // Added
        custosFixos: number;     // Added
        ebitda: number;
    }[];
}

// --- PRICING MODULE TYPES (ROBUST & BEHAVIORAL) ---
export interface PricingFunnelRates {
    // For Negotiated Sales
    leadToConversation: number; // %
    conversationToMeeting: number; // %
    meetingToProposal: number; // %
    proposalToSale: number; // %
    
    // For Direct Sales
    trafficToCart: number; // % (Traffic -> Interested)
    cartToSale: number; // % (Interested -> Client)
}

export interface DetailedCostBreakdown {
    // Products
    purchasePrice: number; // Preço de Compra/Produção
    inboundFreight: number; // Frete Entrada
    packaging: number; // Embalagem
    otherDirectCosts: number; // Outros

    // Services
    hourlyRate: number; // Custo Hora Técnico
    hoursSpent: number; // Horas Gastas
    softwareCosts: number; // Softwares/Licenças
    travelCosts: number; // Deslocamento
    thirdPartyService: number; // New: Terceirizados
    materials: number; // New: Materiais de Consumo
}

export interface PricingItem {
    id: string;
    name: string;
    type: 'product' | 'service';
    salesModel: 'direct' | 'consultative'; // Novo: Define se é balcão/ecommerce ou negociação
    estimatedMonthlyVolume: number; // Novo: Previsão de Vendas (Unidades) para cálculo de Mix
    
    // Inputs Financial Detailed
    detailedCosts: DetailedCostBreakdown;
    directCost: number; // Calculated Total from details
    
    markupTarget: number; // Margem de lucro desejada (%)
    
    // Calculated Factors (Stored for reference/overrides)
    taxRate: number; // From Taxes module
    variableCostRate: number; // Comissions + Card fees + Others
    fixedCostRate: number; // Rateio de custos fixos
    
    // Inputs Behavioral / Operational
    behavioralScore: number; // 1-10 (Discipline, Focus)
    funnelRates: PricingFunnelRates; // Specific funnel for this product/service
    workingDays: number;
    
    // Outputs
    suggestedPrice: number;
    finalPrice: number; // User decided
    contributionMargin: number; // R$
    contributionMarginPercent: number; // %
    netProfit: number; // R$
    netProfitPercent: number; // %
    
    // Break-even Outputs (Item Specific)
    breakEvenUnits: number;
    breakEvenRevenue: number;
}

// --- CFO MODULE TYPES ---

export interface LiquidityMetrics {
    monthlyNCG: MonthlyData; 
    cashBurnRate: number; 
    runwayMonths: number; 
    cashBalanceProjection: MonthlyData;
    cycleSummary: {
        pmr: number;
        pme: number;
        pmp: number;
        financialCycle: number;
    };
}

export interface FinancialKPIs {
    liquidity: {
        currentRatio: number; 
        quickRatio: number; 
        cashRatio: number; 
    };
    solvency: {
        debtToEbitda: number; 
        debtToEquity: number; 
    };
    profitability: {
        roe: number; 
        roic: number; 
        netMargin: number;
    };
    efficiency: {
        cacPayback: number; 
        assetTurnover: number; 
    }
}

export interface SensitivityScenario {
    priceChange: number;
    volumeChange: number;
    revenue: number;
    ebit: number;
    netProfit: number;
    margin: number;
}

export type SensitivityMatrix = SensitivityScenario[][];

export interface PlanContextType {
    /** Traz para o PLAN o que o cliente respondeu no diagnóstico (DPE-GI). */
    aplicarImportacaoDpe: (patch: import('./services/dpeImport').PatchPlano, metas: Partial<Goals2026>) => void;
    planData: PlanData;
    goals2026: Goals2026;
    scenarios2026: Scenarios2026;
    tracking2026: Tracking2026;
    taxes: TaxesData,
    baseScenario: ScenarioName;
    summary2025: Summary2025,
    progressStatus: { [key in View]: { status: 'completed' | 'inprogress' | 'notstarted', percentage: number } };
    subscriptionStatus: SubscriptionStatus;
    
    // Pricing
    pricingItems: PricingItem[];
    addPricingItem: (item: PricingItem) => void;
    updatePricingItem: (id: string, item: Partial<PricingItem>) => void;
    removePricingItem: (id: string) => void;

    // Save System
    saveStatus: SaveStatus;
    saveDataNow: () => Promise<void>;
    lastSaved: Date | null;

    // CFO Indicators
    financialIndicators: {
        liquidity: LiquidityMetrics;
        ratios: FinancialKPIs;
    };
    calculateSensitivityAnalysis: (baseRevenue: number, baseVariableCost: number, baseFixedCost: number, range: number) => SensitivityMatrix;

    recalculateAllScenarios: () => void;
    recalculateScenario: (scenario: ScenarioName) => void;
    applyTaxesTo2025: () => void;
    updateCompanyProfile: (field: keyof CompanyProfile, value: string) => void;
    updateSheetValue: (rowKey: keyof FinancialSheetData, month: Month, value: string) => void;
    updateSheetAllValues: (rowKey: keyof FinancialSheetData, newValues: MonthlyData) => void;
    updateCustomItem: (type: 'customCustosFixos' | 'customCustosVariaveis', id: string, field: 'name' | 'hint' | Month, value: string) => void;
    updateCustomItemAllValues: (type: 'customCustosFixos' | 'customCustosVariaveis', id: string, newValues: MonthlyData) => void;
    addCustomItem: (type: 'customCustosFixos' | 'customCustosVariaveis') => void;
    removeCustomItem: (type: 'customCustosFixos' | 'customCustosVariaveis', id: string) => void;
    importFinancialDataFromTsv: (tsvData: string) => void;
    updateCommercialData: (section: keyof CommercialData2025, metric: string, month: Month, value: string) => void;
    updatePeopleData: (section: keyof PeopleData2025, metric: string, month: Month, value: string) => void;
    updateMarketingData: (section: keyof MarketingData2025, metric: string, month: Month, value: string) => void;
    updateInvestmentData: (section: keyof InvestmentData2025, metric: string, value: string) => void;
    updateProductPortfolioItem: (id: string, field: keyof Omit<ProductPortfolioItem, 'id'>, value: string) => void;
    addProductPortfolioItem: () => void;
    removeProductPortfolioItem: (id: string) => void;
    updateMarketCompetitionData: (field: keyof MarketCompetitionData, value: string) => void;
    updateSWOTData: (field: keyof SWOTData, value: string) => void;
    updateSwotImpact: (field: keyof Pick<SWOTData, 'strengthsImpact' | 'weaknessesImpact' | 'opportunitiesImpact' | 'threatsImpact'>, value: number) => void;
    updateBlueOceanFactor: (id: string, field: keyof Omit<BlueOceanFactor, 'id'>, value: string) => void;
    addBlueOceanFactor: () => void;
    removeBlueOceanFactor: (id: string) => void;
    updateBlueOceanFourActions: (field: keyof BlueOceanFourActions, value: string) => void;
    updateBowmanClockProduct: (id: string, field: keyof Omit<BowmanClockProduct, 'id'>, value: string) => void;
    addBowmanClockProduct: () => void;
    removeBowmanClockProduct: (id: string) => void;
    generateOkrKpiSuggestions: () => Promise<void>;
    addOkr: () => void;
    updateOkr: (okrId: string, value: string) => void;
    removeOkr: (okrId: string) => void;
    addKeyResult: (okrId: string) => void;
    updateKeyResult: (okrId: string, krId: string, field: keyof Omit<KeyResult, 'id'>, value: string) => void;
    removeKeyResult: (okrId: string, krId: string) => void;
    addKpi: (department: keyof OkrsAndKpis['kpis']) => void;
    updateKpi: (department: keyof OkrsAndKpis['kpis'], kpiId: string, field: keyof Omit<KPI, 'id' | 'value2025'>, value: string) => void;
    removeKpi: (department: keyof OkrsAndKpis['kpis'], kpiId: string) => void;
    updateCommercialPlanning: (section: 'salesFunnel', field: keyof SalesFunnelData, value: string) => void;
    addDemandChannel: () => void;
    removeDemandChannel: (id: string) => void;
    updateDemandChannel: (id: string, field: keyof Omit<DemandChannel, 'id'>, value: string) => void;
    generateChannelAnalysis: () => Promise<void>;
    updateDriverBasedPlanning: (metric: keyof DriverBasedPlanningData, month: Month, value: string) => void;
    updateHiringProjectionItem: (id: string, field: keyof Omit<HiringProjectionItem, 'id'>, value: string) => void;
    addHiringProjectionItem: () => void;
    removeHiringProjectionItem: (id: string) => void;
    generateFunnelSuggestions: () => Promise<void>;
    generateMarketingFunnelAnalysis: (funnel2025: any, funnel2026: any) => Promise<void>;
    addActionPlanItem: () => void;
    removeActionPlanItem: (id: string) => void;
    updateActionPlanItem: (id: string, field: keyof Omit<ActionPlanItem, 'id'>, value: string) => void;
    generateGoalSuggestions: () => Promise<void>;
    updateGoal: (category: keyof Omit<Goals2026, 'inflacaoPrevista' | 'objetivosEstrategicos'>, metric: string, value: string, month?: Month) => void;
    updateObjective: (metric: keyof StrategicObjectives, value: string) => void;
    updateInflation: (value: string) => void;
    updateScenarioGrowthPercentage: (scenario: ScenarioName, value: string) => void;
    updateScenarioInputMode: (scenario: ScenarioName, mode: ScenarioInputMode) => void;
    updateScenarioManualValue: (scenario: ScenarioName, metricKey: keyof Omit<ScenarioData, 'growthPercentage'>, month: Month, value: string) => void;
    updateScenarioProjectionValue: (scenario: ScenarioName, rowKey: keyof ScenarioProjectionData, month: Month, value: string) => void;
    updateScenarioProjectionAllValues: (scenario: ScenarioName, rowKey: keyof ScenarioProjectionData, newValues: MonthlyData) => void;
    updateScenarioCustomItem: (scenario: ScenarioName, type: 'customCustosFixos' | 'customCustosVariaveis', id: string, field: 'name' | Month, value: string) => void;
    updateScenarioCustomItemAllValues: (scenario: ScenarioName, type: 'customCustosFixos' | 'customCustosVariaveis', id: string, newValues: MonthlyData) => void;
    addScenarioCustomItem: (scenario: ScenarioName, type: 'customCustosFixos' | 'customCustosVariaveis') => void;
    removeScenarioCustomItem: (scenario: ScenarioName, type: 'customCustosFixos' | 'customCustosVariaveis', id: string) => void;
    applyWhatIfSimulation: (type: 'ticket' | 'hires' | 'marketing', value: number) => void;
    updateDecisionTrigger: (scenario: ScenarioName, value: string) => void;
    updateStrategicAction: (scenario: ScenarioName, value: string) => void;
    generateDecisionTriggers: (scenario: ScenarioName) => Promise<void>;
    getScenarioAnalysis: () => Promise<void>;
    getStrategicScoreAnalysis: (scenarioName: ScenarioName) => Promise<void>;
    calculateFinancialPlan2026: () => void;
    setBaseScenario: (scenario: ScenarioName) => void;
    updateTracking2026: (month: Month, field: keyof Tracking2026['jan'] | string, value: string) => void;
    updateTaxes: (field: keyof TaxesData, value: string) => void;
    generateBenchmarkAnalysis: () => Promise<void>;
    generateStrategicSummaryAndActions: () => Promise<void>;
    generateMonthlyAnalysis: (month: Month) => Promise<void>;
    generateDiagnosisReport: () => Promise<void>;
    generatePlanReport: () => Promise<void>;
    checkSubscription: () => Promise<void>;
    resetAllData: () => Promise<void>;
}
