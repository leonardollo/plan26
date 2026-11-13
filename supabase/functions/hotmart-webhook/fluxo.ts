// O fluxo da Edge Function hotmart-webhook, sem Deno e sem rede: o index.ts injeta o acesso ao Supabase,
// e o vitest testa cada caminho com dependências falsas. A regra do prazo mora no banco
// (aplicar_pagamento_hotmart); aqui só o portão, a conta nova e o "Defina sua senha".
import { lerAviso, TAMANHO_MAXIMO_DO_CORPO, tokenConfere } from './aviso.ts';

export type ResultadoDoBanco = { resultado: string; user_id: string | null; antes: string | null; depois: string | null };

export interface DependenciasDoWebhook {
  /** Deno.env HOTMART_HOTTOK; null se não configurado. */
  hottok: string | null;
  /** Deno.env HOTMART_PRODUTO_ID; null se não configurado. */
  produtoId: string | null;
  aplicar(transacao: string, email: string, tipo: 'aprova' | 'estorna', evento: string): Promise<ResultadoDoBanco>;
  /** Cria a conta já confirmada; jaExiste se o Auth disser que o e-mail já está registrado. */
  criarConta(email: string): Promise<{ id: string } | { jaExiste: true }>;
  /** auth.admin.getUserById → last_sign_in_at == null. */
  nuncaEntrou(userId: string): Promise<boolean>;
  /** Manda o "Defina sua senha"; false se não saiu. */
  enviarEmailDeSenha(email: string): Promise<boolean>;
  /** registro_admin, acao 'e-mail de senha não saiu'. */
  registrarFalhaDeEmail(userId: string, email: string, transacao: string): Promise<void>;
}

export type PedidoDoWebhook = {
  metodo: string;
  hottok: string | null;
  /** Content-Length declarado; null se ausente. */
  tamanho: number | null;
  /** Lê o corpo (com teto) só quando chamado: o fluxo chama depois de conferir método, segredo, hottok e tamanho. */
  lerCorpo: () => Promise<string>;
};
export type RespostaDoWebhook = { status: number; corpo: unknown };

function log(evento: string, transacao: string | null, resultado: string) {
  // Sem hottok, e-mail nem payload: só o que basta para achar o aviso na Hotmart.
  console.log(`hotmart-webhook: ${evento || '?'} ${transacao ?? '-'} ${resultado}`);
}

const CODIGO_SEGURO = /^[A-Za-z0-9_]{1,40}$/;

/** code ou name do erro, se for um identificador curto; nunca a mensagem. */
function codigoDe(erro: unknown): string {
  const e = (erro ?? {}) as { code?: unknown; name?: unknown };
  if (typeof e.code === 'string' && CODIGO_SEGURO.test(e.code)) return e.code;
  if (typeof e.name === 'string' && CODIGO_SEGURO.test(e.name)) return e.name;
  return 'erro';
}

function logFalha(etapa: string, evento: string, transacao: string, erro: unknown) {
  // why: mensagem do Postgres ou do Auth pode trazer o e-mail do comprador; o log leva só etapa, aviso e código.
  console.error(`hotmart-webhook: falha ${etapa} ${evento} ${transacao} ${codigoDe(erro)}`);
}

export async function atenderWebhook(p: PedidoDoWebhook, d: DependenciasDoWebhook): Promise<RespostaDoWebhook> {
  if (p.metodo !== 'POST') return { status: 405, corpo: { erro: 'Método não permitido' } };
  // why: falha fechada; sem o segredo configurado, nada passa (outro projeto já aceitou tudo quando ele faltou).
  if (!d.hottok) {
    console.error('hotmart-webhook: HOTMART_HOTTOK não configurado');
    return { status: 500, corpo: { erro: 'Não configurado' } };
  }
  if (!p.hottok || !tokenConfere(p.hottok, d.hottok)) return { status: 401, corpo: { erro: 'Não autorizado' } };
  // why: o corpo só é lido depois do hottok; sem o segredo, ninguém faz a função ler 100 kB por requisição.
  if ((p.tamanho ?? 0) > TAMANHO_MAXIMO_DO_CORPO) return { status: 413, corpo: { erro: 'Corpo grande demais' } };
  const corpo = await p.lerCorpo();
  if (corpo.length > TAMANHO_MAXIMO_DO_CORPO) return { status: 413, corpo: { erro: 'Corpo grande demais' } };

  let payload: unknown;
  try {
    payload = JSON.parse(corpo);
  } catch {
    return { status: 400, corpo: { erro: 'JSON inválido' } };
  }

  const aviso = lerAviso(payload);
  // 200 nos ignorados: a Hotmart não fica reenviando o que nunca vai valer.
  if (!d.produtoId || aviso.produtoId !== d.produtoId) {
    log(aviso.evento, aviso.transacao, 'ignorado: produto');
    return { status: 200, corpo: { ignorado: 'produto' } };
  }
  if (aviso.tipo === 'ignora') {
    log(aviso.evento, aviso.transacao, 'ignorado: evento');
    return { status: 200, corpo: { ignorado: 'evento' } };
  }
  if (!aviso.transacao || !aviso.email) {
    log(aviso.evento, aviso.transacao, 'ignorado: sem transação ou e-mail');
    return { status: 200, corpo: { ignorado: 'dados' } };
  }
  const { transacao, email, tipo, evento } = aviso;

  let r: ResultadoDoBanco;
  try {
    r = await d.aplicar(transacao, email, tipo, evento);
    if (r.resultado === 'sem_conta' && tipo === 'aprova') {
      let erroAoCriar: unknown = null;
      try {
        // jaExiste: outro aviso criou a conta ao mesmo tempo; aplicar de novo acha a mesma conta.
        await d.criarConta(email);
      } catch (erro) {
        // why: na corrida de dois avisos, o Auth recusa o segundo createUser com erro genérico de banco
        // (não email_exists); aplicar de novo acha a conta do outro, e só se ela não existir vira 500.
        erroAoCriar = erro;
        logFalha('criar_conta', evento, transacao, erro);
      }
      r = await d.aplicar(transacao, email, tipo, evento);
      if (r.resultado === 'sem_conta' && erroAoCriar) throw erroAoCriar;
    }
    if (r.resultado === 'sem_conta') throw new Error('conta não encontrada depois de criada');
  } catch (erro) {
    // 500: a Hotmart reenvia. Se a conta já foi criada, o reenvio libera e ainda manda o e-mail (nunca entrou).
    logFalha('aplicar', evento, transacao, erro);
    return { status: 500, corpo: { erro: 'Falha interna' } };
  }

  if (r.resultado === 'liberou' && r.user_id) {
    let mandar = true;
    try {
      mandar = await d.nuncaEntrou(r.user_id);
    } catch (erro) {
      // why: o pagamento já foi aplicado e um reenvio volta 'repetido'; na dúvida, manda (o link só serve ao dono do e-mail).
      logFalha('nunca_entrou', evento, transacao, erro);
    }
    if (mandar) {
      let saiu = false;
      try {
        saiu = await d.enviarEmailDeSenha(email);
      } catch {
        saiu = false;
      }
      if (!saiu) {
        try {
          await d.registrarFalhaDeEmail(r.user_id, email, transacao);
        } catch (erro) {
          logFalha('registrar_falha_de_email', evento, transacao, erro);
        }
      }
    }
  }

  log(evento, transacao, r.resultado);
  return { status: 200, corpo: { resultado: r.resultado } };
}
