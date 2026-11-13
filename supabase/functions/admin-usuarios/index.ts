// Edge Function admin-usuarios: o admin adiciona um cliente (conta confirmada, já liberada) e
// (re)envia o "Defina sua senha". A chave secreta só existe aqui, no servidor (SUPABASE_SERVICE_ROLE_KEY,
// injetada pelo Supabase); o app chama esta função com o token do admin.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';
import { atender, type Conta, type Dependencias } from './fluxo.ts';
import { URL_DO_APP } from './regras.ts';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SEM_SESSAO = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

function falhar(onde: string, erro: unknown): never {
  console.error(`admin-usuarios: ${onde}`, erro);
  throw new Error(onde);
}

function dependencias(autorizacao: string | null): Dependencias {
  const servico = createClient(URL, SERVICO, SEM_SESSAO);
  // why: sou_admin() e definir_status_de_acesso rodam com o token de quem chamou, para valerem as mesmas
  // regras do banco (admin com e-mail confirmado, Registro com o e-mail do admin).
  const deQuemChama: SupabaseClient = createClient(URL, ANON, {
    ...SEM_SESSAO,
    global: { headers: autorizacao ? { Authorization: autorizacao } : {} },
  });
  const token = (autorizacao ?? '').replace(/^Bearer\s+/i, '');

  async function contaOnde(coluna: 'email' | 'user_id', valor: string): Promise<Conta | null> {
    const { data, error } = await servico.from('acessos').select('user_id, email, status').eq(coluna, valor).maybeSingle();
    if (error) falhar('ler acessos', error);
    return data ? { id: data.user_id, email: data.email, status: data.status } : null;
  }

  return {
    async quemChama() {
      const { data, error } = await servico.auth.getUser(token);
      if (error || !data.user?.email) return null;
      return { email: data.user.email.toLowerCase() };
    },
    async souAdmin() {
      const { data, error } = await deQuemChama.rpc('sou_admin');
      if (error) return false;
      return data === true;
    },
    contaPorEmail: (email) => contaOnde('email', email),
    contaPorId: (id) => contaOnde('user_id', id),
    async ehAdmin(email) {
      const { data, error } = await servico.from('admins').select('email').eq('email', email).maybeSingle();
      if (error) falhar('ler admins', error);
      return data !== null;
    },
    async criarConta(email, nome) {
      const { data, error } = await servico.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name: nome } });
      if (error) {
        if (error.code === 'email_exists' || error.status === 422) return { jaExiste: true };
        falhar('criar conta', error);
      }
      return { id: data.user!.id };
    },
    async liberar(id) {
      const { error } = await deQuemChama.rpc('definir_status_de_acesso', { alvo: id, novo_status: 'liberado' });
      if (error) falhar('liberar', error);
    },
    async enviarEmailDeSenha(email) {
      // why: o endereço de volta é fixo; nada do corpo do pedido decide para onde o link leva.
      const { error } = await servico.auth.resetPasswordForEmail(email, { redirectTo: URL_DO_APP });
      if (error) console.error('admin-usuarios: e-mail de senha', error);
      return !error;
    },
    async registrar(adminEmail, acao, alvo, alvoEmail, detalhe) {
      const { error } = await servico.rpc('registrar_acao_admin', {
        admin_email: adminEmail,
        acao,
        alvo,
        alvo_email: alvoEmail,
        detalhe,
      });
      if (error) falhar('registrar', error);
    },
  };
}

Deno.serve(async (req) => {
  const autorizacao = req.headers.get('Authorization');
  let corpo: unknown = null;
  if (req.method === 'POST') {
    try {
      corpo = await req.json();
    } catch {
      corpo = null;
    }
  }
  try {
    const r = await atender(
      { metodo: req.method, origem: req.headers.get('Origin'), autorizacao, corpo },
      dependencias(autorizacao),
    );
    const cabecalhos = { ...r.cabecalhos, ...(r.corpo === null ? {} : { 'Content-Type': 'application/json' }) };
    return new Response(r.corpo === null ? null : JSON.stringify(r.corpo), { status: r.status, headers: cabecalhos });
  } catch {
    return new Response(JSON.stringify({ erro: 'Erro interno; tente de novo' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
