// Grava no Supabase o que transformar() devolveu. Recebe um cliente com a chave service_role
// (passa por cima do RLS), por isso só roda nos scripts, nunca no app.
// Pode rodar de novo: reaproveita usuários pelo e-mail e não sobrescreve plano editado no app novo.

const POR_PAGINA = 1000;

/** e-mail em minúsculas → id de todos os usuários do Auth (listUsers paginado). */
export async function idsPorEmail(cliente) {
  const ids = new Map();
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await cliente.auth.admin.listUsers({ page: pagina, perPage: POR_PAGINA });
    if (error) throw error;
    for (const u of data.users) if (u.email) ids.set(u.email.toLowerCase(), u.id);
    if (data.users.length < POR_PAGINA) return ids;
  }
}

function exigir(resultado, contexto) {
  if (resultado.error) throw new Error(`${contexto}: ${resultado.error.message}`);
  return resultado.data;
}

export async function gravarSupabase(cliente, m) {
  if (m.impedimentos.length > 0) throw new Error('Há impedimentos; nada foi gravado.');
  const ids = await idsPorEmail(cliente);
  let criados = 0;
  let reaproveitados = 0;

  for (const u of m.usuarios) {
    if (ids.has(u.email)) {
      reaproveitados++;
      continue;
    }
    // Sem senha e já confirmado: quem usava senha cria uma pelo e-mail; quem usava Google entra
    // pelo Google e o Supabase liga a identidade a esta conta pelo e-mail confirmado.
    const criado = exigir(
      await cliente.auth.admin.createUser({ email: u.email, email_confirm: true, user_metadata: { name: u.nome ?? undefined } }),
      `criar ${u.email}`,
    );
    ids.set(u.email, criado.user.id);
    criados++;
  }

  const idDe = (email) => {
    const id = ids.get(email);
    if (!id) throw new Error(`${email} não existe no Auth do Supabase.`);
    return id;
  };

  for (const a of m.acessos) {
    exigir(
      await cliente
        .from('acessos')
        .update({ status: a.status, liberado_em: a.liberadoEm, liberado_por: a.liberadoPor })
        .eq('user_id', idDe(a.email))
        .select('user_id')
        .single(),
      `acesso de ${a.email}`,
    );
  }

  let planosGravados = 0;
  const planosRecusados = [];
  for (const p of m.planos) {
    const userId = idDe(p.email);
    const rotulo = `${p.email} ${p.ano}`;
    // Qualquer valor novo serve: o gatilho troca por now() e iguala a atualizado_em.
    const linha = { user_id: userId, ano: p.ano, dados: p.dados, importado_em: new Date().toISOString() };
    const existente = exigir(
      await cliente.from('planos').select('atualizado_em, importado_em').eq('user_id', userId).eq('ano', p.ano).maybeSingle(),
      `ler plano ${rotulo}`,
    );

    if (!existente) {
      const r = await cliente.from('planos').insert(linha);
      // 23505: o cliente criou o plano entre a leitura e a gravação; o dele vale.
      if (r.error?.code === '23505') planosRecusados.push(rotulo);
      else if (r.error) throw new Error(`gravar plano ${rotulo}: ${r.error.message}`);
      else planosGravados++;
      continue;
    }

    // Linha sem importado_em nasceu no app novo; com atualizado_em depois dele, alguém editou. Nos dois casos o cliente manda.
    const editado = !existente.importado_em || new Date(existente.atualizado_em) > new Date(existente.importado_em);
    if (editado) {
      planosRecusados.push(rotulo);
      continue;
    }
    // O filtro por atualizado_em fecha a janela entre a leitura e a gravação: se o cliente salvou no meio, nada muda.
    const atualizadas = exigir(
      await cliente
        .from('planos')
        .update(linha)
        .eq('user_id', userId)
        .eq('ano', p.ano)
        .eq('atualizado_em', existente.atualizado_em)
        .select('ano'),
      `gravar plano ${rotulo}`,
    );
    if (atualizadas.length === 1) planosGravados++;
    else planosRecusados.push(rotulo);
  }

  if (m.admins.length > 0) {
    exigir(
      await cliente.from('admins').upsert(m.admins.map((a) => ({ email: a.email })), { onConflict: 'email', ignoreDuplicates: true }),
      'admins',
    );
  }

  return { criados, reaproveitados, planosGravados, planosRecusados };
}
