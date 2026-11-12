// E-mails "crie sua senha" para quem entrava com senha no Firebase e já foi importado no Supabase.
//
//   node --env-file=.env.local scripts/enviar-criar-senha.mjs                          só conta
//   node --env-file=.env.local scripts/enviar-criar-senha.mjs --enviar --confirmo=<ref>   envia
//
// Variáveis: GOOGLE_APPLICATION_CREDENTIALS, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
// Enviar para a produção é passo humano (ver docs/VIRADA-SUPABASE.md). Não imprime e-mails.
import { createClient } from '@supabase/supabase-js';
import { destinatarios, enviarEmLotes } from './migracao/criar-senha.mjs';
import { conferirDestino } from './migracao/destino.mjs';
import { idsPorEmail } from './migracao/gravar-supabase.mjs';
import { lerUsuariosDoAuth } from './migracao/ler-firebase.mjs';

// O link do e-mail leva ao app novo, que abre a tela "Crie sua senha".
const ENDERECO_DO_APP = 'https://plan.gestaoimpacto.com';

async function principal() {
  let enviar = false;
  let confirmo;
  for (const a of process.argv.slice(2)) {
    if (a === '--enviar') enviar = true;
    else if (a.startsWith('--confirmo=')) confirmo = a.slice('--confirmo='.length);
    else throw new Error(`Argumento desconhecido: ${a}`);
  }
  const destino = enviar ? conferirDestino(process.env.SUPABASE_URL, confirmo) : null;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias (o script confere quem já existe no Supabase).');
  }

  const cliente = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const noSupabase = new Set((await idsPorEmail(cliente)).keys());
  const { emails, semContaNoSupabase } = destinatarios(await lerUsuariosDoAuth(), noSupabase);
  console.log(`Com senha no Firebase e conta no Supabase: ${emails.length}`);
  console.log(`Com senha no Firebase e sem conta no Supabase (rode a importação antes): ${semContaNoSupabase}`);

  if (!enviar) {
    console.log('\nNada foi enviado. Para enviar, use --enviar.');
    return 0;
  }

  console.log(`\nEnviando por ${destino.host}, em lotes de 10 com 30 s entre eles...`);
  const r = await enviarEmLotes(
    emails,
    (email) => cliente.auth.resetPasswordForEmail(email, { redirectTo: ENDERECO_DO_APP }),
    (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
  );
  console.log(`Enviados: ${r.enviados}. Falharam: ${r.falhas.length}.`);
  for (const [mensagem, vezes] of Object.entries(Object.groupBy(r.falhas, (f) => f))) console.log(`  - ${mensagem} (${vezes.length})`);
  return r.falhas.length > 0 ? 1 : 0;
}

principal().then(
  (codigo) => process.exit(codigo),
  (erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  },
);
