import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
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

describe('users/{uid}/planos/{ano}', () => {
  for (const { nome, pessoa, usaOProprio } of PESSOAS) {
    const uid = pessoa ? pessoa.uid : 'uid-anonimo';
    const proprio = `users/${uid}/planos/2027`;
    const esperado = usaOProprio ? assertSucceeds : assertFails;

    it(`${nome} ${usaOProprio ? 'lê' : 'não lê'} o próprio plano de outro ano`, async () => {
      await esperado(getDoc(doc(banco(pessoa), proprio)));
    });
    it(`${nome} ${usaOProprio ? 'grava' : 'não grava'} o próprio plano de outro ano`, async () => {
      await esperado(setDoc(doc(banco(pessoa), proprio), { planData: { x: 1 } }, { merge: true }));
    });
    it(`${nome} ${usaOProprio ? 'lista' : 'não lista'} os próprios planos`, async () => {
      await esperado(getDocs(collection(banco(pessoa), 'users', uid, 'planos')));
    });
    it(`${nome} não lê o plano de outro ano de outro`, async () => {
      await assertFails(getDoc(doc(banco(pessoa), 'users/uid-outro/planos/2027')));
    });
    it(`${nome} não grava o plano de outro ano de outro`, async () => {
      await assertFails(setDoc(doc(banco(pessoa), 'users/uid-outro/planos/2027'), { planData: { x: 1 } }, { merge: true }));
    });
    it(`${nome} não lista os planos de outro`, async () => {
      await assertFails(getDocs(collection(banco(pessoa), 'users', 'uid-outro', 'planos')));
    });
  }
});

// Ano válido em planos/{ano}: quatro dígitos, depois de 2026 (que fica em users/{uid}) e até o ano seguinte ao atual.
// Relativo ao relógio: o teste continua valendo nos próximos anos. O servidor usa UTC; o Brasil está atrás, então nunca adianta.
describe('users/{uid}/planos/{ano}: só anos válidos', () => {
  const anoAtual = new Date().getUTCFullYear();
  const gravar = (pessoa: Pessoa, ano: string) =>
    setDoc(doc(banco(pessoa), `users/${pessoa.uid}/planos/${ano}`), { planData: { x: 1 } });

  for (const pessoa of [LIBERADO, ADMIN]) {
    it(`${pessoa.uid} grava o plano de 2027`, async () => {
      await assertSucceeds(gravar(pessoa, '2027'));
    });
    it(`${pessoa.uid} grava o plano do ano seguinte ao atual`, async () => {
      await assertSucceeds(gravar(pessoa, String(anoAtual + 1)));
    });
    for (const ano of [String(anoAtual + 2), '9999', '2026', '2025', '0000', 'abc', '02027', '2027a', '202']) {
      it(`${pessoa.uid} não grava planos/${ano}`, async () => {
        await assertFails(gravar(pessoa, ano));
      });
    }
    it(`${pessoa.uid} não grava em outra subcoleção do próprio espaço`, async () => {
      await assertFails(setDoc(doc(banco(pessoa), `users/${pessoa.uid}/lixo/1`), { x: 1 }));
    });
    it(`${pessoa.uid} não grava abaixo de um plano`, async () => {
      await assertFails(setDoc(doc(banco(pessoa), `users/${pessoa.uid}/planos/2027/extra/1`), { x: 1 }));
    });
  }

  it('o plano já salvo de 2027 continua sendo atualizado com merge', async () => {
    await assertSucceeds(gravar(LIBERADO, '2027'));
    await assertSucceeds(setDoc(doc(banco(LIBERADO), `users/${LIBERADO.uid}/planos/2027`), { planData: { y: 2 } }, { merge: true }));
  });
  it('ler um ano inválido não quebra a listagem dos próprios planos', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${LIBERADO.uid}/planos/9999`), { planData: {} });
    });
    await assertSucceeds(getDocs(collection(banco(LIBERADO), 'users', LIBERADO.uid, 'planos')));
  });
});
