import { describe, expect, it } from 'vitest';
import {
  baseDosAtalhos, diaEmSP, hojeEmSP, MSG_DATA_FUTURA, MSG_MAX_5_ANOS, rotuloDoPrazo, somarAnos, somarDias,
  validarDiaDoPrazo,
} from './prazo';

// 13/11/2026, meio-dia em São Paulo.
const AGORA = new Date('2026-11-13T15:00:00Z');
/** Último instante do dia em São Paulo, como admin_definir_prazo grava. */
const fimDe = (dia: string) => new Date(Date.parse(`${somarDias(dia, 1)}T03:00:00Z`) - 1).toISOString();

describe('rotuloDoPrazo', () => {
  it('null, undefined e texto inválido → Sem prazo', () => {
    expect(rotuloDoPrazo(null, AGORA)).toBe('Sem prazo');
    expect(rotuloDoPrazo(undefined, AGORA)).toBe('Sem prazo');
    expect(rotuloDoPrazo('abc', AGORA)).toBe('Sem prazo');
  });
  it('13/11/2027 → Acesso até 13/11/2027 · faltam 365 dias', () => {
    expect(rotuloDoPrazo(fimDe('2027-11-13'), AGORA)).toBe('Acesso até 13/11/2027 · faltam 365 dias');
  });
  it('amanhã → falta 1 dia; fim de hoje → vence hoje', () => {
    expect(rotuloDoPrazo(fimDe('2026-11-14'), AGORA)).toBe('Acesso até 14/11/2026 · falta 1 dia');
    expect(rotuloDoPrazo(fimDe('2026-11-13'), AGORA)).toBe('Acesso até 13/11/2026 · vence hoje');
  });
  it('vencido em 10/11/2026 → há 3 dias; ontem → há 1 dia; mais cedo hoje → hoje', () => {
    expect(rotuloDoPrazo(fimDe('2026-11-10'), AGORA)).toBe('Vencido em 10/11/2026 · há 3 dias');
    expect(rotuloDoPrazo(fimDe('2026-11-12'), AGORA)).toBe('Vencido em 12/11/2026 · há 1 dia');
    expect(rotuloDoPrazo('2026-11-13T12:00:00Z', AGORA)).toBe('Vencido em 13/11/2026 · hoje');
  });
  it('prazo igual a agora já venceu, como no banco', () => {
    expect(rotuloDoPrazo(AGORA.toISOString(), AGORA)).toBe('Vencido em 13/11/2026 · hoje');
  });
  it('2028-03-10T02:00:00Z mostra 09/03/2028 (fuso de São Paulo)', () => {
    expect(rotuloDoPrazo('2028-03-10T02:00:00Z', AGORA)).toMatch(/^Acesso até 09\/03\/2028 · /);
  });
});

describe('hojeEmSP e diaEmSP', () => {
  it('usa o dia de São Paulo, não o de UTC', () => {
    expect(hojeEmSP(AGORA)).toBe('2026-11-13');
    expect(hojeEmSP(new Date('2026-11-14T02:30:00Z'))).toBe('2026-11-13');
    expect(diaEmSP(fimDe('2027-11-13'))).toBe('2027-11-13');
  });
});

describe('baseDosAtalhos', () => {
  it('prazo ainda vale → parte do prazo', () => {
    expect(baseDosAtalhos(fimDe('2027-11-13'), AGORA)).toBe('2027-11-13');
  });
  it('vencido ou sem prazo → parte de hoje', () => {
    expect(baseDosAtalhos(fimDe('2026-11-10'), AGORA)).toBe('2026-11-13');
    expect(baseDosAtalhos(null, AGORA)).toBe('2026-11-13');
  });
});

describe('somarAnos e somarDias', () => {
  it('exemplos aprovados: +1 ano e +30 dias', () => {
    expect(somarAnos('2027-11-13', 1)).toBe('2028-11-13');
    expect(somarDias('2026-11-13', 30)).toBe('2026-12-13');
    expect(somarAnos('2026-11-13', 1)).toBe('2027-11-13');
  });
  it('29/02 + 1 ano → 28/02, como o Postgres', () => {
    expect(somarAnos('2028-02-29', 1)).toBe('2029-02-28');
    expect(somarAnos('2028-02-29', 4)).toBe('2032-02-29');
  });
  it('virada de ano e fevereiro bissexto', () => {
    expect(somarDias('2026-12-15', 30)).toBe('2027-01-14');
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('validarDiaDoPrazo', () => {
  it('vazio ou inválido → Escolha uma data', () => {
    expect(validarDiaDoPrazo('', AGORA)).toBe('Escolha uma data');
    expect(validarDiaDoPrazo('abc', AGORA)).toBe('Escolha uma data');
  });
  it('hoje e passado → mensagem de data futura', () => {
    expect(validarDiaDoPrazo('2026-11-13', AGORA)).toBe(MSG_DATA_FUTURA);
    expect(validarDiaDoPrazo('2026-11-12', AGORA)).toBe(MSG_DATA_FUTURA);
    expect(MSG_DATA_FUTURA).toBe('Escolha uma data futura; para cortar o acesso, use Bloquear');
  });
  it('amanhã e exatamente 5 anos valem; 5 anos + 1 dia não', () => {
    expect(validarDiaDoPrazo('2026-11-14', AGORA)).toBeNull();
    expect(validarDiaDoPrazo('2031-11-13', AGORA)).toBeNull();
    expect(validarDiaDoPrazo('2031-11-14', AGORA)).toBe(MSG_MAX_5_ANOS);
  });
});
