// Depois de gravar, lê de volta do Supabase e compara com o que devia estar lá.
import { idsPorEmail } from './gravar-supabase.mjs';

const LOTE = 100;

/** JSON com as chaves ordenadas: o jsonb não guarda a ordem das chaves, então a comparação não pode depender dela. */
export function canonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico(valor[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(valor);
}

async function lerEmLotes(cliente, tabela, colunas, coluna, valores) {
  const linhas = [];
  for (let i = 0; i < valores.length; i += LOTE) {
    const { data, error } = await cliente.from(tabela).select(colunas).in(coluna, valores.slice(i, i + LOTE));
    if (error) throw new Error(`ler ${tabela}: ${error.message}`);
    linhas.push(...data);
  }
  return linhas;
}

const instante = (v) => (v == null ? null : new Date(v).getTime());

export async function conferir(cliente, m) {
  const diferencas = [];
  const ids = await idsPorEmail(cliente);
  const idsEsperados = [...new Set(m.usuarios.map((u) => ids.get(u.email)).filter(Boolean))];

  const usuariosAchados = m.usuarios.filter((u) => ids.has(u.email)).length;
  for (const u of m.usuarios) if (!ids.has(u.email)) diferencas.push(`usuário ${u.email} não existe no Supabase`);

  const acessos = new Map(
    (await lerEmLotes(cliente, 'acessos', 'user_id, status, liberado_em, liberado_por', 'user_id', idsEsperados)).map((a) => [a.user_id, a]),
  );
  let acessosAchados = 0;
  for (const a of m.acessos) {
    const achado = acessos.get(ids.get(a.email));
    if (!achado) {
      diferencas.push(`acesso de ${a.email} não existe`);
      continue;
    }
    acessosAchados++;
    if (achado.status !== a.status) diferencas.push(`acesso de ${a.email}: status ${achado.status}, esperado ${a.status}`);
    if (instante(achado.liberado_em) !== instante(a.liberadoEm)) diferencas.push(`acesso de ${a.email}: liberado_em diferente`);
    if ((achado.liberado_por ?? null) !== a.liberadoPor) diferencas.push(`acesso de ${a.email}: liberado_por diferente`);
  }

  const planos = new Map(
    (await lerEmLotes(cliente, 'planos', 'user_id, ano, dados', 'user_id', idsEsperados)).map((p) => [`${p.user_id}|${p.ano}`, p]),
  );
  let planosAchados = 0;
  for (const p of m.planos) {
    const achado = planos.get(`${ids.get(p.email)}|${p.ano}`);
    if (!achado) {
      diferencas.push(`plano ${p.email} ${p.ano} não existe`);
      continue;
    }
    planosAchados++;
    if (canonico(achado.dados) !== canonico(p.dados)) diferencas.push(`plano ${p.email} ${p.ano}: dados diferentes do Firebase`);
  }

  const emailsAdmins = m.admins.map((a) => a.email);
  const admins = new Set((await lerEmLotes(cliente, 'admins', 'email', 'email', emailsAdmins)).map((a) => a.email));
  for (const e of emailsAdmins) if (!admins.has(e)) diferencas.push(`admin ${e} não existe`);

  return {
    contagens: {
      usuarios: { esperado: m.usuarios.length, achado: usuariosAchados },
      acessos: { esperado: m.acessos.length, achado: acessosAchados },
      planos: { esperado: m.planos.length, achado: planosAchados },
      admins: { esperado: emailsAdmins.length, achado: admins.size },
    },
    diferencas,
  };
}
