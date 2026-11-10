import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { ADMIN, criarAmbiente, semear } from './ambiente';

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

const ADMIN_NAO_VERIFICADO = { uid: 'uid-admin2', token: { email: 'admin@gi.com', email_verified: false } };
const NOVO = { uid: 'uid-novo', token: { email: 'novo@x.com', email_verified: false } };

const bancoDe = (p: { uid: string; token: object }) => env.authenticatedContext(p.uid, p.token).firestore();

// Mesmo formato que obterOuCriarAcesso grava.
function pedido(extra: Record<string, unknown> = {}) {
  return {
    email: 'novo@x.com',
    nome: 'Novo',
    status: 'pendente',
    criadoEm: serverTimestamp(),
    liberadoEm: null,
    liberadoPor: null,
    ...extra,
  };
}

describe('acessos/{uid}', () => {
  it('admin verificado muda o status de um pedido', async () => {
    await assertSucceeds(updateDoc(doc(bancoDe(ADMIN), 'acessos/uid-pendente'), { status: 'liberado' }));
  });

  it('admin com e-mail não verificado não muda o status', async () => {
    await assertFails(updateDoc(doc(bancoDe(ADMIN_NAO_VERIFICADO), 'acessos/uid-pendente'), { status: 'liberado' }));
  });

  it('admin com e-mail não verificado não usa o próprio espaço sem acesso liberado', async () => {
    await assertFails(getDoc(doc(bancoDe(ADMIN_NAO_VERIFICADO), 'users/uid-admin2')));
  });

  it('pedido com emailVerificado true e token não verificado é negado', async () => {
    await assertFails(setDoc(doc(bancoDe(NOVO), 'acessos/uid-novo'), pedido({ emailVerificado: true })));
  });

  it('pedido com emailVerificado igual ao token é aceito', async () => {
    await assertSucceeds(setDoc(doc(bancoDe(NOVO), 'acessos/uid-novo'), pedido({ emailVerificado: false })));
  });

  it('pedido com emailVerificado true e token verificado é aceito', async () => {
    const verificado = { uid: 'uid-novo2', token: { email: 'novo2@x.com', email_verified: true } };
    await assertSucceeds(
      setDoc(doc(bancoDe(verificado), 'acessos/uid-novo2'), pedido({ email: 'novo2@x.com', emailVerificado: true })),
    );
  });

  it('pedido sem emailVerificado é aceito (bundle antigo)', async () => {
    await assertSucceeds(setDoc(doc(bancoDe(NOVO), 'acessos/uid-novo'), pedido()));
  });

  it('pedido já liberado é negado', async () => {
    await assertFails(setDoc(doc(bancoDe(NOVO), 'acessos/uid-novo'), pedido({ status: 'liberado' })));
  });
});
