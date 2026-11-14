// Edge Function hotmart-webhook: a Hotmart avisa cada pagamento aqui (sem JWT; quem protege é o hottok).
// Só liga o Deno ao fluxo (fluxo.ts): segredos do ambiente, cliente com a service role e o Auth.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { URL_DO_APP } from '../admin-usuarios/regras.ts';
import { TAMANHO_MAXIMO_DO_CORPO } from './aviso.ts';
import { atenderWebhook, type DependenciasDoWebhook, type ResultadoDoBanco } from './fluxo.ts';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SEM_SESSAO = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

function dependencias(): DependenciasDoWebhook {
  const servico = createClient(URL, SERVICO, SEM_SESSAO);
  return {
    hottok: Deno.env.get('HOTMART_HOTTOK') || null,
    produtoId: Deno.env.get('HOTMART_PRODUTO_ID')?.trim() || null,
    async aplicar(transacao, email, tipo, evento) {
      const { data, error } = await servico.rpc('aplicar_pagamento_hotmart', {
        p_transacao: transacao,
        p_email: email,
        p_tipo: tipo,
        p_evento: evento,
      });
      if (error) throw new Error(`aplicar_pagamento_hotmart: ${error.message}`);
      return data as ResultadoDoBanco;
    },
    async criarConta(email) {
      const { data, error } = await servico.auth.admin.createUser({ email, email_confirm: true });
      if (error) {
        if (error.code === 'email_exists' || error.status === 422) return { jaExiste: true };
        throw new Error(`criar conta: ${error.message}`);
      }
      return { id: data.user!.id };
    },
    async nuncaEntrou(userId) {
      const { data, error } = await servico.auth.admin.getUserById(userId);
      if (error) throw new Error(`ler conta: ${error.message}`);
      return !data.user?.last_sign_in_at;
    },
    async enviarEmailDeSenha(email) {
      // why: o endereço de volta é fixo; nada do aviso decide para onde o link leva.
      const { error } = await servico.auth.resetPasswordForEmail(email, { redirectTo: URL_DO_APP });
      // why: quem loga é o fluxo, só com o código; a mensagem do Auth pode trazer o e-mail do comprador.
      if (error) throw error;
      return true;
    },
    async registrarFalhaDeEmail(userId, email, transacao) {
      const { error } = await servico.rpc('registrar_acao_admin', {
        admin_email: 'hotmart',
        acao: 'e-mail de senha não saiu',
        alvo: userId,
        alvo_email: email,
        detalhe: { transacao },
      });
      if (error) throw new Error(`registrar: ${error.message}`);
    },
  };
}

/** Lê o corpo até o limite + 1 byte: um corpo enorme sem Content-Length não é lido inteiro. */
async function lerCorpoLimitado(req: Request): Promise<string> {
  if (!req.body) return '';
  const leitor = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  while (total <= TAMANHO_MAXIMO_DO_CORPO) {
    const { done, value } = await leitor.read();
    if (done) break;
    partes.push(value);
    total += value.length;
  }
  if (total > TAMANHO_MAXIMO_DO_CORPO) {
    await leitor.cancel();
    return 'x'.repeat(TAMANHO_MAXIMO_DO_CORPO + 1);
  }
  const junto = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    junto.set(p, pos);
    pos += p.length;
  }
  return new TextDecoder().decode(junto);
}

Deno.serve(async (req) => {
  const declarado = Number(req.headers.get('Content-Length'));
  const tamanho = Number.isFinite(declarado) && declarado > 0 ? declarado : null;
  // O fluxo só chama lerCorpo depois de conferir método, segredo, hottok e o tamanho declarado.
  const r = await atenderWebhook(
    { metodo: req.method, hottok: req.headers.get('x-hotmart-hottok'), tamanho, lerCorpo: () => lerCorpoLimitado(req) },
    dependencias(),
  );
  return new Response(JSON.stringify(r.corpo), { status: r.status, headers: { 'Content-Type': 'application/json' } });
});
