import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function GoogleGenAI(this: any) {
    this.models = { generateContent };
  }),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY', INTEGER: 'INTEGER', BOOLEAN: 'BOOLEAN' },
  Modality: { TEXT: 'TEXT', IMAGE: 'IMAGE', AUDIO: 'AUDIO' },
}));

import { generateComprehensiveStrategicAnalysis } from './geminiService';

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

    await generateComprehensiveStrategicAnalysis(planData, summary2025, goals2026);

    const prompt = String(generateContent.mock.calls[0][0].contents);
    expect(prompt).toContain('Empresa X');
    expect(prompt).not.toContain('kA-segredo');
  });
});
