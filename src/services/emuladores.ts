/**
 * Ambiente local: login e banco fictícios dos emuladores do Firebase.
 *
 * Serve para ver as telas internas sem conta real e sem tocar no plan-ea4cc.
 * Liga só no servidor de desenvolvimento aberto com `npm run dev:local`
 * (`vite --mode emuladores`). No build de produção `import.meta.env.DEV` é
 * `false`, então o modo nunca liga, qualquer que seja o `--mode`.
 */
import { connectAuthEmulator, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

export const MODO_EMULADORES = 'emuladores';

// Projeto demo-*: o emulador nunca alcança um projeto real do Firebase.
export const PROJETO_DOS_EMULADORES = 'demo-plan';

export const CONFIG_DOS_EMULADORES = {
  apiKey: 'demo-chave-local',
  authDomain: `${PROJETO_DOS_EMULADORES}.firebaseapp.com`,
  projectId: PROJETO_DOS_EMULADORES,
  storageBucket: `${PROJETO_DOS_EMULADORES}.appspot.com`,
  messagingSenderId: '0',
  appId: '1:0:web:0',
};

// As mesmas portas do bloco `emulators` do firebase.json.
export const PORTA_AUTH = 9099;
export const PORTA_FIRESTORE = 8080;

export function usarEmuladores(dev: boolean, modo: string): boolean {
  return dev === true && modo === MODO_EMULADORES;
}

export function conectarAosEmuladores(auth: Auth, db: Firestore): void {
  connectAuthEmulator(auth, `http://127.0.0.1:${PORTA_AUTH}`, { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', PORTA_FIRESTORE);
}
