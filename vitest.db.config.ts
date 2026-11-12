import { defineConfig } from 'vitest/config';

// Testes de permissão contra o Supabase LOCAL; rodam por `npm run test:db`, depois de `npm run db:local`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    // Um arquivo por vez: o Auth local limita entradas por IP e a máquina tem pouca RAM.
    fileParallelism: false,
    testTimeout: 30000,
  },
});
