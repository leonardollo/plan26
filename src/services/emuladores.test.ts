import { describe, expect, it } from 'vitest';
import { CONFIG_DOS_EMULADORES, usarEmuladores } from './emuladores';

describe('usarEmuladores', () => {
  it('liga só no servidor de desenvolvimento com o modo emuladores', () => {
    expect(usarEmuladores(true, 'emuladores')).toBe(true);
  });

  it('nunca liga no build de produção, mesmo com --mode emuladores', () => {
    expect(usarEmuladores(false, 'emuladores')).toBe(false);
  });

  it('não liga no npm run dev comum nem nos testes', () => {
    expect(usarEmuladores(true, 'development')).toBe(false);
    expect(usarEmuladores(true, 'test')).toBe(false);
    expect(usarEmuladores(false, 'production')).toBe(false);
  });
});

describe('CONFIG_DOS_EMULADORES', () => {
  it('usa um projeto demo-*, que nunca alcança o Firebase real', () => {
    expect(CONFIG_DOS_EMULADORES.projectId).toMatch(/^demo-/);
    expect(JSON.stringify(CONFIG_DOS_EMULADORES)).not.toContain('plan-ea4cc');
  });
});
