// Transformação pura dos dados do Firebase para o formato do Supabase.
// Não lê nem grava nada: recebe o que ler-firebase.mjs juntou e devolve o que gravar-supabase.mjs grava,
// com os avisos (listado e não importado) e os impedimentos (nada é gravado enquanto houver um).

// Os blocos do plano que o app usa; o resto do documento não é dado do cliente (ver avisos).
export const BLOCOS_DO_PLANO = ['planData', 'goals2026', 'scenarios2026', 'tracking2026', 'taxes', 'pricingItems'];

// O documento `users/{uid}` é o plano de 2026; os anos seguintes ficam em `users/{uid}/planos/{ano}`.
const ANO_DO_DOCUMENTO_DO_USUARIO = 2026;
const SUBCOLECOES_CONHECIDAS = ['planos'];
const STATUS = ['pendente', 'liberado', 'bloqueado'];

function ehObjetoSimples(v) {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Converte para JSON puro; Timestamp (toDate) e Date viram texto ISO; o resto registra impedimento com o caminho. */
export function paraJson(valor, caminho, impedimentos) {
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') {
    if (Number.isFinite(valor)) return valor;
    impedimentos.push(`${caminho}: número que não cabe em JSON (${valor})`);
    return null;
  }
  if (valor instanceof Date) return valor.toISOString();
  if (valor && typeof valor === 'object' && typeof valor.toDate === 'function') return valor.toDate().toISOString();
  if (Array.isArray(valor)) return valor.map((v, i) => paraJson(v, `${caminho}[${i}]`, impedimentos));
  if (ehObjetoSimples(valor)) {
    const saida = {};
    for (const [k, v] of Object.entries(valor)) saida[k] = paraJson(v, `${caminho}.${k}`, impedimentos);
    return saida;
  }
  const tipo = valor === undefined ? 'undefined' : (valor?.constructor?.name ?? typeof valor);
  impedimentos.push(`${caminho}: valor que não é JSON (${tipo})`);
  return null;
}

function dataOuNull(valor, contexto, avisos) {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object' && typeof valor.toDate === 'function') return valor.toDate().toISOString();
  if (typeof valor === 'string' && !Number.isNaN(Date.parse(valor))) return new Date(valor).toISOString();
  avisos.push(`${contexto}: data que não entendi; importada como vazia`);
  return null;
}

/** Entrada e Migracao: os tipos descritos na Tarefa 5 de docs/superpowers/plans/2026-11-12-migracao-supabase.md. */
export function transformar(entrada) {
  const avisos = [];
  const impedimentos = [];

  // uid → e-mail em minúsculas; e-mail → uids, para achar duplicados.
  const emailDoUid = new Map();
  const uidsDoEmail = new Map();
  const usuarios = [];
  for (const u of entrada.usuariosAuth) {
    const email = u.email?.trim().toLowerCase();
    if (!email) {
      avisos.push(`usuário ${u.uid} sem e-mail no Auth: não importado`);
      continue;
    }
    emailDoUid.set(u.uid, email);
    uidsDoEmail.set(email, [...(uidsDoEmail.get(email) ?? []), u.uid]);
    if (uidsDoEmail.get(email).length === 1) {
      usuarios.push({ email, nome: u.nome ?? null, temSenha: u.provedores.includes('password') });
    }
  }
  for (const uids of uidsDoEmail.values()) {
    if (uids.length > 1) impedimentos.push(`o mesmo e-mail (a menos de maiúsculas) em uids diferentes: ${uids.join(', ')}`);
  }

  const acessos = [];
  for (const a of entrada.acessos) {
    const email = emailDoUid.get(a.uid);
    if (!email) {
      avisos.push(`acesso ${a.uid} sem usuário no Auth: não importado`);
      continue;
    }
    let status = a.status;
    if (!STATUS.includes(status)) {
      avisos.push(`acesso ${a.uid} com status desconhecido '${status}': importado como pendente`);
      status = 'pendente';
    }
    acessos.push({
      email,
      status,
      liberadoEm: dataOuNull(a.liberadoEm, `acesso ${a.uid}, liberadoEm`, avisos),
      liberadoPor: a.liberadoPor ?? null,
    });
  }

  const planos = [];
  const chaves = new Map();
  const juntarPlano = (uid, ano, campos, caminho) => {
    const email = emailDoUid.get(uid);
    if (!email) {
      avisos.push(`${caminho}: uid sem usuário no Auth (ou sem e-mail); plano não importado`);
      return;
    }
    const dados = {};
    for (const [campo, valor] of Object.entries(campos)) {
      if (BLOCOS_DO_PLANO.includes(campo)) dados[campo] = paraJson(valor, `${caminho}.${campo}`, impedimentos);
      else avisos.push(`${caminho}: campo '${campo}' fora do plano; não importado`);
    }
    if (Object.keys(dados).length === 0) return;
    const chave = `${email}|${ano}`;
    if (chaves.has(chave)) {
      impedimentos.push(`dois planos de ${ano} para o mesmo usuário: ${chaves.get(chave)} e ${caminho}`);
      return;
    }
    chaves.set(chave, caminho);
    planos.push({ email, ano, dados });
  };

  for (const d of entrada.documentosDeUsuario) {
    for (const sub of d.subcolecoes) {
      if (!SUBCOLECOES_CONHECIDAS.includes(sub)) avisos.push(`users/${d.uid}: subcoleção desconhecida '${sub}'; não importada`);
    }
    juntarPlano(d.uid, ANO_DO_DOCUMENTO_DO_USUARIO, d.campos, `users/${d.uid}`);
  }
  for (const p of entrada.planosPorAno) {
    const caminho = `users/${p.uid}/planos/${p.ano}`;
    if (!/^[0-9]{4}$/.test(p.ano)) {
      avisos.push(`${caminho}: ano '${p.ano}' inválido; não importado`);
      continue;
    }
    juntarPlano(p.uid, Number(p.ano), p.campos, caminho);
  }

  const emails = new Set(usuarios.map((u) => u.email));
  const admins = [];
  for (const id of entrada.admins) {
    const email = id.trim().toLowerCase();
    if (admins.some((a) => a.email === email)) continue;
    const temConta = emails.has(email);
    if (!temConta) avisos.push(`admin ${email} sem conta no Auth: importado, entra quando a pessoa se cadastrar`);
    admins.push({ email, temConta });
  }

  return { usuarios, acessos, planos, admins, avisos, impedimentos };
}
