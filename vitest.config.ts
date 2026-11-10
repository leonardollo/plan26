import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Os testes de regras rodam no emulador, pelo vitest.rules.config.ts.
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
