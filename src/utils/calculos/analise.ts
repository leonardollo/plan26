import { MONTHS, MonthlyData, PeopleData2025, PeopleGoals, PlanData } from '../../types';

export type ScoreEstrategico = PlanData['analysis']['strategicScore'];
export type BonusDeProdutividade = PlanData['analysis']['peopleAnalytics'];

const somaDosMeses = (data: MonthlyData | undefined): number =>
    Object.values(data || {}).reduce((acc: number, val: number | null) => acc + (val || 0), 0);

/**
 * Score estratégico (pontos percentuais somados ao crescimento dos cenários):
 * SWOT, Oceano Azul, tendência de mercado, concentração do portfólio (ABC) e relógio de Bowman.
 */
export const scoreEstrategico = (
    marketAnalysis: PlanData['marketAnalysis'],
    products: PlanData['productPortfolio'],
): ScoreEstrategico => {
    const { swot, blueOcean, marketCompetition, bowmanClockProducts } = marketAnalysis;

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
        const sorted = [...products].sort((a, b) => (b.revenue2025 || 0) - (a.revenue2025 || 0));
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

    return {
        total: swotImpact + blueOceanImpact + marketImpact + abcImpact + clockImpact,
        components: [
            { name: "Análise SWOT", score: swotImpact, weight: 0 },
            { name: "Oceano Azul (Diferenciação)", score: blueOceanImpact, weight: 0 },
            { name: "Tendência de Mercado", score: marketImpact, weight: 0 },
            { name: "Risco de Portfólio (ABC)", score: abcImpact, weight: 0 },
            { name: "Percepção de Valor (Bowman)", score: clockImpact, weight: 0 }
        ],
    };
};

/**
 * Bônus de produtividade (pontos percentuais somados ao crescimento dos cenários):
 * redução de turnover (até 3), ROI de treinamento (até 3) e investimento em T&D sobre a folha (até 2).
 */
export const bonusDeProdutividade = (
    people: PeopleData2025,
    receitaBruta2025: MonthlyData | undefined,
    metas: PeopleGoals,
): BonusDeProdutividade => {
    // Dados de People 2025 (planos antigos podem não ter todos os blocos: roda dentro da carga)
    const headcountValues = Object.values(people?.headcount?.totalColaboradores || {}).filter(v => v !== undefined && v !== null) as number[];
    const headcountMedio = headcountValues.length > 0 ? headcountValues.reduce((a, b) => a + b, 0) / headcountValues.length : 0;
    const totalDesligamentos = somaDosMeses(people?.headcount?.desligamentosVoluntarios) + somaDosMeses(people?.headcount?.desligamentosInvoluntarios);
    const turnoverAtual = headcountMedio > 0 ? (totalDesligamentos / headcountMedio) * 100 : 0;
    const investTD = somaDosMeses(people?.treinamento?.investimentoTD);
    const ganhoTD = somaDosMeses(people?.treinamento?.ganhoTreinamento);
    const roiTreinamentoAtual = investTD > 0 ? ganhoTD / investTD : 0;
    const receitaTotal = MONTHS.reduce((acc, m) => acc + (Number(receitaBruta2025?.[m]) || 0), 0);
    const receitaPorColab = headcountMedio > 0 ? receitaTotal / headcountMedio : 0;

    // Metas 2026
    const metaTurnover = metas?.metaTurnover || 0;
    const metaRoiTD = metas?.metaRoiTreinamento || 0;
    const metaHeadcount = metas?.metaHeadcount || 0;

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
    const folhaTotal = somaDosMeses(people?.custos?.folhaTotalAnual);
    let investTDBonus = 0;
    if (folhaTotal > 0 && investTD > 0) {
        const tdPercentFolha = (investTD / folhaTotal) * 100;
        // Benchmark: empresas top investem 3-5% da folha em T&D
        investTDBonus = tdPercentFolha >= 5 ? 2 : (tdPercentFolha >= 3 ? 1.5 : (tdPercentFolha >= 1 ? 0.5 : 0));
    }

    const productivityGainFactor = Math.round((turnoverBonus + treinamentoBonus + investTDBonus) * 10) / 10;
    return {
        productivityGainFactor,
        projectedRevenue: receitaPorColab * (1 + productivityGainFactor / 100) * (metaHeadcount || headcountMedio),
    };
};
