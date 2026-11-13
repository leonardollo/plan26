// Fluxo inteiro da Edge Function hotmart-webhook contra o Supabase LOCAL. Antes, em outro terminal:
//   npx supabase functions serve --no-verify-jwt --env-file supabase/functions/local.env
// O hottok e o produto são os valores falsos de supabase/functions/local.env; o e-mail é conferido no Mailpit local.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { clienteServico, emailUnico, variaveis } from './ambiente';

const MAILPIT = 'http://127.0.0.1:54324';
const URL_DO_APP = 'https://planejamento.gestaoimpacto.com';
const HOTTOK = 'hottok-local-de-teste';
const PRODUTO = 900001;
const UM_MINUTO = 60_000;

function aviso(transacao: string, email: string, produto: number = PRODUTO) {
  return {
    event: 'PURCHASE_APPROVED',
    data: { purchase: { transaction: transacao, status: 'APPROVED' }, buyer: { email }, product: { id: produto } },
  };
}

function transacaoNova(): string {
  return `HP-${randomUUID().slice(0, 12)}`;
}

/** POST como a Hotmart faz: sem apikey nem JWT, só o hottok. */
async function chamar(corpo: unknown, hottok?: string): Promise<{ status: number; corpo: Record<string, unknown> }> {
  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json' };
  if (hottok !== undefined) cabecalhos['x-hotmart-hottok'] = hottok;
  const r = await fetch(`${variaveis().API_URL}/functions/v1/hotmart-webhook`, {
    method: 'POST',
    headers: cabecalhos,
    body: JSON.stringify(corpo),
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : {} };
}

type Mensagem = { ID: string };

async function mensagensPara(email: string): Promise<Mensagem[]> {
  const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  const json = (await r.json()) as { messages: Mensagem[] };
  return json.messages ?? [];
}

async function esperarMensagens(email: string, quantas: number): Promise<Mensagem[]> {
  for (let i = 0; i < 50; i++) {
    const lista = await mensagensPara(email);
    if (lista.length >= quantas) return lista;
    await new Promise((r) => setTimeout(r, 200));
  }
  return mensagensPara(email);
}

async function redirectDoLink(id: string): Promise<string | null> {
  const r = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  const msg = (await r.json()) as { HTML: string; Text: string };
  const texto = `${msg.Text}\n${msg.HTML}`.replace(/&amp;/g, '&');
  const m = texto.match(/redirect_to=([^"&\s)]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function acessosDo(email: string) {
  const { data, error } = await clienteServico().from('acessos').select('*').eq('email', email);
  if (error) throw error;
  return data;
}

async function pagamento(transacao: string) {
  const { data, error } = await clienteServico().from('pagamentos_hotmart').select('*').eq('transacao', transacao);
  if (error) throw error;
  return data;
}

function maisAnos(anos: number): number {
  const d = new Date();
  d.setFullYear(d.getFullYear() + anos);
  return d.getTime();
}

describe('hotmart-webhook (Supabase local)', () => {
  it('sem hottok → 401; hottok errado → 401; nada gravado', async () => {
    const transacao = transacaoNova();
    const email = emailUnico('hotmart-401');
    expect((await chamar(aviso(transacao, email))).status).toBe(401);
    expect((await chamar(aviso(transacao, email), 'hottok-errado')).status).toBe(401);
    expect(await pagamento(transacao)).toHaveLength(0);
    expect(await acessosDo(email)).toHaveLength(0);
  });

  it('ex1: e-mail novo com caixa e espaço cria a conta liberada por um ano e manda um e-mail de senha', async () => {
    const transacao = transacaoNova();
    const email = emailUnico('hotmart-novo');
    const r = await chamar(aviso(transacao, `  ${email.toUpperCase()} `), HOTTOK);
    expect(r).toEqual({ status: 200, corpo: { resultado: 'liberou' } });

    const acessos = await acessosDo(email);
    expect(acessos).toHaveLength(1);
    expect(acessos[0].status).toBe('liberado');
    expect(Math.abs(new Date(acessos[0].acesso_ate).getTime() - maisAnos(1))).toBeLessThan(UM_MINUTO);

    const [p] = await pagamento(transacao);
    expect(p).toMatchObject({ email, situacao: 'aprovada', user_id: acessos[0].user_id, mexeu_no_prazo: true });

    const mensagens = await esperarMensagens(email, 1);
    expect(mensagens).toHaveLength(1);
    expect(await redirectDoLink(mensagens[0].ID)).toBe(URL_DO_APP);

    // ex2: o mesmo aviso de novo não mexe no prazo nem manda outro e-mail.
    const repetido = await chamar(aviso(transacao, email), HOTTOK);
    expect(repetido).toEqual({ status: 200, corpo: { resultado: 'repetido' } });
    expect((await acessosDo(email))[0].acesso_ate).toBe(acessos[0].acesso_ate);
    await new Promise((r) => setTimeout(r, 1000));
    expect(await mensagensPara(email)).toHaveLength(1);
  });

  it('ex13: dois avisos simultâneos de transações diferentes para o mesmo e-mail novo → uma conta, dois anos', async () => {
    const email = emailUnico('hotmart-duplo');
    const [a, b] = await Promise.all([
      chamar(aviso(transacaoNova(), email), HOTTOK),
      chamar(aviso(transacaoNova(), email), HOTTOK),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.corpo.resultado, b.corpo.resultado].sort()).toEqual(['estendeu', 'liberou']);

    const acessos = await acessosDo(email);
    expect(acessos).toHaveLength(1);
    expect(acessos[0].status).toBe('liberado');
    expect(Math.abs(new Date(acessos[0].acesso_ate).getTime() - maisAnos(2))).toBeLessThan(UM_MINUTO);
    expect(await esperarMensagens(email, 1)).toHaveLength(1);
  });

  it('ex10: outro produto → 200 e nada gravado', async () => {
    const transacao = transacaoNova();
    const email = emailUnico('hotmart-outro');
    const r = await chamar(aviso(transacao, email, 123), HOTTOK);
    expect(r).toEqual({ status: 200, corpo: { ignorado: 'produto' } });
    expect(await pagamento(transacao)).toHaveLength(0);
    expect(await acessosDo(email)).toHaveLength(0);
  });
});
