// Migração do Firebase para o Supabase.
//
//   node --env-file=.env.local scripts/migrar-firebase-para-supabase.mjs                 simula: lê o Firebase e só imprime
//   node --env-file=.env.local scripts/migrar-firebase-para-supabase.mjs --aplicar --confirmo=<ref>   grava e confere
//
// Variáveis: GOOGLE_APPLICATION_CREDENTIALS (leitura do Firebase); SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (só com --aplicar).
// Rodar contra a produção é passo humano (ver docs/VIRADA-SUPABASE.md).
import { createClient } from '@supabase/supabase-js';
import { conferir } from './migracao/conferir.mjs';
import { conferirDestino } from './migracao/destino.mjs';
import { gravarSupabase } from './migracao/gravar-supabase.mjs';
import { lerFirebase } from './migracao/ler-firebase.mjs';
import { transformar } from './migracao/transformar.mjs';

function argumentos(lista) {
  let aplicar = false;
  let confirmo;
  for (const a of lista) {
    if (a === '--aplicar') aplicar = true;
    else if (a.startsWith('--confirmo=')) confirmo = a.slice('--confirmo='.length);
    else throw new Error(`Argumento desconhecido: ${a}`);
  }
  return { aplicar, confirmo };
}

function listar(titulo, itens) {
  console.log(`\n${titulo} (${itens.length})`);
  for (const i of itens) console.log(`  - ${i}`);
}

async function principal() {
  const { aplicar, confirmo } = argumentos(process.argv.slice(2));
  // Confere o destino antes de ler o Firebase: um engano no --confirmo não deve custar a leitura inteira.
  const destino = aplicar ? conferirDestino(process.env.SUPABASE_URL, confirmo) : null;

  const m = transformar(await lerFirebase());
  console.log('Lido do Firebase:');
  console.log(`  usuários ${m.usuarios.length} (com senha ${m.usuarios.filter((u) => u.temSenha).length})`);
  console.log(`  acessos ${m.acessos.length}, planos ${m.planos.length}, admins ${m.admins.length}`);
  listar('Avisos', m.avisos);
  listar('Impedimentos', m.impedimentos);

  if (m.impedimentos.length > 0) {
    console.error('\nHá impedimentos: nada foi gravado.');
    return 1;
  }
  if (!aplicar) {
    console.log('\nSimulação: nada foi gravado. Para gravar, use --aplicar.');
    return 0;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY não definida.');
  console.log(`\nGravando em ${destino.host}${destino.local ? ' (local)' : ''}...`);
  const cliente = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r = await gravarSupabase(cliente, m);
  console.log(`  usuários criados ${r.criados}, reaproveitados ${r.reaproveitados}; planos gravados ${r.planosGravados}`);
  listar('Planos não sobrescritos (editados no app novo)', r.planosRecusados);

  const c = await conferir(cliente, m);
  console.log('\nConferência:');
  for (const [nome, { esperado, achado }] of Object.entries(c.contagens)) console.log(`  ${nome}: esperado ${esperado}, achado ${achado}`);
  // O plano recusado difere do Firebase de propósito (vale a edição do cliente); o resto é erro.
  const esperadas = new Set(r.planosRecusados.map((rotulo) => `plano ${rotulo}: dados diferentes do Firebase`));
  const inesperadas = c.diferencas.filter((d) => !esperadas.has(d));
  listar('Diferenças', inesperadas);
  return inesperadas.length > 0 ? 1 : 0;
}

principal().then(
  (codigo) => process.exit(codigo),
  (erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  },
);
