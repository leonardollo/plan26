import { describe, expect, it } from 'vitest';
import { rotuloDoPrazo } from './prazo';

const AGORA = new Date('2027-03-10T12:00:00Z');

describe('rotuloDoPrazo', () => {
  it('null → Sem prazo', () => {
    expect(rotuloDoPrazo(null, AGORA)).toBe('Sem prazo');
    expect(rotuloDoPrazo(undefined, AGORA)).toBe('Sem prazo');
  });
  it('2028-03-10T03:00:00Z futuro → 10/03/2028', () => {
    expect(rotuloDoPrazo('2028-03-10T03:00:00Z', AGORA)).toBe('10/03/2028');
  });
  it('vencido → Vencido em 01/01/2027', () => {
    expect(rotuloDoPrazo('2027-01-01T15:00:00Z', AGORA)).toBe('Vencido em 01/01/2027');
    expect(rotuloDoPrazo('2027-03-10T12:00:00Z', AGORA)).toBe('Vencido em 10/03/2027');
  });
  it('2028-03-10T02:00:00Z mostra 09/03/2028 (fuso de São Paulo)', () => {
    expect(rotuloDoPrazo('2028-03-10T02:00:00Z', AGORA)).toBe('09/03/2028');
  });
});
