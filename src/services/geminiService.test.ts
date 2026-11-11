import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function GoogleGenAI(this: any) {
    this.models = { generateContent };
  }),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY', INTEGER: 'INTEGER', BOOLEAN: 'BOOLEAN' },
  Modality: { TEXT: 'TEXT', IMAGE: 'IMAGE', AUDIO: 'AUDIO' },
}));

import {
  generateComprehensiveStrategicAnalysis, generateDiagnosisReportAnalysis, generatePlanReportAnalysis,
  getGoalSuggestions, getScenarioAnalysis, getTaxRecommendation,
} from './geminiService';

const ANOS_2026 = { anoPlano: 2026, anoBase: 2025 };
const ANOS_2027 = { anoPlano: 2027, anoBase: 2026 };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('google_gemini_api_key', 'chave-do-teste');
  generateContent.mockResolvedValue({ text: JSON.stringify({ analysisText: 'ok', actionPlanItems: [] }) });
});

describe('generateComprehensiveStrategicAnalysis', () => {
  it('o prompt leva o perfil da empresa sem a chave do Gemini', async () => {
    const planData = {
      companyProfile: { name: 'Empresa X', cnpj: '', industry: 'Varejo', geminiApiKey: 'kA-segredo' },
      marketAnalysis: {},
      commercialPlanning: { demandPlanning: { channels: [] } },
      hiringProjection: [],
    } as any;
    const summary2025 = { receitaTotal: 0, novosClientesTotal: 0, margemEbitda: 0, cmvTotal: 0, custosVariaveisTotal: 0, custosFixosTotal: 0 } as any;
    const goals2026 = { financeiras: { metaReceita: {}, metaMargemEbitda: 0 } } as any;

    await generateComprehensiveStrategicAnalysis(planData, summary2025, goals2026, ANOS_2026);

    const prompt = String(generateContent.mock.calls[0][0].contents);
    expect(prompt).toContain('Empresa X');
    expect(prompt).not.toContain('kA-segredo');
  });
});

describe('getScenarioAnalysis', () => {
  it('a receita do prompt vem da projeção do cenário', async () => {
    const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const cenario = (receitaMensal: number) => ({
      growthPercentage: 0,
      // Campo antigo, que ninguém mais preenche: não pode ser a fonte da receita.
      receitaProjetada: {},
      projection: { receitaBruta: Object.fromEntries(MESES.map(m => [m, receitaMensal])) },
    });
    const scenarios = { Otimista: cenario(120000), Conservador: cenario(110000), Disruptivo: cenario(95000) } as any;
    const textos = { Otimista: '', Conservador: '', Disruptivo: '' };
    generateContent.mockResolvedValue({ text: 'ok' });

    await getScenarioAnalysis(scenarios, textos, textos, ANOS_2026);

    // O Intl separa "R$" do número com espaço não separável.
    const prompt = String(generateContent.mock.calls[0][0].contents).replace(/ /g, ' ');
    expect(prompt).toContain('R$ 1.440.000,00');
  });
});

describe('prompts com os anos do plano aberto (plano 2027, base 2026)', () => {
  const planData = {
    companyProfile: { name: 'Empresa X', cnpj: '', industry: 'Varejo' },
    marketAnalysis: { marketCompetition: { suaParticipacao: 0, taxaCrescimentoMercado: 0 }, swot: { strengths: '' } },
  } as any;
  const resumo = { receitaTotal: 0, margemEbitda: 0, novosClientesTotal: 0, ticketMedio: 0, headcountFinal: 0, turnoverPercent: 0, pontoEquilibrioContabil: 0 } as any;
  const promptEnviado = () => String(generateContent.mock.calls[0][0].contents);
  const semAno2025 = (prompt: string) => expect(prompt).not.toMatch(/(?<!\d)2025(?!\d)/);

  it('getGoalSuggestions cita 2027 e 2026, sem 2025', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ financeiras: {}, comerciais: {}, pessoas: {} }) });
    await getGoalSuggestions(planData, resumo, ANOS_2027);
    const prompt = promptEnviado();
    expect(prompt).toContain('2027');
    expect(prompt).toContain('2026');
    semAno2025(prompt);
  });

  it('generateDiagnosisReportAnalysis cita 2027 e 2026, sem 2025', async () => {
    generateContent.mockResolvedValue({ text: 'ok' });
    await generateDiagnosisReportAnalysis(planData, resumo, ANOS_2027);
    const prompt = promptEnviado();
    expect(prompt).toContain('2027');
    expect(prompt).toContain('2026');
    semAno2025(prompt);
  });

  it('generatePlanReportAnalysis cita 2027 e 2026, sem 2025', async () => {
    generateContent.mockResolvedValue({ text: 'ok' });
    const metas = {
      financeiras: { metaReceita: {} }, comerciais: { metaNumClientes: {} },
      objetivosEstrategicos: { objective1: '', objective2: '' },
    } as any;
    const cenario = { projection: { receitaBruta: {} }, growthPercentage: 0, receitaProjetada: {} };
    const cenarios = { Otimista: cenario, Conservador: cenario, Disruptivo: cenario } as any;
    const dados = { ...planData, swot: undefined, analysis: { strategicScore: { total: 0 } }, actionPlan: [], okrsAndKpis: { okrs: [] } } as any;
    await generatePlanReportAnalysis(dados, metas, cenarios, 'Conservador', ANOS_2027);
    const prompt = promptEnviado();
    expect(prompt).toContain('2027');
    expect(prompt).toContain('2026');
    semAno2025(prompt);
  });

  it('getTaxRecommendation cita o plano 2027 e mantém o calendário da reforma', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ razao_social: 'X' }) })));
    generateContent.mockResolvedValue({ text: 'ok' });
    await getTaxRecommendation('00000000000191', 'Simples Nacional', 6, 1000000, ANOS_2027);
    vi.unstubAllGlobals();
    const prompt = promptEnviado();
    expect(prompt).toContain('PLANO DE 2027');
    expect(prompt).toContain('2027: Extincao de PIS/COFINS, CBS com aliquota cheia (~8,8%)');
    expect(prompt).toContain('2026: Fase de testes com aliquota 1% (0,9% CBS + 0,1% IBS)');
  });
});
