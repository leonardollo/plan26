// Regras do Firestore na virada ao Supabase.
//
//   node --env-file=.env.local scripts/regras-do-firebase.mjs salvar      guarda as regras no ar em firestore.no-ar.rules
//   node --env-file=.env.local scripts/regras-do-firebase.mjs congelar    publica firestore.congelado.rules (lê, não grava)
//   node --env-file=.env.local scripts/regras-do-firebase.mjs restaurar   publica de volta firestore.no-ar.rules
//
// Credencial: GOOGLE_APPLICATION_CREDENTIALS. Publicar regras é passo humano (ver docs/VIRADA-SUPABASE.md).
// O Firebase compila as regras antes de publicar: um arquivo com erro é recusado e as regras no ar não mudam.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { appDoFirebase } from './migracao/ler-firebase.mjs';

const RAIZ = join(import.meta.dirname, '..');
const NO_AR = join(RAIZ, 'firestore.no-ar.rules');
const CONGELADO = join(RAIZ, 'firestore.congelado.rules');

async function principal() {
  const acao = process.argv[2];
  if (process.argv.length !== 3 || !['salvar', 'congelar', 'restaurar'].includes(acao)) {
    throw new Error('Use: regras-do-firebase.mjs <salvar|congelar|restaurar>');
  }
  const regras = getSecurityRules(appDoFirebase());

  if (acao === 'salvar') {
    // Salvar de novo depois de congelar guardaria as congeladas como "as de antes", e o restaurar não desfaria nada.
    if (existsSync(NO_AR)) throw new Error('firestore.no-ar.rules já existe; apague-o à mão se quiser salvar de novo.');
    const fonte = (await regras.getFirestoreRuleset()).source.map((f) => f.content).join('\n');
    if (fonte.trim() === readFileSync(CONGELADO, 'utf8').trim()) throw new Error('As regras no ar já são as congeladas; nada salvo.');
    writeFileSync(NO_AR, fonte);
    console.log('Regras no ar salvas em firestore.no-ar.rules.');
    return 0;
  }

  if (!existsSync(NO_AR)) throw new Error('Falta firestore.no-ar.rules: rode "salvar" antes, para haver como voltar.');
  const arquivo = acao === 'congelar' ? CONGELADO : NO_AR;
  const publicado = await regras.releaseFirestoreRulesetFromSource(readFileSync(arquivo, 'utf8'));
  console.log(`Publicado ${acao === 'congelar' ? 'firestore.congelado.rules' : 'firestore.no-ar.rules'} (ruleset ${publicado.name}).`);
  return 0;
}

principal().then(
  (codigo) => process.exit(codigo),
  (erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  },
);
