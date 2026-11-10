import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...p: string[]) => p.join('/')),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => 'agora'),
}));

import { getDoc, setDoc } from 'firebase/firestore';
import { obterOuCriarAcesso, rotuloEmailVerificado } from './acesso';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('obterOuCriarAcesso', () => {
  it('pedido novo grava emailVerificado, pendente e o e-mail em minúsculas', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);
    vi.mocked(setDoc).mockResolvedValue(undefined as any);
    await obterOuCriarAcesso({} as any, 'u', 'A@x.com', 'A', false);
    expect(setDoc).toHaveBeenCalledWith(
      'acessos/u',
      expect.objectContaining({ emailVerificado: false, status: 'pendente', email: 'a@x.com' }),
    );
  });
});

describe('rotuloEmailVerificado', () => {
  it('sim, não e pedido antigo sem o campo', () => {
    expect(rotuloEmailVerificado(true)).toBe('Sim');
    expect(rotuloEmailVerificado(false)).toBe('Não');
    expect(rotuloEmailVerificado(undefined)).toBe('—');
  });
});
