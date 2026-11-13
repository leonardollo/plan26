// Fluxo inteiro da Edge Function admin-usuarios contra o Supabase LOCAL. Antes, em outro terminal:
//   npx supabase functions serve --no-verify-jwt --env-file supabase/functions/local.env
// O e-mail é conferido no Mailpit local.
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { clienteServico, criarPessoa, emailUnico, variaveis } from './ambiente';

const MAILPIT = 'http://127.0.0.1:54324';
const URL_DO_APP = 'https://planejamento.gestaoimpacto.com';

async function chamar(
  corpo: unknown,
  token?: string,
): Promise<{ status: number; corpo: Record<string, unknown>; cabecalhos: Headers }> {
  const v = variaveis();
  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json', apikey: v.ANON_KEY };
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  const r = await fetch(`${v.API_URL}/functions/v1/admin-usuarios`, {
    method: 'POST',
    headers: cabecalhos,
    body: JSON.stringify(corpo),
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : {}, cabecalhos: r.headers };
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

async function acessoPorEmail(email: string) {
  const { data, error } = await clienteServico().from('acessos').select('*').eq('email', email);
  if (error) throw error;
  return data;
}

async function registro(alvo: string) {
  const { data, error } = await clienteServico().from('registro_admin').select('*').eq('alvo', alvo).order('id');
  if (error) throw error;
  return data;
}

const LIMITES = { limite_admin: 20, limite_destinatario: 3 };

/** Reserva direto no banco, como a função faz, para encher o limite sem mandar 20 e-mails. */
async function reservar(adminEmail: string, para: string, tipo: 'criar' | 'reenviar') {
  const { data, error } = await clienteServico().rpc('reservar_envio_de_senha', {
    quem_envia: adminEmail,
    para,
    tipo_de_envio: tipo,
    ...LIMITES,
  });
  if (error) throw error;
  return data as string | null;
}

async function novoAdmin() {
  const email = emailUnico('admin');
  return { ...(await criarPessoa({ email, admin: true })), email };
}

describe('Edge Function admin-usuarios', () => {
  it('sem login: 401', async () => {
    expect((await chamar({ acao: 'criar', email: emailUnico('x'), nome: 'X' })).status).toBe(401);
    expect((await chamar({ acao: 'criar', email: emailUnico('x'), nome: 'X' }, variaveis().ANON_KEY)).status).toBe(401);
  });

  it('cliente liberado: 403', async () => {
    const cliente = await criarPessoa({ email: emailUnico('cliente'), status: 'liberado' });
    const email = emailUnico('x');
    expect((await chamar({ acao: 'criar', email, nome: 'X' }, cliente.token)).status).toBe(403);
    expect(await acessoPorEmail(email)).toHaveLength(0);
  });

  it('admin com e-mail não confirmado: 403', async () => {
    const admin = await criarPessoa({ email: emailUnico('admin'), admin: true, confirmado: false });
    expect((await chamar({ acao: 'criar', email: emailUnico('x'), nome: 'X' }, admin.token)).status).toBe(403);
  });

  it('acao "apagar": 400', async () => {
    const admin = await novoAdmin();
    expect((await chamar({ acao: 'apagar', alvo: admin.id }, admin.token)).status).toBe(400);
  });

  it('criar " Novo@X.com ": conta confirmada, liberada com o nome, Registro e e-mail com o endereço fixo', async () => {
    const admin = await novoAdmin();
    const email = emailUnico('novo');
    const r = await chamar(
      { acao: 'criar', email: `  ${email.toUpperCase()} `, nome: ' Novo Cliente ', redirectTo: 'https://evil.example.com' },
      admin.token,
    );
    expect(r).toMatchObject({ status: 200, corpo: { resultado: 'criado' } });

    const [acesso] = await acessoPorEmail(email);
    expect(acesso).toMatchObject({ status: 'liberado', nome: 'Novo Cliente', email_verificado: true });
    const { data: usuario } = await clienteServico().auth.admin.getUserById(acesso.user_id);
    expect(usuario.user?.email).toBe(email);
    expect(usuario.user?.email_confirmed_at).toBeTruthy();

    const acoes = (await registro(acesso.user_id)).map((l) => [l.acao, l.admin_email]);
    expect(acoes).toContainEqual(['adicionou cliente', admin.email]);

    const mensagens = await esperarMensagens(email, 1);
    expect(mensagens).toHaveLength(1);
    expect(await redirectDoLink(mensagens[0].ID)).toBe(URL_DO_APP);
  });

  it('criar e-mail existente liberado, removido e de admin: ja_existe com o status certo, nada muda', async () => {
    const admin = await novoAdmin();
    const casos = [
      { status: 'liberado' as const, admin: false, esperado: 'liberado' },
      { status: 'removido' as const, admin: false, esperado: 'removido' },
      { status: 'pendente' as const, admin: true, esperado: 'administrador' },
    ];
    for (const caso of casos) {
      const email = emailUnico(caso.esperado);
      const pessoa = await criarPessoa({ email, status: caso.status, admin: caso.admin, nome: 'Antes' });
      const r = await chamar({ acao: 'criar', email: ` ${email.toUpperCase()}`, nome: 'Depois' }, admin.token);
      expect({ status: r.status, corpo: r.corpo }, caso.esperado).toEqual({ status: 200, corpo: { resultado: 'ja_existe', status: caso.esperado, alvo: pessoa.id } });
      const [acesso] = await acessoPorEmail(email);
      expect(acesso, caso.esperado).toMatchObject({ status: caso.status, nome: 'Antes' });
      expect(await registro(pessoa.id), caso.esperado).toHaveLength(0);
    }
  });

  it('reenviar: novo e-mail no Mailpit e Registro "reenviou e-mail de senha"', async () => {
    const admin = await novoAdmin();
    const email = emailUnico('reenvio');
    const pessoa = await criarPessoa({ email, status: 'liberado' });
    const r = await chamar({ acao: 'reenviar', alvo: pessoa.id }, admin.token);
    expect({ status: r.status, corpo: r.corpo }).toEqual({ status: 200, corpo: { resultado: 'enviado' } });
    const mensagens = await esperarMensagens(email, 1);
    expect(mensagens).toHaveLength(1);
    expect(await redirectDoLink(mensagens[0].ID)).toBe(URL_DO_APP);
    expect((await registro(pessoa.id)).map((l) => l.acao)).toEqual(['reenviou e-mail de senha']);
  });

  it('reenviar removido: 400', async () => {
    const admin = await novoAdmin();
    const email = emailUnico('removido');
    const pessoa = await criarPessoa({ email, status: 'removido' });
    const r = await chamar({ acao: 'reenviar', alvo: pessoa.id }, admin.token);
    expect({ status: r.status, corpo: r.corpo }).toEqual({ status: 400, corpo: { erro: 'Reative o cliente antes' } });
    expect(await mensagensPara(email)).toHaveLength(0);
  });

  it('criar com e-mail inválido ou nome vazio: 400 e nenhuma conta nova', async () => {
    const admin = await novoAdmin();
    const email = emailUnico('sem-nome');
    expect((await chamar({ acao: 'criar', email: 'ana@', nome: 'Ana' }, admin.token)).status).toBe(400);
    expect((await chamar({ acao: 'criar', email, nome: '   ' }, admin.token)).status).toBe(400);
    expect(await acessoPorEmail(email)).toHaveLength(0);
  });

  it('o cliente criado entra com senha depois de defini-la e vê o acesso liberado', async () => {
    const admin = await novoAdmin();
    const email = emailUnico('entra');
    expect((await chamar({ acao: 'criar', email, nome: 'Entra' }, admin.token)).corpo).toEqual({ resultado: 'criado' });
    const [acesso] = await acessoPorEmail(email);
    const senha = 'senha-definida-123';
    const def = await clienteServico().auth.admin.updateUserById(acesso.user_id, { password: senha });
    expect(def.error).toBeNull();

    const v = variaveis();
    const cliente = createClient(v.API_URL, v.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await cliente.auth.signInWithPassword({ email, password: senha });
    expect(login.error).toBeNull();
    const lido = await cliente.from('acessos').select('status').eq('user_id', acesso.user_id).single();
    expect(lido.data?.status).toBe('liberado');
  });

  it('e-mail em admins sem conta: ja_existe (administrador), nenhuma conta criada', async () => {
    const admin = await novoAdmin();
    const email = emailUnico('admin-sem-conta');
    expect((await clienteServico().from('admins').insert({ email })).error).toBeNull();
    const r = await chamar({ acao: 'criar', email, nome: 'Sem Conta' }, admin.token);
    expect({ status: r.status, corpo: r.corpo }).toEqual({ status: 200, corpo: { resultado: 'ja_existe', status: 'administrador' } });
    expect(await acessoPorEmail(email)).toHaveLength(0);
    expect(await mensagensPara(email)).toHaveLength(0);
  });

  it('limite do admin: com 19 envios na hora o 20º passa; com 20, o 21º é 429 com Retry-After e nada é criado', async () => {
    const admin = await novoAdmin();
    for (let i = 0; i < 19; i++) expect(await reservar(admin.email, emailUnico('enchimento'), 'criar')).toBeNull();

    const vigesimo = emailUnico('vigesimo');
    expect((await chamar({ acao: 'criar', email: vigesimo, nome: 'Vigésimo' }, admin.token)).corpo).toEqual({ resultado: 'criado' });

    const email = emailUnico('vigesimo-primeiro');
    const r = await chamar({ acao: 'criar', email, nome: 'Demais' }, admin.token);
    expect(r.status).toBe(429);
    expect(r.corpo).toMatchObject({ erro: 'limite' });
    const espera = Number(r.cabecalhos.get('Retry-After'));
    expect(espera).toBeGreaterThan(3500);
    expect(espera).toBeLessThanOrEqual(3600);
    expect(r.corpo.esperaSegundos).toBe(espera);
    expect(await acessoPorEmail(email)).toHaveLength(0);
    expect(await mensagensPara(email)).toHaveLength(0);
  });

  it('o limite é por admin: outro admin segue enviando', async () => {
    const cheio = await novoAdmin();
    for (let i = 0; i < 20; i++) await reservar(cheio.email, emailUnico('enchimento'), 'criar');
    expect(await reservar(cheio.email, emailUnico('x'), 'criar')).not.toBeNull();
    const outro = await novoAdmin();
    expect((await chamar({ acao: 'criar', email: emailUnico('outro'), nome: 'Outro' }, outro.token)).corpo).toEqual({ resultado: 'criado' });
  });

  it('limite do destinatário: 3 reenvios passam; o 4º, mesmo por outro admin, é 429 e o e-mail não sai', async () => {
    const admin = await novoAdmin();
    const email = emailUnico('reenvio-limite');
    const pessoa = await criarPessoa({ email, status: 'liberado' });
    for (let i = 0; i < 3; i++) {
      // O Auth local recusa outro e-mail de senha ao mesmo usuário em menos de 1 s (max_frequency no config.toml).
      if (i > 0) await new Promise((ok) => setTimeout(ok, 1100));
      expect((await chamar({ acao: 'reenviar', alvo: pessoa.id }, admin.token)).corpo, String(i)).toEqual({ resultado: 'enviado' });
    }
    expect(await esperarMensagens(email, 3)).toHaveLength(3);

    const outro = await novoAdmin();
    const r = await chamar({ acao: 'reenviar', alvo: pessoa.id }, outro.token);
    expect(r.status).toBe(429);
    expect(r.corpo).toMatchObject({ erro: 'limite' });
    expect(Number(r.cabecalhos.get('Retry-After'))).toBeGreaterThan(0);
    await new Promise((ok) => setTimeout(ok, 500));
    expect(await mensagensPara(email)).toHaveLength(3);
    expect((await registro(pessoa.id)).map((l) => l.acao)).toEqual(Array(3).fill('reenviou e-mail de senha'));
  });

  it('dois pedidos simultâneos no último lugar do limite: só um reserva', async () => {
    const admin = await novoAdmin();
    for (let i = 0; i < 19; i++) await reservar(admin.email, emailUnico('enchimento'), 'criar');
    const resultados = await Promise.all(Array.from({ length: 5 }, () => reservar(admin.email, emailUnico('corrida'), 'criar')));
    expect(resultados.filter((r) => r === null)).toHaveLength(1);
    const { count } = await clienteServico().from('envios_de_senha').select('*', { count: 'exact', head: true }).eq('admin_email', admin.email);
    expect(count).toBe(20);
  });

  it('reservar_envio_de_senha e envios_de_senha ficam fora do alcance de quem está logado', async () => {
    const admin = await novoAdmin();
    const rpc = await admin.cliente.rpc('reservar_envio_de_senha', { quem_envia: admin.email, para: 'a@x.com', tipo_de_envio: 'criar', ...LIMITES });
    expect(rpc.error?.code).toBe('42501');
    const leitura = await admin.cliente.from('envios_de_senha').select('*');
    expect(leitura.error?.code).toBe('42501');
  });
});
