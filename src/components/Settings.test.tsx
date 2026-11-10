import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const { planoFalso } = vi.hoisted(() => ({
  planoFalso: {
    planData: { companyProfile: { name: '', cnpj: '', industry: '', geminiApiKey: '' } },
    updateCompanyProfile: vi.fn(),
    updateMarketCompetitionData: vi.fn(),
    saveDataNow: vi.fn(),
    resetAllData: vi.fn(),
  },
}));

vi.mock('../hooks/usePlanData', () => ({ usePlan: () => planoFalso }));
vi.mock('../services/geminiService', () => ({
  getIndustryFromCnpj: vi.fn(),
  getMarketResearchFromCnpj: vi.fn(),
}));

import Settings from './Settings';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Settings — chave do Gemini', () => {
  it('abrir as Configurações não copia a chave do navegador para o plano', () => {
    localStorage.setItem('google_gemini_api_key', 'kA');
    render(<Settings />);
    expect(planoFalso.updateCompanyProfile).not.toHaveBeenCalledWith('geminiApiKey', expect.anything());
    expect(localStorage.getItem('google_gemini_api_key')).toBe('kA');
  });
});
