
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { PlanData, Summary2025, FinancialGoals, CommercialGoals, PeopleGoals, SalesFunnelData, ScenarioName, Scenarios2026, ScenarioData, OKR, KPI, Goals2026, CompanyProfile, DemandChannel, ActionPlanItem, FinancialPlanSheetRow, MonthlyData } from '../types';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';

const sumMonthlyData = (data: MonthlyData): number => data ? Object.values(data).reduce((sum, val) => sum + (Number(val) || 0), 0) : 0;

const getAI = () => {
    // Priority: 
    // 1. Valid Environment Variable (System) IF it's not a placeholder
    // 2. Local Storage (synced with Firebase via Settings)
    
    let apiKey = import.meta.env.VITE_API_KEY as string | undefined;
    
    // Check if env var is missing, empty, or a known placeholder from some build systems
    if (!apiKey || apiKey.trim() === '' || apiKey === 'undefined' || apiKey === 'null' || apiKey.includes('YOUR_API_KEY')) {
        // localStorage is kept in sync with Firebase by Settings.tsx
        apiKey = localStorage.getItem('google_gemini_api_key') || '';
    }
    
    if (!apiKey || apiKey.trim() === '') {
        throw new Error("Chave de API do Google (Gemini) não encontrada. Por favor, vá em Configurações e insira sua chave de API.");
    }
    return new GoogleGenAI({ apiKey: apiKey.trim() });
};

// --- RETRY HELPER ---
// Handles 503 (Overloaded) and 429 (Quota) errors by waiting and retrying
async function withRetry<T>(operation: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        const msg = error?.message || JSON.stringify(error);
        const code = error?.status || error?.code;
        
        const isOverloaded = msg.includes('503') || msg.includes('Overloaded') || code === 503;
        const isRateLimit = msg.includes('429') || msg.includes('quota') || code === 429;
        
        if ((isOverloaded || isRateLimit) && retries > 0) {
            console.warn(`Gemini API busy/quota (${retries} retries left). Waiting ${initialDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, initialDelay));
            // Exponential backoff: 2s -> 4s -> 8s
            return withRetry(operation, retries - 1, initialDelay * 2);
        }
        throw error;
    }
}

export const editImageWithText = async (
    base64ImageData: string,
    mimeType: string,
    prompt: string
): Promise<string> => {
    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        {
                            inlineData: {
                                data: base64ImageData,
                                mimeType: mimeType,
                            },
                        },
                        {
                            text: prompt,
                        },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return part.inlineData.data;
            }
        }

        throw new Error("Nenhuma imagem foi retornada pelo modelo.");
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao se comunicar com a API do Gemini: ${errorMessage}`);
    }
};

export interface CnpjData {
    razaoSocial: string;
    nomeFantasia: string;
    cnaeDescricao: string;
    cnaeCodigo: string;
    porte: string;
    naturezaJuridica: string;
    municipio: string;
    uf: string;
    capitalSocial: number;
    dataAbertura: string;
    situacao: string;
}

export interface MarketResearchResult {
    cnpjData: CnpjData;
    marketAnalysis: string;
}

const fetchCnpjFromBrasilAPI = async (cnpj: string): Promise<CnpjData> => {
    const cleanCnpj = cnpj.replace(/[^\d]/g, '');
    if (cleanCnpj.length !== 14) throw new Error('CNPJ deve ter 14 digitos.');
    
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    if (!response.ok) {
        if (response.status === 404) throw new Error('CNPJ nao encontrado na base da Receita Federal.');
        throw new Error(`Erro ao consultar CNPJ: ${response.status}`);
    }
    const data = await response.json();
    return {
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || '',
        cnaeDescricao: data.cnae_fiscal_descricao || '',
        cnaeCodigo: String(data.cnae_fiscal || ''),
        porte: data.porte || data.descricao_porte || '',
        naturezaJuridica: data.natureza_juridica || '',
        municipio: data.municipio || '',
        uf: data.uf || '',
        capitalSocial: data.capital_social || 0,
        dataAbertura: data.data_inicio_atividade || '',
        situacao: data.descricao_situacao_cadastral || data.situacao_cadastral || '',
    };
};

export const getIndustryFromCnpj = async (cnpj: string): Promise<string> => {
    try {
        const cnpjData = await fetchCnpjFromBrasilAPI(cnpj);
        return cnpjData.cnaeDescricao;
    } catch {
        // Fallback: usar Gemini com Google Search
        const prompt = `
            Pesquise na internet pelo CNPJ a seguir e retorne APENAS a descricao do CNAE principal.
            Nao inclua o codigo do CNAE, apenas a descricao da atividade principal.
            Seja direto e retorne apenas o texto da descricao.
            CNPJ: ${cnpj}
        `;
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { tools: [{ googleSearch: {} }] },
            });
        });
        return response.text;
    }
};

export const getMarketResearchFromCnpj = async (cnpj: string): Promise<MarketResearchResult> => {
    // Step 1: Buscar dados oficiais do CNPJ
    const cnpjData = await fetchCnpjFromBrasilAPI(cnpj);
    
    // Step 2: Usar Gemini com Google Search para análise de mercado regional
    const prompt = `
Voce e um consultor estrategico de nivel CEO/CFO. Com base nos dados oficiais abaixo de uma empresa brasileira, faca uma ANALISE DE MERCADO REGIONAL completa.

DADOS DA EMPRESA:
- Razao Social: ${cnpjData.razaoSocial}
- Nome Fantasia: ${cnpjData.nomeFantasia}
- CNAE: ${cnpjData.cnaeCodigo} - ${cnpjData.cnaeDescricao}
- Porte: ${cnpjData.porte}
- Municipio/UF: ${cnpjData.municipio}/${cnpjData.uf}
- Capital Social: R$ ${cnpjData.capitalSocial?.toLocaleString('pt-BR')}
- Data de Abertura: ${cnpjData.dataAbertura}

PESQUISE NA INTERNET e faca uma analise completa cobrindo:

1. **TAMANHO DO MERCADO**: Estime o tamanho do mercado (TAM, SAM, SOM) para o setor ${cnpjData.cnaeDescricao} na regiao de ${cnpjData.municipio}/${cnpjData.uf} e no Rio Grande do Sul. Use dados reais de pesquisas, IBGE, SEBRAE, associacoes setoriais.

2. **CRESCIMENTO DO SETOR**: Taxa de crescimento anual do setor nos ultimos 3 anos e projecao para 2026. Cite fontes.

3. **CONCORRENCIA REGIONAL**: Quantos concorrentes diretos existem na regiao? Quais sao os principais? Qual o nivel de concentracao do mercado?

4. **OPORTUNIDADES**: Identifique pelo menos 3 oportunidades concretas para uma empresa deste porte e setor na regiao. Considere tendencias de mercado, gaps de mercado, demanda reprimida.

5. **AMEACAS E RISCOS**: Principais riscos do setor na regiao (regulatorios, economicos, concorrenciais).

6. **BENCHMARKS DO SETOR**: Margem de lucro media, ticket medio, taxa de crescimento tipica, numero medio de funcionarios para empresas similares.

7. **RECOMENDACOES ESTRATEGICAS**: 3 a 5 acoes concretas que o empresario deveria considerar para 2026.

Formate a resposta em Markdown com titulos claros. Seja especifico com numeros e dados. Cite fontes quando possivel.
Escreva em portugues brasileiro.
`;

    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });
        });
        return {
            cnpjData,
            marketAnalysis: response.text || 'Analise nao disponivel.',
        };
    } catch (error) {
        console.error("Error calling Gemini API for market research:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar analise de mercado: ${errorMessage}`);
    }
};


export const getTaxRecommendation = async (cnpj: string, regimeTributario: string, aliquotaEfetiva: number, receitaBruta: number): Promise<string> => {
    const cnpjData = await fetchCnpjFromBrasilAPI(cnpj);
    
    const prompt = `
Voce e um especialista em planejamento tributario e engenharia contabil no Brasil. Com base nos dados abaixo, faca uma ANALISE TRIBUTARIA PERSONALIZADA e de recomendacoes praticas.

DADOS DA EMPRESA:
- Razao Social: ${cnpjData.razaoSocial}
- Nome Fantasia: ${cnpjData.nomeFantasia}
- CNAE: ${cnpjData.cnaeCodigo} - ${cnpjData.cnaeDescricao}
- Porte: ${cnpjData.porte}
- Natureza Juridica: ${cnpjData.naturezaJuridica}
- Municipio/UF: ${cnpjData.municipio}/${cnpjData.uf}
- Capital Social: R$ ${cnpjData.capitalSocial?.toLocaleString('pt-BR')}
- Data de Abertura: ${cnpjData.dataAbertura}

DADOS TRIBUTARIOS ATUAIS:
- Regime Tributario: ${regimeTributario}
- Aliquota Efetiva Atual: ${aliquotaEfetiva.toFixed(2).replace('.', ',')}%
- Receita Bruta Anual Estimada: R$ ${receitaBruta.toLocaleString('pt-BR')}

CONTEXTO 2026-2027:
- Reforma Tributaria em transicao (EC 132/2023, LC 214/2025)
- 2026: Fase de testes com aliquota 1% (0,9% CBS + 0,1% IBS)
- 2027: Extincao de PIS/COFINS, CBS com aliquota cheia (~8,8%)
- Split Payment obrigatorio a partir de 2027
- Ajuste fiscal do governo com ampliacao da base tributavel
- Simples Nacional com regime hibrido opcional (setembro/2026)

ANALISE E RECOMENDE:

1. **DIAGNOSTICO DO REGIME ATUAL**: O regime ${regimeTributario} e o mais adequado para esta empresa considerando CNAE, porte e faturamento? Compare com os outros regimes.

2. **IMPACTO DA REFORMA**: Como a Reforma Tributaria vai impactar especificamente este CNAE (${cnpjData.cnaeDescricao})? O setor vai pagar mais ou menos? Quanto aproximadamente?

3. **SIMPLES NACIONAL HIBRIDO**: Se a empresa esta no Simples, vale a pena aderir ao regime hibrido (recolher CBS/IBS separadamente para gerar creditos)? Analise o caso especifico.

4. **OPORTUNIDADES DE ECONOMIA**: Identifique pelo menos 3 oportunidades concretas de reducao de carga tributaria para esta empresa, considerando:
   - Creditos tributarios disponiveis no novo sistema
   - Beneficios fiscais regionais (${cnpjData.uf})
   - Incentivos setoriais para o CNAE ${cnpjData.cnaeCodigo}
   - Reestruturacao societaria se aplicavel

5. **PLANO DE ACAO TRIBUTARIO**: Cronograma com acoes especificas para 2026 (preparacao) e 2027 (transicao), com prazos e prioridades.

6. **ALERTAS**: Riscos tributarios especificos para este tipo de empresa que o empresario deve ficar atento.

Formate em Markdown com titulos claros, bullets e destaques em negrito. Seja especifico e pratico. Use dados reais quando possivel.
Escreva em portugues brasileiro.
`;

    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });
        });
        return response.text || 'Analise nao disponivel.';
    } catch (error) {
        console.error("Error calling Gemini API for tax recommendation:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar recomendacao tributaria: ${errorMessage}`);
    }
};

export const getGoalSuggestions = async (planData: PlanData, summary: Summary2025): Promise<{ financeiras: FinancialGoals, comerciais: CommercialGoals, pessoas: PeopleGoals }> => {
    const { companyProfile, marketAnalysis } = planData;

    const prompt = `
        Você é um consultor de estratégia de negócios de classe mundial. Com base nos seguintes dados de uma empresa, forneça sugestões de metas realistas e ambiciosas para o próximo ano (2026).

        Perfil da Empresa:
        - Nome: ${companyProfile.name || 'Não informado'}
        - Ramo de Atividade: ${companyProfile.industry || 'Não informado'}

        Resumo do Desempenho em 2025:
        - Receita Total: ${formatCurrency(summary.receitaTotal)}
        - Margem EBITDA: ${formatPercentage(summary.margemEbitda)}
        - Novos Clientes: ${formatNumber(summary.novosClientesTotal)}
        - Ticket Médio: ${formatCurrency(summary.ticketMedio)}
        - Market Share: ${formatPercentage(marketAnalysis.marketCompetition.suaParticipacao)}
        - Headcount Final: ${formatNumber(summary.headcountFinal)}
        - Turnover Anual: ${formatPercentage(summary.turnoverPercent)}

        Contexto Estratégico:
        - Taxa de Crescimento do Setor: ${formatPercentage(marketAnalysis.marketCompetition.taxaCrescimentoMercado)}
        - Principal Força da Empresa (SWOT): ${marketAnalysis.swot.strengths.split('\n')[0] || 'Não informada'}

        Com base nisso, gere um objeto JSON com metas para 2026 para as seguintes categorias: 'financeiras', 'comerciais' e 'pessoas'.
        Seja otimista, mas realista. A meta de receita deve considerar a taxa de crescimento do setor e o desempenho passado da empresa. As outras métricas devem estar alinhadas com a meta de receita.
        Retorne apenas números nos campos, sem formatação de moeda ou percentual.
    `;

    // Helper to generate monthly properties schema to avoid "should be non-empty for OBJECT type" error
    const monthlyProperties: any = {};
    ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'].forEach(m => {
        monthlyProperties[m] = { type: Type.NUMBER };
    });

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            financeiras: {
                type: Type.OBJECT,
                properties: {
                    metaReceita: { type: Type.OBJECT, properties: monthlyProperties }, // Added properties
                    metaMargemEbitda: { type: Type.NUMBER },
                    metaLucroLiquido: { type: Type.NUMBER },
                },
            },
            comerciais: {
                type: Type.OBJECT,
                properties: {
                    metaNumClientes: { type: Type.OBJECT, properties: monthlyProperties }, // Added properties
                    metaTicketMedio: { type: Type.NUMBER },
                    metaTaxaConversao: { type: Type.NUMBER },
                },
            },
            pessoas: {
                type: Type.OBJECT,
                properties: {
                    metaHeadcount: { type: Type.NUMBER },
                    metaTurnover: { type: Type.NUMBER },
                    metaInvestimentoTD: { type: Type.NUMBER },
                },
            },
        },
    };

    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });
        });
        
        const text = response.text;
        if (!text) {
            throw new Error("A IA retornou uma resposta vazia ou inválida.");
        }
        const jsonText = text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error calling Gemini API for goal suggestions:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar sugestões com a IA: ${errorMessage}`);
    }
};

export const getOkrKpiSuggestions = async (planData: PlanData, goals: Goals2026, summary: Summary2025): Promise<{ okrs: OKR[], kpis: { financeiro: KPI[], comercial: KPI[], pessoas: KPI[], operacoes: KPI[] } }> => {
    const { companyProfile } = planData;
    const { financeiras, comerciais, pessoas } = goals;

    const prompt = `
        Você é um consultor de estratégia e performance de classe mundial. Com base nos dados da empresa, sugira OKRs (Objectives and Key Results) estratégicos para o ano e KPIs (Key Performance Indicators) departamentais relevantes.

        Perfil da Empresa:
        - Ramo de Atividade: ${companyProfile.industry || 'Não informado'}

        Principais Metas para 2026:
        - Aumentar a Receita para ${formatCurrency(sumMonthlyData(financeiras.metaReceita))}.
        - Atingir ${formatPercentage(financeiras.metaMargemEbitda)} de Margem EBITDA.
        - Conquistar ${formatNumber(sumMonthlyData(comerciais.metaNumClientes))} novos clientes.
        - Aumentar o headcount para ${formatNumber(pessoas.metaHeadcount)} colaboradores.

        Desempenho de 2025 (para referência):
        - Receita: ${formatCurrency(summary.receitaTotal)}
        - Margem EBITDA: ${formatPercentage(summary.margemEbitda)}

        Gere um objeto JSON estrito com a seguinte estrutura:
        {
            "okrs": [
                {
                    "objective": "string",
                    "keyResults": [
                        { "name": "string", "startValue": number, "targetValue": number, "unit": "number" | "currency" | "percentage" }
                    ]
                }
            ],
            "kpis": {
                "financeiro": [ { "name": "string", "target2026": number, "unit": "number" | "currency" | "percentage" } ],
                "comercial": [ ... ],
                "pessoas": [ ... ],
                "operacoes": [ ... ]
            }
        }

        Importante: O campo 'unit' DEVE ser estritamente uma das strings: "number", "currency", ou "percentage". Não use outras palavras.
    `;

    const kpiSchema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            target2026: { type: Type.NUMBER },
            unit: { type: Type.STRING, enum: ['number', 'currency', 'percentage'] },
        },
        required: ['name', 'target2026', 'unit']
    };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            okrs: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        objective: { type: Type.STRING },
                        keyResults: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    startValue: { type: Type.NUMBER },
                                    targetValue: { type: Type.NUMBER },
                                    unit: { type: Type.STRING, enum: ['number', 'currency', 'percentage'] },
                                },
                                required: ['name', 'startValue', 'targetValue', 'unit']
                            }
                        }
                    },
                    required: ['objective', 'keyResults']
                }
            },
            kpis: {
                type: Type.OBJECT,
                properties: {
                    financeiro: { type: Type.ARRAY, items: kpiSchema },
                    comercial: { type: Type.ARRAY, items: kpiSchema },
                    pessoas: { type: Type.ARRAY, items: kpiSchema },
                    operacoes: { type: Type.ARRAY, items: kpiSchema },
                },
                required: ['financeiro', 'comercial', 'pessoas', 'operacoes']
            }
        },
        required: ['okrs', 'kpis']
    };

    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });
        });
        
        const text = response.text;
        if (!text) {
            throw new Error("A IA retornou uma resposta vazia ou inválida.");
        }
        const jsonText = text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error calling Gemini API for OKR/KPI suggestions:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar sugestões de OKRs e KPIs com a IA: ${errorMessage}`);
    }
};

export const getFunnelSuggestions = async (funnel: SalesFunnelData, revenueGoal?: number): Promise<string> => {
    const prompt = `
        Você é um especialista em otimização de funil de vendas (growth hacking). Analise os seguintes dados de um funil de vendas e a meta de receita para 2026.

        Dados do Funil de Vendas Simulado:
        - Meta de Receita Anual: ${revenueGoal ? formatCurrency(revenueGoal) : 'Não definida'}
        - Ticket Médio por Venda: ${formatCurrency(funnel.avgTicket)}
        - Taxa de Conversão (Lead > MQL): ${formatPercentage(funnel.conversionRateLeadToMql)}
        - Taxa de Conversão (MQL > SQL): ${formatPercentage(funnel.conversionRateMqlToSql)}
        - Taxa de Conversão (SQL > Venda): ${formatPercentage(funnel.conversionRateSqlToSale)}
        - Atividades por Vendedor por Dia (ex: prospecções): ${formatNumber(funnel.activitiesPerRep)}

        Com base nestes dados, forneça sugestões práticas e criativas para otimizar este funil e atingir a meta.
        Estruture sua resposta em tópicos, focando em:
        1.  **Alavancas de Otimização:** Onde está o maior gargalo (a menor taxa de conversão)? Que ações podem ser tomadas para melhorar cada etapa do funil?
        2.  **Qualidade vs. Quantidade:** A empresa deve focar em gerar mais leads (topo do funil) ou em melhorar a qualificação e conversão (meio/fundo do funil)?
        3.  **Análise Crítica:** Existe algum ponto de atenção óbvio neste funil? (ex: taxa de conversão geral muito baixa, necessidade de muitos leads para uma venda).

        Seja direto, prático e forneça ideias acionáveis. A resposta deve ser em texto corrido com quebras de linha.
    `;

    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for funnel suggestions:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar sugestões de funil com a IA: ${errorMessage}`);
    }
};

export const getChannelMixAnalysis = async (companyProfile: CompanyProfile, channels: DemandChannel[]): Promise<string> => {
    const totalBudget = channels.reduce((sum, ch) => sum + (ch.budget || 0), 0);
    const totalLeads = channels.reduce((sum, ch) => sum + (ch.leads || 0), 0);
    
    const channelsSummary = channels.map(ch => {
        const cpl = ch.leads && ch.leads > 0 ? (ch.budget || 0) / ch.leads : 0;
        const roi = ch.budget && ch.budget > 0 ? ((ch.expectedRevenue || 0) - ch.budget) / ch.budget : 0;
        return `- Canal: ${ch.name}, Orçamento: ${formatCurrency(ch.budget)}, Leads: ${formatNumber(ch.leads)}, CPL: ${formatCurrency(cpl)}, ROI: ${formatNumber(roi)}x`;
    }).join('\n');

    const prompt = `
        Você é um especialista em marketing digital e growth. Analise o seguinte mix de canais de aquisição para a empresa '${companyProfile.name}', que atua no ramo de '${companyProfile.industry}'.

        Planejamento de Demanda:
        ${channelsSummary}

        Total de Orçamento: ${formatCurrency(totalBudget)}
        Total de Leads: ${formatNumber(totalLeads)}

        Com base nestes dados:
        1.  **Análise do Mix de Canais:** O mix de canais parece saudável e diversificado para o setor de '${companyProfile.industry}'? Há alguma dependência excessiva de um único canal?
        2.  **Análise de Eficiência:** Quais canais são mais eficientes (menor CPL, maior ROI)? Quais são menos eficientes?
        3.  **Sugestões de Otimização:** Com base na eficiência, sugira uma realocação de orçamento para maximizar os resultados (leads ou receita). Por exemplo, "Considere mover 20% do orçamento do Canal X para o Canal Y".
        4.  **Novas Oportunidades:** Sugira 1 ou 2 novos canais que a empresa poderia explorar, considerando o seu ramo de atividade.

        Forneça uma análise concisa e acionável em formato de texto.
    `;
    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for channel mix analysis:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar análise de canais com a IA: ${errorMessage}`);
    }
};

export const getDecisionTriggers = async (planData: PlanData, summary2025: Summary2025, scenarioName?: ScenarioName): Promise<string> => {
    const { companyProfile } = planData;
    
    const context = scenarioName 
        ? `Foque especificamente e gere APENAS gatilhos para o cenário **${scenarioName}**.`
        : `Sugira 3 a 4 "Gatilhos de Decisão" para cada um dos 3 cenários (Otimista, Conservador, Disruptivo).`;

    const prompt = `
        Você é um consultor de negócios experiente. Para a empresa '${companyProfile.name}' do ramo de '${companyProfile.industry}', estou criando um planejamento por cenários para 2026 (Otimista, Conservador, Disruptivo).
        O desempenho em 2025 teve uma receita de ${formatCurrency(summary2025.receitaTotal)} e ${summary2025.novosClientesTotal} novos clientes.

        ${context}
        
        Esses gatilhos devem ser indicadores de alerta precoce que ajudam a identificar em qual cenário a empresa está operando.

        - **Gatilhos Otimistas:** Indicam que o desempenho está superando as expectativas. Ex: NPS > 75, Pipeline comercial 20% acima da meta.
        - **Gatilhos Conservadores:** Indicam que o desempenho está dentro do esperado (cenário base). Ex: Taxa de conversão estável, Crescimento de leads em linha com a meta.
        - **Gatilhos Disruptivos:** Indicam que o desempenho está abaixo do esperado, sinalizando risco. Ex: Taxa de conversão < 25%, Inadimplência > 10%.

        Forneça a resposta como um texto simples, usando quebras de linha e marcadores para separar os itens.
    `;
    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for decision triggers:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar gatilhos de decisão com a IA: ${errorMessage}`);
    }
};

export const getScenarioAnalysis = async (scenarios: Scenarios2026, triggers: { [key in ScenarioName]: string }, actions: { [key in ScenarioName]: string }): Promise<string> => {
     const prompt = `
        Você é um analista estratégico sênior. Analise o seguinte plano de cenários para 2026 e forneça uma análise sobre os caminhos estratégicos.

        **Cenário Otimista:**
        - Orçamento: Receita projetada de ${formatCurrency(Object.values(scenarios.Otimista.receitaProjetada).reduce((a, b) => a + (Number(b)||0), 0))}.
        - Gatilhos: ${triggers.Otimista || "Não definidos"}
        - Ações Estratégicas: ${actions.Otimista || "Não definidas"}

        **Cenário Conservador (Base):**
        - Orçamento: Receita projetada de ${formatCurrency(Object.values(scenarios.Conservador.receitaProjetada).reduce((a, b) => a + (Number(b)||0), 0))}.
        - Gatilhos: ${triggers.Conservador || "Não definidos"}
        - Ações Estratégicas: ${actions.Conservador || "Não definidas"}

        **Cenário Disruptivo:**
        - Orçamento: Receita projetada de ${formatCurrency(Object.values(scenarios.Disruptivo.receitaProjetada).reduce((a, b) => a + (Number(b)||0), 0))}.
        - Gatilhos: ${triggers.Disruptivo || "Não definidos"}
        - Ações Estratégicas: ${actions.Disruptivo || "Não definidas"}

        Com base nestas informações, forneça uma análise concisa em texto, abordando:
        1.  **Coerência do Plano:** As ações estratégicas e os gatilhos estão alinhados com os orçamentos de cada cenário?
        2.  **Análise de Risco:** Qual é o maior risco aparente neste plano? Existe alguma lacuna nos gatilhos ou ações para o cenário disruptivo?
        3.  **Recomendação Estratégica:** Qual deveria ser o foco principal da gestão ao monitorar este plano? Qual gatilho é o mais crítico para acompanhar?

        Seja direto, crítico e forneça recomendações acionáveis.
    `;
    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for scenario analysis:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao analisar cenários com a IA: ${errorMessage}`);
    }
}

export const getStrategicScoreImpactAnalysis = async (score: PlanData['analysis']['strategicScore']): Promise<string> => {
    const componentsText = score.components.map(c => `- ${c.name}: Pontuação ${c.score.toFixed(2)} (Peso: ${formatPercentage(c.weight * 100, 0)})`).join('\n');
    const prompt = `
        Você é um consultor de estratégia sênior. Analise a seguinte Pontuação Estratégica Consolidada de uma empresa e explique o que ela significa para o orçamento de 2026.

        **Fator de Crescimento Estratégico Total: ${formatPercentage(score.total, 1)}**

        Este fator é composto por:
        ${componentsText}

        Com base nisso, forneça uma análise em texto, explicando:
        1.  **Diagnóstico Rápido:** O que a pontuação geral (${score.total >= 0 ? '+' : ''}${score.total.toFixed(1).replace('.', ',')}%) significa? A estratégia da empresa está ajudando ou atrapalhando seu potencial de crescimento?
        2.  **Análise dos Componentes:** Destaque os 2 componentes mais importantes (positivos ou negativos) e explique como eles estão impactando a pontuação. Por exemplo, "Apesar de um bom posicionamento de mercado, a alta concentração de receita (Curva ABC) está agindo como um freio...".
        3.  **Impacto no Orçamento:** Explique como este fator de ${formatPercentage(score.total, 1)} influenciará as projeções de receita nos cenários. Por exemplo, "Na prática, isso significa que o cenário 'Conservador', que tinha uma meta de crescimento de 20%, será ajustado para ${formatPercentage(20 + score.total, 1)}, refletindo o impulso (ou o obstáculo) da sua situação estratégica atual."

        Seja claro, conciso e use uma linguagem de negócios.
    `;
    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for strategic score analysis:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao analisar o impacto estratégico com a IA: ${errorMessage}`);
    }
};


export const getBenchmarkAnalysis = async (companyProfile: CompanyProfile, summary: Summary2025): Promise<string> => {
    const prompt = `
        Você é um analista de negócios e especialista em benchmarking de mercado. Analise os seguintes KPIs de 2025 para a empresa '${companyProfile.name}', que atua no ramo de '${companyProfile.industry}'.

        KPIs da Empresa (2025):
        - Margem EBITDA: ${formatPercentage(summary.margemEbitda)}
        - Custo de Aquisição de Clientes (CAC): ${formatCurrency(summary.cac)}
        - Lifetime Value (LTV): ${formatCurrency(summary.ltv)}
        - Relação LTV/CAC: ${formatNumber(summary.relacaoLtvCac)}
        - Taxa de Turnover Anual (Funcionários): ${formatPercentage(summary.turnoverPercent)}
        - Ponto de Equilíbrio (Receita Mínima MENSAL): ${formatCurrency(summary.pontoEquilibrioContabil)}

        Com base nestes dados:
        1. Compare esses indicadores com benchmarks de mercado *gerais* para o setor de '${companyProfile.industry}'. Se não tiver dados específicos, use boas práticas de mercado (ex: LTV/CAC ideal é > 3, Margem EBITDA saudável, etc.).
        2. Forneça uma análise estratégica concisa em texto.
        3. Destaque 1 ou 2 pontos fortes (onde a empresa está acima da média).
        4. Aponte 1 ou 2 pontos de atenção (onde a empresa pode melhorar em relação ao mercado).
        5. Termine com uma recomendação chave para o planejamento de 2026.

        A resposta deve ser um texto corrido, bem estruturado, usando negrito para destacar os pontos fortes e de atenção.
    `;
    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for benchmark analysis:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar análise de benchmarking com a IA: ${errorMessage}`);
    }
};

export const generateComprehensiveStrategicAnalysis = async (
    planData: PlanData,
    summary2025: Summary2025,
    goals2026: Goals2026
): Promise<{ analysisText: string; actionPlanItems: Omit<ActionPlanItem, 'id' | 'status'>[] }> => {
    
    const serialize = (obj: any) => JSON.stringify(obj, null, 2);

    const prompt = `
        Você é um Consultor de Estratégia de Negócios (CSO) de classe mundial. Sua tarefa é analisar os dados abrangentes de planejamento da empresa e gerar uma análise estratégica acionável para 2026.

        **DADOS DA EMPRESA:**
        - **Perfil:** ${serialize(planData.companyProfile)}
        - **Metas 2026:** Aumentar a receita para ${formatCurrency(sumMonthlyData(goals2026.financeiras.metaReceita))} com ${formatPercentage(goals2026.financeiras.metaMargemEbitda)} de margem EBITDA.
        - **Resumo 2025:** Receita de ${formatCurrency(summary2025.receitaTotal)}, ${summary2025.novosClientesTotal} novos clientes, ${formatPercentage(summary2025.margemEbitda)} margem EBITDA.
        - **Análise de Mercado:** ${serialize(planData.marketAnalysis)}
        - **Custos 2025:** CMV Total de ${formatCurrency(summary2025.cmvTotal)}, Custos Variáveis de ${formatCurrency(summary2025.custosVariaveisTotal)}, Custos Fixos de ${formatCurrency(summary2025.custosFixosTotal)}.
        - **Plano Comercial 2026:** O funil de vendas precisa gerar ${formatNumber(planData.commercialPlanning.demandPlanning.channels.reduce((s,c) => s + (c.leads || 0), 0))} leads.
        - **Plano de RH 2026:** Planeja contratar ${planData.hiringProjection.reduce((s, d) => s + (d.newHires || 0), 0)} novas pessoas.

        **SUA TAREFA:**
        Com base em TODOS os dados fornecidos, retorne um único objeto JSON com duas chaves: "analysisText" e "actionPlanItems".

        **1. analysisText (string):**
        Uma análise estratégica em formato de texto (use quebras de linha para parágrafos). Estruture sua análise com os seguintes títulos:
        
        **Análise Estratégica Holística:**
        (Faça um parágrafo inicial resumindo a situação da empresa e o principal desafio para 2026).

        **Diagnóstico do Posicionamento:**
        (Analise o SWOT, Curva ABC, Oceano Azul e Bowman. A empresa está bem posicionada? Onde estão os maiores riscos e oportunidades no portfólio e no mercado?).

        **Viabilidade Operacional e Financeira:**
        (Avalie a estrutura de custos (fixo, variável, CMV) e a carga tributária. O plano comercial e de contratações é realista para atingir as metas de receita? O funil de vendas suporta o crescimento?).

        **Plano de Ação Recomendado:**
        (Explique a lógica por trás das ações que você está sugerindo. Justifique por que essas são as alavancas mais importantes para focar agora. Dê exemplos das ações que serão criadas).

        **2. actionPlanItems (array de objetos):**
        Gere de 5 a 8 itens de ação 5W2H de alto impacto baseados na sua análise. Estes itens devem ser práticos e diretamente ligados às oportunidades e fraquezas identificadas. Use placeholders para responsáveis.
        
        IMPORTANTE para cada item:
        - **category**: Classifique em uma destas categorias: "Comercial", "Financeiro", "Pessoas", "Operacional", "Marketing" ou "Estratégico"
        - **priority**: Defina a prioridade: "Alta" (fazer primeiro, maior impacto), "Média" ou "Baixa"
        - **expectedResult**: Descreva o resultado esperado de forma mensurável (ex: "Aumentar conversao de 2% para 5% em 3 meses", "Reduzir custo fixo em R$15.000/mes")
        
        Ordene as ações por prioridade (Alta primeiro). Garanta que haja pelo menos 1 ação de cada categoria principal (Comercial, Financeiro, Pessoas).
    `;

    const actionPlanItemSchema = {
        type: Type.OBJECT,
        properties: {
            what: { type: Type.STRING },
            why: { type: Type.STRING },
            who: { type: Type.STRING },
            when: { type: Type.STRING },
            where: { type: Type.STRING },
            how: { type: Type.STRING },
            howMuch: { type: Type.NUMBER },
            category: { type: Type.STRING, enum: ['Comercial', 'Financeiro', 'Pessoas', 'Operacional', 'Marketing', 'Estratégico'] },
            priority: { type: Type.STRING, enum: ['Alta', 'Média', 'Baixa'] },
            expectedResult: { type: Type.STRING },
        },
        required: ['what', 'why', 'who', 'when', 'how', 'howMuch', 'category', 'priority', 'expectedResult']
    };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            analysisText: { type: Type.STRING },
            actionPlanItems: {
                type: Type.ARRAY,
                items: actionPlanItemSchema
            }
        },
        required: ['analysisText', 'actionPlanItems']
    };

    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash', // Use Flash for heavy tasks to avoid quota limit
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });
        });
        const text = response.text;
        if (!text) {
            throw new Error("A IA retornou uma resposta vazia ou inválida.");
        }
        const jsonText = text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error calling Gemini API for comprehensive analysis:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar a análise estratégica com a IA: ${errorMessage}`);
    }
};

export const getMonthlyVarianceAnalysis = async (
    month: string,
    projected: { receita?: number; custosVariaveis?: number; despesasFixas?: number; margemContribuicao?: number; pontoEquilibrio?: number },
    actual: { receita?: number; custosVariaveis?: number; despesasFixas?: number; margemContribuicao?: number; pontoEquilibrio?: number }
): Promise<string> => {
    const prompt = `
        Você é um CFO (Chief Financial Officer) experiente, analisando o desempenho financeiro do mês de ${month}.
        Compare os dados projetados com os realizados e forneça uma análise clara, objetiva e acionável.

        **Dados do Mês de ${month}:**

        | Métrica                  | Projetado                         | Realizado                         |
        |--------------------------|-----------------------------------|-----------------------------------|
        | Receita                  | ${formatCurrency(projected.receita)}        | ${formatCurrency(actual.receita)}        |
        | Custos Variáveis         | ${formatCurrency(projected.custosVariaveis)} | ${formatCurrency(actual.custosVariaveis)} |
        | Despesas Fixas           | ${formatCurrency(projected.despesasFixas)}   | ${formatCurrency(actual.despesasFixas)}   |
        | **Margem de Contribuição** | ${formatCurrency(projected.margemContribuicao)} | ${formatCurrency(actual.margemContribuicao)} |
        | **Ponto de Equilíbrio**    | ${formatCurrency(projected.pontoEquilibrio)}   | ${formatCurrency(actual.pontoEquilibrio)}   |

        **Sua Análise:**

        1.  **Diagnóstico Geral:** Como foi o desempenho geral do mês em relação ao plano? Atingimos os objetivos principais?
        2.  **Análise de Variações:**
            *   **Receita:** A variação na receita foi positiva ou negativa? Quais podem ter sido as causas (volume, preço, mix de produtos)?
            *   **Custos e Despesas:** Os custos variáveis se comportaram como esperado em relação à receita? Houve algum descontrole nas despesas fixas?
            *   **Rentabilidade (Margem e Ponto de Equilíbrio):** A margem de contribuição melhorou ou piorou? O que isso significa? O ponto de equilíbrio aumentou ou diminuiu? Estamos precisando vender mais ou menos para cobrir os custos?
        3.  **Plano de Ação:** Com base na sua análise, quais são as 2 ou 3 recomendações mais importantes para o próximo mês? (Ex: "Focar em renegociar com fornecedor X", "Revisar a estratégia de precificação do produto Y", "Investigar o aumento inesperado na despesa de marketing").

        Seja direto e use uma linguagem de negócios. A resposta deve ser em texto com quebras de linha.
    `;
    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for monthly analysis:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar análise mensal com a IA: ${errorMessage}`);
    }
};


export const getBenchmarkProfitMargin = async (industry: string): Promise<{ margin: number; analysis: string }> => {
    const prompt = `
        Você é um analista de negócios. Para o ramo de atividade "${industry}", qual é uma margem de lucro líquido (profit margin) de benchmark de mercado (saudável)?
        Considere se é um setor de margens altas ou baixas.

        Retorne um objeto JSON com duas chaves:
        1. "margin": um número representando a porcentagem da margem (ex: 15 para 15%).
        2. "analysis": um texto curto explicando o porquê dessa margem para o setor.
    `;
    
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            margin: { type: Type.NUMBER },
            analysis: { type: Type.STRING },
        },
        required: ['margin', 'analysis']
    };
    
    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash', // Simple extraction/knowledge retrieval
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });
        });
        const text = response.text;
        if (!text) {
            throw new Error("A IA retornou uma resposta vazia ou inválida.");
        }
        const jsonText = text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error calling Gemini API for profit margin benchmark:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao buscar benchmark de margem de lucro com a IA: ${errorMessage}`);
    }
};

export const getPricingModelRecommendation = async (
    industry: string,
    taxRegime: string,
    productMix: 'simples' | 'variado' | 'projetos'
): Promise<{ recommendation: 'custo' | 'divisor' | 'meta'; analysis: string; }> => {
    const prompt = `
        Você é um consultor financeiro especialista em precificação. Com base no perfil de negócio abaixo, recomende o melhor modelo de markup e explique o porquê.

        - **Ramo de Atividade:** ${industry}
        - **Regime Tributário:** ${taxRegime}
        - **Mix de Produtos:** ${productMix === 'simples' ? 'Simples (poucos produtos/serviços padronizados)' : productMix === 'variado' ? 'Variado (portfólio amplo com diferentes custos/margens)' : 'Baseado em projetos/serviços únicos'}

        Modelos de Markup disponíveis:
        - **custo:** Markup sobre o Custo. Simples, mas menos preciso.
        - **divisor:** Markup sobre o Preço (Divisor). Mais preciso, considera impostos sobre o preço final.
        - **meta:** Markup por Meta de Lucro. Focado em atingir um lucro fixo por unidade.

        Sua recomendação deve ser baseada nas melhores práticas. Por exemplo:
        - Empresas de revenda simples podem usar 'custo'.
        - Empresas no Simples Nacional ou Lucro Presumido, com mix variado, devem usar 'divisor'.
        - Consultorias, agências ou serviços por projeto se beneficiam do modelo de 'meta'.

        Retorne um objeto JSON com duas chaves:
        1. "recommendation": a string 'custo', 'divisor', ou 'meta'.
        2. "analysis": um texto curto e direto explicando o porquê da sua recomendação para este negócio específico.
    `;
    
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            recommendation: { type: Type.STRING, enum: ['custo', 'divisor', 'meta'] },
            analysis: { type: Type.STRING },
        },
        required: ['recommendation', 'analysis']
    };
    
    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash', // Reasoning task
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });
        });
        const text = response.text;
        if (!text) {
            throw new Error("A IA retornou uma resposta vazia ou inválida.");
        }
        const jsonText = text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error calling Gemini API for pricing model recommendation:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao recomendar modelo de precificação com a IA: ${errorMessage}`);
    }
};

export const generateDiagnosisReportAnalysis = async (planData: PlanData, summary2025: Summary2025): Promise<string> => {
    const prompt = `
        Você é um consultor sênior de negócios. Analise os dados de 2025 da empresa "${planData.companyProfile.name}" do setor de "${planData.companyProfile.industry}".
        Gere um relatório de diagnóstico conciso.

        **Resumo Financeiro 2025:**
        - Receita Líquida: ${formatCurrency(summary2025.receitaTotal)}
        - Margem EBITDA: ${formatPercentage(summary2025.margemEbitda)}
        - Ponto de Equilíbrio (mensal): ${formatCurrency(summary2025.pontoEquilibrioContabil)}

        **Análise Estratégica (SWOT):**
        - Forças: ${planData.marketAnalysis.swot.strengths}
        - Fraquezas: ${planData.marketAnalysis.swot.weaknesses}
        - Oportunidades: ${planData.marketAnalysis.swot.opportunities}
        - Ameaças: ${planData.marketAnalysis.swot.threats}
        
        **Sua Tarefa:**
        1. **Diagnóstico Geral:** Dê um parecer sobre a saúde financeira e estratégica da empresa em 2025.
        2. **Pontos Fortes:** Destaque os principais pontos positivos do ano.
        3. **Pontos de Atenção:** Identifique os principais riscos e fraquezas que precisam ser abordados no planejamento de 2026.
        4. **Recomendação Principal:** Qual deve ser o foco estratégico número 1 para o próximo ano?

        Seja direto e use uma linguagem de negócios. Formate a resposta para ser lida facilmente.
    `;
    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for diagnosis report analysis:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar o relatório de diagnóstico com a IA: ${errorMessage}`);
    }
};

export const generatePlanReportAnalysis = async (planData: PlanData, goals2026: Goals2026, scenarios2026: Scenarios2026, baseScenario: ScenarioName): Promise<string> => {
    
    // Aggregate key financial data for the prompt
    const projection = scenarios2026[baseScenario].projection;
    const receitaProjetada = sumMonthlyData(scenarios2026[baseScenario].receitaProjetada);
    const custoProjetado = sumMonthlyData(scenarios2026[baseScenario].custosProjetados);
    const despesaProjetada = sumMonthlyData(scenarios2026[baseScenario].despesasProjetadas);
    const ebitdaProjetado = receitaProjetada - custoProjetado - despesaProjetada;
    
    const prompt = `
        Você é um **Chief Strategy Officer (CSO)** de classe mundial. Sua missão é criar um **"Relatório de Plano de Jogo"** definitivo para 2026 da empresa "${planData.companyProfile.name}".
        
        Este não é um resumo comum. É uma análise crítica e profunda que deve conectar todos os pontos do planejamento para validar se a estratégia é vencedora.

        **DADOS ESTRATÉGICOS E OPERACIONAIS:**
        1. **Contexto de Mercado (SWOT & Oceano Azul):**
           - Forças: ${planData.marketAnalysis.swot.strengths}
           - Fraquezas: ${planData.marketAnalysis.swot.weaknesses}
           - Ameaças: ${planData.marketAnalysis.swot.threats}
           - Oportunidades: ${planData.marketAnalysis.swot.opportunities}
           - Fator Estratégico (Score): ${planData.analysis.strategicScore.total.toFixed(1).replace('.', ',')}%

        2. **O Alvo (Metas 2026):**
           - Receita Alvo: ${formatCurrency(sumMonthlyData(goals2026.financeiras.metaReceita))}
           - Novos Clientes: ${formatNumber(sumMonthlyData(goals2026.comerciais.metaNumClientes))}
           - Objetivos Qualitativos: ${goals2026.objetivosEstrategicos.objective1}, ${goals2026.objetivosEstrategicos.objective2}.

        3. **A Realidade Projetada (Cenário ${baseScenario}):**
           - Receita Projetada: ${formatCurrency(receitaProjetada)}
           - EBITDA Projetado: ${formatCurrency(ebitdaProjetado)} (${formatPercentage((ebitdaProjetado/receitaProjetada)*100)} de margem)
           - Capacidade de Caixa (Liquidez): Baseado no plano, a empresa está saudável?

        4. **A Máquina de Vendas (Comercial):**
           - Funil de Vendas: Taxa de conversão atual projetada.
           - Investimento em Marketing: Orçamento alocado nos canais.

        **SUA TAREFA - ESTRUTURA DO RELATÓRIO (MARKDOWN):**

        Gere um relatório em Markdown bem formatado (use **negrito**, listas, títulos h3 \`###\` e h4 \`####\`).

        **1. Tese de Crescimento 2026 (Executive Summary)**
        Resuma em 1 parágrafo poderoso: Qual é a "Grande Aposta" deste plano? Ex: "Em 2026, a [Empresa] deixará de ser generalista para dominar o nicho X, alavancando sua força em Y para crescer 30% com margem saudável."

        **2. Diagnóstico de Riscos Ocultos (Pre-Mortem)**
        Analise a coerência entre as Metas (Desejo) e a Projeção Financeira (Realidade).
        - Existe um "GAP" financeiro? O orçamento de marketing suporta a meta de vendas?
        - A estrutura de custos fixos está inchada para o tamanho da receita?
        - Aponte o "Elo Mais Fraco" do plano.

        **3. Alinhamento Organizacional (Pessoas & Processos)**
        Baseado nas metas de RH e Operações, a empresa tem o time certo para executar? O plano de contratações faz sentido com o crescimento?

        **4. "Game-Changing Moves" (Plano de Ação de Elite)**
        Liste 3 a 5 ações de altíssimo impacto que mudarão o jogo. Não use clichês como "melhorar o marketing". Seja cirúrgico baseado nos dados (Ex: "Eliminar a linha de produtos C (Curva ABC) que drena 20% do caixa e realocar verba para o Canal Digital X que tem ROI de 5x").

        **5. Veredito do CSO**
        Uma frase final: O plano é "Conservador", "Arriscado" ou "Transformador"? Dê uma nota de 0 a 10 para a robustez da estratégia.

        Seja direto, profissional, crítico e inspirador. Fale a língua de negócios de alto nível.
    `;
    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for plan report analysis:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar o relatório do plano com a IA: ${errorMessage}`);
    }
};

export const generateMarketingFunnelAnalysis = async (funnel2025: any, funnel2026: any): Promise<string> => {
    const prompt = `
        Você é um CMO (Chief Marketing Officer) experiente. Analise a evolução do funil de marketing e vendas de 2025 para 2026.

        **Funil 2025 (Realizado):**
        - Impressões: ${formatNumber(funnel2025.impressoes)}
        - Cliques: ${formatNumber(funnel2025.cliques)} (CTR: ${formatPercentage(funnel2025.ctr * 100)})
        - Leads: ${formatNumber(funnel2025.conversoes)} (Taxa Conv.: ${formatPercentage(funnel2025.cvr * 100)})
        - Vendas: ${formatNumber(funnel2025.vendas)} (Taxa Conv.: ${formatPercentage(funnel2025.leadToSale * 100)})
        - CAC: ${formatCurrency(funnel2025.cac)}
        - Investimento: ${formatCurrency(funnel2025.investimento)}

        **Funil 2026 (Projetado):**
        - Impressões: ${formatNumber(funnel2026.impressoes)}
        - Cliques: ${formatNumber(funnel2026.cliques)} (CTR: ${formatPercentage(funnel2026.ctr * 100)})
        - Leads: ${formatNumber(funnel2026.conversoes)} (Taxa Conv.: ${formatPercentage(funnel2026.cvr * 100)})
        - Vendas: ${formatNumber(funnel2026.vendas)} (Taxa Conv.: ${formatPercentage(funnel2026.leadToSale * 100)})
        - CAC: ${formatCurrency(funnel2026.cac)}
        - Investimento: ${formatCurrency(funnel2026.investimento)}

        **Sua Análise:**
        1. **Diagnóstico do Funil:** Onde está o principal gargalo ou a maior queda de conversão no funil?
        2. **Análise Comparativa:** A projeção para 2026 é realista, considerando que as taxas de conversão foram mantidas? O aumento no investimento se justifica?
        3. **Recomendações (3 Ações):** Sugira 3 ações práticas e focadas para otimizar o principal gargalo identificado e melhorar a eficiência geral do funil em 2026.

        Seja direto, acionável e use uma linguagem de marketing.
    `;
    try {
        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for marketing funnel analysis:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar a análise do funil com a IA: ${errorMessage}`);
    }
};
