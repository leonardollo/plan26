// Quem recebe o e-mail "crie sua senha" e como ele sai. Puro, para ser testado sem mandar e-mail nenhum.

/** Quem entrava com senha no Firebase e já tem conta no Supabase. Quem usava só Google continua com o Google. */
export function destinatarios(usuariosAuth, emailsNoSupabase) {
  const emails = new Set();
  let semContaNoSupabase = 0;
  for (const u of usuariosAuth) {
    const email = u.email?.trim().toLowerCase();
    if (!email || !u.provedores.includes('password')) continue;
    if (emailsNoSupabase.has(email)) emails.add(email);
    else semContaNoSupabase++;
  }
  return { emails: [...emails].sort(), semContaNoSupabase };
}

/** Envia em lotes, com pausa entre eles: o envio de e-mail do Supabase tem limite por hora. Não lança: conta as falhas. */
export async function enviarEmLotes(emails, enviar, esperar, { tamanho = 10, pausaMs = 30_000 } = {}) {
  let enviados = 0;
  const falhas = [];
  for (let i = 0; i < emails.length; i += tamanho) {
    if (i > 0) await esperar(pausaMs);
    for (const email of emails.slice(i, i + tamanho)) {
      try {
        const { error } = await enviar(email);
        if (error) falhas.push(error.message);
        else enviados++;
      } catch (erro) {
        falhas.push(erro instanceof Error ? erro.message : String(erro));
      }
    }
  }
  return { enviados, falhas };
}
