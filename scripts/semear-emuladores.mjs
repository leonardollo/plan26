// Cria as contas fictícias do ambiente local nos emuladores do Firebase.
// Fala só com 127.0.0.1 e com o projeto demo-plan: nunca alcança o plan-ea4cc.
// Uso: com `npm run emuladores` aberto, rode `npm run emuladores:semear`.

const PROJETO = 'demo-plan';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROJETO}/databases/(default)/documents`;
// "Bearer owner" é o acesso de administrador que só os emuladores aceitam; ignora as regras.
const DONO = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const SENHA = 'senha-local-123';

const CONTAS = [
  { email: 'cliente@exemplo.com', nome: 'Cliente de Teste', admin: false },
  { email: 'admin@exemplo.com', nome: 'Admin de Teste', admin: true },
];

async function pedir(url, corpo, cabecalhos = { 'Content-Type': 'application/json' }, metodo = 'POST') {
  const r = await fetch(url, { method: metodo, headers: cabecalhos, body: JSON.stringify(corpo) });
  const dados = await r.json().catch(() => ({}));
  return { ok: r.ok, dados };
}

async function uidDaConta(email) {
  const novo = await pedir(`${AUTH}/accounts:signUp?key=demo`, { email, password: SENHA, returnSecureToken: true });
  if (novo.ok) return novo.dados.localId;
  const login = await pedir(`${AUTH}/accounts:signInWithPassword?key=demo`, { email, password: SENHA, returnSecureToken: true });
  if (login.ok) return login.dados.localId;
  throw new Error(`Não consegui criar nem entrar com ${email}: ${JSON.stringify(novo.dados)}`);
}

async function gravar(caminho, campos) {
  const fields = Object.fromEntries(
    Object.entries(campos).map(([k, v]) => [
      k,
      typeof v === 'boolean' ? { booleanValue: v } : v instanceof Date ? { timestampValue: v.toISOString() } : { stringValue: v },
    ])
  );
  const r = await pedir(`${FIRESTORE}/${caminho}`, { fields }, DONO, 'PATCH');
  if (!r.ok) throw new Error(`Falha ao gravar ${caminho}: ${JSON.stringify(r.dados)}`);
}

async function main() {
  for (const conta of CONTAS) {
    const uid = await uidDaConta(conta.email);
    const atualizado = await pedir(
      `${AUTH}/projects/${PROJETO}/accounts:update`,
      { localId: uid, emailVerified: true, displayName: conta.nome },
      DONO
    );
    if (!atualizado.ok) throw new Error(`Falha ao verificar ${conta.email}: ${JSON.stringify(atualizado.dados)}`);

    await gravar(`acessos/${uid}`, {
      email: conta.email,
      nome: conta.nome,
      status: 'liberado',
      emailVerificado: true,
      // A fila do admin ordena por criadoEm; sem ele o pedido some da lista.
      criadoEm: new Date(),
    });
    if (conta.admin) await gravar(`admins/${conta.email}`, { email: conta.email });
    console.log(`ok  ${conta.email}${conta.admin ? ' (admin)' : ''}`);
  }
  console.log(`\nSenha das duas contas: ${SENHA}`);
}

main().catch((e) => {
  console.error(e.message);
  console.error('Os emuladores estão abertos? Rode `npm run emuladores` em outro terminal.');
  process.exit(1);
});
