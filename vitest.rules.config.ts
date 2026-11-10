import { defineConfig } from 'vitest/config';

// Testes das regras do Firestore; rodam dentro do emulador por `npm run test:rules` (projeto demo-plan).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // Os arquivos dividem o mesmo emulador: em paralelo, um limparia os dados do outro.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
