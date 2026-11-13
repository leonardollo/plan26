import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type StatusAcesso = 'pendente' | 'liberado' | 'bloqueado' | 'removido';

type Variaveis = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string; JWT_SECRET: string };

let cache: Variaveis | null = null;

/** Lê as chaves do Supabase LOCAL (`supabase status -o env`); nunca as da produção. */
export function variaveis(): Variaveis {
  if (cache) return cache;
  const saida = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const lidas: Record<string, string> = {};
  for (const linha of saida.split('\n')) {
    const m = linha.match(/^([A-Z_]+)="(.*)"$/);
    if (m) lidas[m[1]] = m[2];
  }
  const url = lidas.API_URL ?? '';
  // Guarda contra apontar os testes para um projeto de verdade.
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(`Os testes de banco só rodam contra o Supabase local; API_URL veio como "${url}".`);
  }
  cache = { API_URL: url, ANON_KEY: lidas.ANON_KEY, SERVICE_ROLE_KEY: lidas.SERVICE_ROLE_KEY, JWT_SECRET: lidas.JWT_SECRET };
  return cache;
}

const SEM_SESSAO = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export function clienteServico(): SupabaseClient {
  const v = variaveis();
  return createClient(v.API_URL, v.SERVICE_ROLE_KEY, SEM_SESSAO);
}

export function clienteAnonimo(): SupabaseClient {
  const v = variaveis();
  return createClient(v.API_URL, v.ANON_KEY, SEM_SESSAO);
}

export function emailUnico(prefixo: string): string {
  return `${prefixo}-${randomUUID().slice(0, 8)}@exemplo.com`;
}

export const SENHA = 'senha-de-teste-123';

function base64url(texto: string | Buffer): string {
  return Buffer.from(texto).toString('base64url');
}

/**
 * Token assinado com o segredo local, para quem não consegue entrar pela senha:
 * com a confirmação de e-mail ligada, conta não confirmada não recebe sessão.
 */
function tokenLocal(id: string, email: string): string {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corpo = base64url(
    JSON.stringify({ sub: id, email, role: 'authenticated', aud: 'authenticated', iat: agora, exp: agora + 3600 }),
  );
  const assinatura = createHmac('sha256', variaveis().JWT_SECRET).update(`${cabecalho}.${corpo}`).digest('base64url');
  return `${cabecalho}.${corpo}.${assinatura}`;
}

/**
 * Cria uma conta no Auth local (o gatilho põe o acesso como pendente), ajusta o
 * status e a tabela de admins pelo serviço, e devolve um cliente logado como ela.
 */
export async function criarPessoa(opcoes: {
  email: string;
  status?: StatusAcesso;
  admin?: boolean;
  confirmado?: boolean;
  nome?: string;
}): Promise<{ id: string; cliente: SupabaseClient; token: string }> {
  const servico = clienteServico();
  const confirmado = opcoes.confirmado ?? true;
  const { data, error } = await servico.auth.admin.createUser({
    email: opcoes.email,
    password: SENHA,
    email_confirm: confirmado,
    user_metadata: opcoes.nome ? { name: opcoes.nome } : {},
  });
  if (error) throw error;
  const id = data.user.id;

  if (opcoes.status && opcoes.status !== 'pendente') {
    const { error: e } = await servico.from('acessos').update({ status: opcoes.status }).eq('user_id', id);
    if (e) throw e;
  }
  if (opcoes.admin) {
    const { error: e } = await servico.from('admins').upsert({ email: opcoes.email.toLowerCase() });
    if (e) throw e;
  }

  const v = variaveis();
  if (!confirmado) {
    const token = tokenLocal(id, opcoes.email.toLowerCase());
    const cliente = createClient(v.API_URL, v.ANON_KEY, { ...SEM_SESSAO, accessToken: async () => token });
    return { id, cliente, token };
  }

  const cliente = createClient(v.API_URL, v.ANON_KEY, SEM_SESSAO);
  const { data: sessao, error: e } = await cliente.auth.signInWithPassword({ email: opcoes.email, password: SENHA });
  if (e) throw e;
  return { id, cliente, token: sessao.session.access_token };
}

/** Ano de hoje em UTC, a mesma referência da política de `planos`. */
export function anoUtc(): number {
  return new Date().getUTCFullYear();
}
