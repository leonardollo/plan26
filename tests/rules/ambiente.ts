import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

// Projeto demo-*: o emulador nunca fala com o plan-ea4cc.
export function criarAmbiente(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-plan',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
}

export async function semear(env: RulesTestEnvironment): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin@gi.com'), {});
    await setDoc(doc(db, 'acessos/uid-liberado'), { status: 'liberado', email: 'liberado@x.com' });
    await setDoc(doc(db, 'acessos/uid-pendente'), { status: 'pendente', email: 'pendente@x.com' });
    await setDoc(doc(db, 'acessos/uid-bloqueado'), { status: 'bloqueado', email: 'bloqueado@x.com' });
    await setDoc(doc(db, 'users/uid-outro'), { planData: {} });
  });
}

export const ADMIN = { uid: 'uid-admin', token: { email: 'admin@gi.com', email_verified: true } };
export const LIBERADO = { uid: 'uid-liberado', token: { email: 'liberado@x.com', email_verified: true } };
export const PENDENTE = { uid: 'uid-pendente', token: { email: 'pendente@x.com', email_verified: true } };
export const BLOQUEADO = { uid: 'uid-bloqueado', token: { email: 'bloqueado@x.com', email_verified: true } };

export type Pessoa = typeof ADMIN;
