import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ADMIN, BLOQUEADO, LIBERADO, PENDENTE, criarAmbiente, semear, type Pessoa } from './ambiente';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await criarAmbiente();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await semear(env);
});

function banco(pessoa: Pessoa | null) {
  return pessoa ? env.authenticatedContext(pessoa.uid, pessoa.token).firestore() : env.unauthenticatedContext().firestore();
}

const PESSOAS: Array<{ nome: string; pessoa: Pessoa | null; usaOProprio: boolean }> = [
  { nome: 'admin com e-mail verificado', pessoa: ADMIN, usaOProprio: true },
  { nome: 'cliente liberado', pessoa: LIBERADO, usaOProprio: true },
  { nome: 'cliente pendente', pessoa: PENDENTE, usaOProprio: false },
  { nome: 'cliente bloqueado', pessoa: BLOQUEADO, usaOProprio: false },
  { nome: 'sem login', pessoa: null, usaOProprio: false },
];

describe('users/{uid}', () => {
  for (const { nome, pessoa, usaOProprio } of PESSOAS) {
    const proprio = `users/${pessoa ? pessoa.uid : 'uid-anonimo'}`;
    const esperado = usaOProprio ? assertSucceeds : assertFails;

    it(`${nome} ${usaOProprio ? 'lê' : 'não lê'} o próprio espaço`, async () => {
      await esperado(getDoc(doc(banco(pessoa), proprio)));
    });
    it(`${nome} ${usaOProprio ? 'grava' : 'não grava'} o próprio espaço`, async () => {
      await esperado(setDoc(doc(banco(pessoa), proprio), { planData: { x: 1 } }, { merge: true }));
    });
    it(`${nome} não lê o espaço de outro`, async () => {
      await assertFails(getDoc(doc(banco(pessoa), 'users/uid-outro')));
    });
    it(`${nome} não grava o espaço de outro`, async () => {
      await assertFails(setDoc(doc(banco(pessoa), 'users/uid-outro'), { planData: { x: 1 } }, { merge: true }));
    });
  }
});
