import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Os testes de banco rodam no Supabase local, pelo vitest.db.config.ts (npm run test:db).
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs', 'supabase/functions/**/*.test.ts'],
  },
});
