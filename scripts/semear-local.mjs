// Cria as contas fictícias do ambiente local no Supabase LOCAL (`npm run db:local`).
// Lê as chaves de `supabase status -o env`, como tests/db/ambiente.ts, e recusa qualquer URL que não seja local:
// nunca alcança o PLAN26. Rodar de novo não duplica nada.
// Uso: com `npm run db:local` no ar, rode `npm run db:local:semear`.
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const SENHA = 'senha-local-123';

// `status`: onde a conta fica na fila; `comPlano`: grava um plano do ano do plano para o admin abrir.
const CONTAS = [
  { email: 'cliente@exemplo.com', nome: 'Cliente de Teste', admin: false, status: 'liberado' },
  { email: 'admin@exemplo.com', nome: 'Admin de Teste', admin: true, status: 'liberado' },
  { email: 'pendente@exemplo.com', nome: 'Cliente Pendente', admin: false, status: 'pendente' },
  { email: 'removido@exemplo.com', nome: 'Cliente Removido', admin: false, status: 'removido', comPlano: true },
];

// Mesmo critério de anoDoPlanoAtual (src/services/planos.ts): o plano é sempre do ano seguinte.
const ANO_DO_PLANO = new Date().getFullYear() + 1;

function variaveisLocais() {
  const saida = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const lidas = {};
  for (const linha of saida.split('\n')) {
    const m = linha.match(/^([A-Z_]+)="(.*)"$/);
    if (m) lidas[m[1]] = m[2];
  }
  const url = lidas.API_URL ?? '';
  // Guarda contra semear um projeto de verdade.
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(`Este script só roda contra o Supabase local; API_URL veio como "${url}".`);
  }
  return { url, chaveDeServico: lidas.SERVICE_ROLE_KEY };
}

async function contaPorEmail(servico, email) {
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await servico.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    const achada = data.users.find((u) => u.email?.toLowerCase() === email);
    if (achada) return achada;
    if (data.users.length < 200) return null;
  }
}

async function garantirConta(servico, conta) {
  const atributos = { password: SENHA, email_confirm: true, user_metadata: { name: conta.nome } };
  const existente = await contaPorEmail(servico, conta.email);
  if (existente) {
    const { error } = await servico.auth.admin.updateUserById(existente.id, atributos);
    if (error) throw error;
    return existente.id;
  }
  // O gatilho do banco cria a linha de `acessos` como pendente.
  const { data, error } = await servico.auth.admin.createUser({ email: conta.email, ...atributos });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  const { url, chaveDeServico } = variaveisLocais();
  const servico = createClient(url, chaveDeServico, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  for (const conta of CONTAS) {
    const id = await garantirConta(servico, conta);
    const acesso = conta.status === 'liberado'
      ? { status: 'liberado', liberado_em: new Date().toISOString(), liberado_por: 'semear-local' }
      : { status: conta.status, liberado_em: null, liberado_por: null };
    const { error: e1 } = await servico.from('acessos').update(acesso).eq('user_id', id);
    if (e1) throw e1;
    if (conta.comPlano) {
      const dados = {
        planData: { companyProfile: { name: `Empresa de ${conta.nome}`, cnpj: '', industry: 'Serviços', geminiApiKey: '' } },
      };
      const { error: e3 } = await servico.from('planos').upsert({ user_id: id, ano: ANO_DO_PLANO, dados });
      if (e3) throw e3;
    }
    if (conta.admin) {
      const { error: e2 } = await servico.from('admins').upsert({ email: conta.email });
      if (e2) throw e2;
    }
    console.log(`ok: ${conta.email} (${conta.admin ? 'admin' : conta.status}${conta.comPlano ? `, plano ${ANO_DO_PLANO}` : ''})`);
  }
  console.log(`Senha de todas as contas: ${SENHA}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
