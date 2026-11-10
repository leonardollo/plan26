import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { LIBERADO, criarAmbiente, semear } from './ambiente';

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

const liberado = () => env.authenticatedContext(LIBERADO.uid, LIBERADO.token).firestore();

describe('admins/{email}', () => {
  it('ninguém lista admins', async () => {
    await assertFails(getDocs(collection(liberado(), 'admins')));
  });

  it('logado lê o documento do próprio e-mail, mesmo sem existir', async () => {
    await assertSucceeds(getDoc(doc(liberado(), 'admins/liberado@x.com')));
  });

  it('logado não lê o documento de outro e-mail', async () => {
    await assertFails(getDoc(doc(liberado(), 'admins/admin@gi.com')));
  });

  it('e-mail com maiúsculas no token lê o próprio documento e age como admin', async () => {
    const db = env.authenticatedContext('uid-admin3', { email: 'Admin@GI.com', email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(db, 'admins/admin@gi.com')));
    await assertSucceeds(updateDoc(doc(db, 'acessos/uid-pendente'), { status: 'liberado' }));
  });

  it('sem login não lê admins', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'admins/admin@gi.com')));
  });
});
