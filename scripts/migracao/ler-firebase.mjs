// Lê do Firebase (projeto plan-ea4cc) tudo o que a migração precisa. Só leitura: nenhuma chamada aqui grava,
// e o Firebase continua de pé depois da virada. Credencial: a conta de serviço em GOOGLE_APPLICATION_CREDENTIALS.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Fixo de propósito: uma credencial de outro projeto falha em vez de ler o banco errado.
const PROJETO_FIREBASE = 'plan-ea4cc';

/** Devolve a Entrada da Tarefa 5 (ver transformar.mjs). */
export async function lerFirebase() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('GOOGLE_APPLICATION_CREDENTIALS não definida.');
  const app = initializeApp({ credential: applicationDefault(), projectId: PROJETO_FIREBASE }, 'migracao-leitura');
  const auth = getAuth(app);
  const db = getFirestore(app);

  const usuariosAuth = [];
  let pageToken;
  do {
    const pagina = await auth.listUsers(1000, pageToken);
    for (const u of pagina.users) {
      usuariosAuth.push({
        uid: u.uid,
        email: u.email ?? null,
        nome: u.displayName ?? null,
        provedores: u.providerData.map((p) => p.providerId),
      });
    }
    pageToken = pagina.pageToken;
  } while (pageToken);

  const admins = (await db.collection('admins').get()).docs.map((d) => d.id);

  const acessos = (await db.collection('acessos').get()).docs.map((d) => {
    const v = d.data();
    return { uid: d.id, status: v.status, liberadoEm: v.liberadoEm ?? null, liberadoPor: v.liberadoPor ?? null };
  });

  // listDocuments inclui users/{uid} que só existem como "pasta" de planos/{ano}, sem campos próprios.
  const documentosDeUsuario = [];
  const planosPorAno = [];
  for (const ref of await db.collection('users').listDocuments()) {
    const snap = await ref.get();
    const subcolecoes = (await ref.listCollections()).map((c) => c.id);
    documentosDeUsuario.push({ uid: ref.id, campos: snap.exists ? snap.data() : {}, subcolecoes });
    if (subcolecoes.includes('planos')) {
      for (const p of (await ref.collection('planos').get()).docs) planosPorAno.push({ uid: ref.id, ano: p.id, campos: p.data() });
    }
  }

  return { usuariosAuth, admins, acessos, documentosDeUsuario, planosPorAno };
}
