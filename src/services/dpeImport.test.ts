import { describe, expect, it } from 'vitest';
import { importarDoDiagnostico, type FotoDpe } from './dpeImport';

const mm = (n: number) => String(n).padStart(2, '0');

// 2025 completo (12 meses com receita) e 2026 de janeiro a outubro: a regra antiga escolheria 2025.
function foto(): FotoDpe {
  const serie = [
    ...Array.from({ length: 12 }, (_, i) => ({ comp: `2025-${mm(i + 1)}`, rb: '100.000,00', cf: '10.000,00' })),
    ...Array.from({ length: 10 }, (_, i) => ({ comp: `2026-${mm(i + 1)}`, rb: '120.000,00', cf: '11.000,00' })),
  ];
  return { f: { fantasia: 'Padaria Sol', teste30: 'a empresa para' }, g: { serie } };
}

const anotacao = (r: ReturnType<typeof importarDoDiagnostico>, inicio: string) =>
  r.relatorio.find(i => i.destino.startsWith(inicio));

describe('importarDoDiagnostico — ano base do plano aberto', () => {
  it('plano 2027 importa 2026', () => {
    const r = importarDoDiagnostico(foto(), 2026);
    expect(r.anoBase).toBe(2026);
    expect(r.mesesEncontrados).toBe(10);
    expect(anotacao(r, 'Receita bruta')?.destino).toBe('Receita bruta (10 meses de 2026)');
    expect(anotacao(r, 'Receita bruta')?.observacao).toBe('Faltam 2 meses para o ano fechar.');
    expect(r.patch.financialSheet?.receitaBruta?.values2025?.jan).toBe(120000);
    expect(r.patch.financialSheet?.receitaBruta?.values2025?.nov).toBeNull();
  });

  it('plano 2026 importa 2025', () => {
    const r = importarDoDiagnostico(foto(), 2025);
    expect(r.anoBase).toBe(2025);
    expect(r.mesesEncontrados).toBe(12);
    expect(r.patch.financialSheet?.receitaBruta?.values2025?.dez).toBe(100000);
  });

  it('ano base sem nenhum mês fica faltando, citando o ano', () => {
    const r = importarDoDiagnostico(foto(), 2024);
    expect(r.anoBase).toBe(2024);
    expect(r.mesesEncontrados).toBe(0);
    const item = anotacao(r, 'Série financeira de 2024');
    expect(item?.confianca).toBe('faltando');
    expect(item?.observacao).toContain('2024');
  });

  it('o diagnóstico operacional cita o PLAN do ano seguinte ao base', () => {
    const r = importarDoDiagnostico(foto(), 2026);
    const item = anotacao(r, 'Diagnóstico operacional');
    expect(item?.observacao).toContain('PLAN 2027');
    expect(item?.observacao).not.toContain('PLAN 2026');
  });
});
