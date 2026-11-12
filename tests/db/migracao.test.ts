import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { clienteAnonimo, clienteServico, criarPessoa, emailUnico, variaveis } from './ambiente';
import { definirStatus } from '../../src/services/acesso';
import { gravarSupabase } from '../../scripts/migracao/gravar-supabase.mjs';
import { conferir } from '../../scripts/migracao/conferir.mjs';

const SEM_SESSAO = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

// Uma Migracao como a que transformar() devolve, montada à mão com e-mails únicos.
function migracaoDeExemplo() {
  const cliente = emailUnico('migrado');
  const bloqueado = emailUnico('migrado-bloq');
  const google = emailUnico('migrado-google');
  const admin = emailUnico('migrado-admin');
  return {
    emails: { cliente, bloqueado, google, admin },
    m: {
      usuarios: [
        { email: cliente, nome: 'Cliente Migrado', temSenha: true },
        { email: bloqueado, nome: null, temSenha: true },
        { email: google, nome: 'Do Google', temSenha: false },
      ],
      acessos: [
        { email: cliente, status: 'liberado', liberadoEm: '2026-04-01T10:00:00.000Z', liberadoPor: 'chefe@exemplo.com' },
        { email: bloqueado, status: 'bloqueado', liberadoEm: null, liberadoPor: null },
      ],
      planos: [
        { email: cliente, ano: 2026, dados: { planData: { companyProfile: { name: 'Empresa A' } }, taxes: { regime: 'simples' } } },
        { email: cliente, ano: 2027, dados: { goals2026: { meta: 25 } } },
        { email: google, ano: 2026, dados: { pricingItems: [{ nome: 'x', preco: 10.5 }] } },
      ],
      admins: [{ email: admin, temConta: false }],
      avisos: [],
      impedimentos: [],
    },
  };
}

async function idDoEmail(email: string): Promise<string> {
  const { data, error } = await clienteServico().from('acessos').select('user_id').eq('email', email).single();
  if (error) throw error;
  return data.user_id;
}

async function ultimoLinkDeSenha(email: string): Promise<string> {
  const base = variaveis().API_URL.replace(':54321', ':54324');
  for (let i = 0; i < 20; i++) {
    const busca = await (await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    const msg = busca.messages?.[0];
    if (msg) {
      const corpo = await (await fetch(`${base}/api/v1/message/${msg.ID}`)).json();
      const link = /href="([^"]+type=recovery[^"]*)"/.exec(corpo.HTML)?.[1];
      if (link) return link.replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('o e-mail de senha não chegou ao Mailpit');
}

describe('importação do Firebase para o Supabase', () => {
  it('cria usuários confirmados, acessos, planos e admins; conferir não acha diferença', async () => {
    const { m, emails } = migracaoDeExemplo();
    const r = await gravarSupabase(clienteServico(), m);
    expect(r).toEqual({ criados: 3, reaproveitados: 0, planosGravados: 3, planosRecusados: [], acessosRecusados: [] });

    const servico = clienteServico();
    const { data: usuario } = await servico.auth.admin.getUserById(await idDoEmail(emails.cliente));
    expect(usuario.user?.email_confirmed_at).toBeTruthy();
    expect(usuario.user?.user_metadata?.name).toBe('Cliente Migrado');

    const { data: acessos } = await servico
      .from('acessos')
      .select('email, status, liberado_em, liberado_por')
      .in('email', [emails.cliente, emails.bloqueado, emails.google]);
    const porEmail = Object.fromEntries((acessos ?? []).map((a) => [a.email, a]));
    expect(porEmail[emails.cliente].status).toBe('liberado');
    expect(new Date(porEmail[emails.cliente].liberado_em).toISOString()).toBe('2026-04-01T10:00:00.000Z');
    expect(porEmail[emails.cliente].liberado_por).toBe('chefe@exemplo.com');
    expect(porEmail[emails.bloqueado].status).toBe('bloqueado');
    // Sem acesso no Firebase, fica o pendente do gatilho.
    expect(porEmail[emails.google].status).toBe('pendente');

    const { data: admin } = await servico.from('admins').select('email').eq('email', emails.admin);
    expect(admin).toHaveLength(1);

    const c = await conferir(servico, m);
    expect(c.diferencas).toEqual([]);
    expect(c.contagens.planos).toEqual({ esperado: 3, achado: 3 });
    // Um acesso por usuário migrado (o gatilho cria), inclusive o do Google, que não tinha acesso no Firebase.
    expect(c.contagens.acessos).toEqual({ esperado: 3, achado: 3 });
  });

  it('conferir aponta usuário migrado sem linha de acesso, mesmo sem acesso no Firebase', async () => {
    const { m, emails } = migracaoDeExemplo();
    await gravarSupabase(clienteServico(), m);
    const { error } = await clienteServico().from('acessos').delete().eq('user_id', await idDoEmail(emails.google));
    expect(error).toBeNull();

    const c = await conferir(clienteServico(), m);
    expect(c.contagens.acessos).toEqual({ esperado: 3, achado: 2 });
    expect(c.diferencas).toEqual([`acesso de ${emails.google} não existe`]);
  });

  it('aplicar duas vezes reaproveita todos e não duplica nada', async () => {
    const { m, emails } = migracaoDeExemplo();
    await gravarSupabase(clienteServico(), m);
    const r = await gravarSupabase(clienteServico(), m);
    expect(r).toEqual({ criados: 0, reaproveitados: 3, planosGravados: 3, planosRecusados: [], acessosRecusados: [] });

    const id = await idDoEmail(emails.cliente);
    const { data: planos } = await clienteServico().from('planos').select('ano').eq('user_id', id);
    expect(planos).toHaveLength(2);
    expect((await conferir(clienteServico(), m)).diferencas).toEqual([]);
  });

  it('plano editado no app novo não é sobrescrito na reimportação', async () => {
    const { m, emails } = migracaoDeExemplo();
    await gravarSupabase(clienteServico(), m);

    // O cliente define a senha e edita o próprio plano de 2026 pelo caminho normal do app.
    const servico = clienteServico();
    const id = await idDoEmail(emails.cliente);
    await servico.auth.admin.updateUserById(id, { password: 'senha-de-teste-123' });
    const v = variaveis();
    const cliente = createClient(v.API_URL, v.ANON_KEY, SEM_SESSAO);
    const { error: e1 } = await cliente.auth.signInWithPassword({ email: emails.cliente, password: 'senha-de-teste-123' });
    expect(e1).toBeNull();
    const editado = { planData: { companyProfile: { name: 'Editado no app' } } };
    const { error: e2 } = await cliente.from('planos').update({ dados: editado }).eq('user_id', id).eq('ano', 2026);
    expect(e2).toBeNull();

    const r = await gravarSupabase(clienteServico(), m);
    expect(r.planosRecusados).toEqual([`${emails.cliente} ${2026}`]);
    expect(r.planosGravados).toBe(2);
    const { data } = await servico.from('planos').select('dados').eq('user_id', id).eq('ano', 2026).single();
    expect(data?.dados).toEqual(editado);
  });

  it('acesso mudado pelo admin no app novo não é sobrescrito na reimportação', async () => {
    const { m, emails } = migracaoDeExemplo();
    await gravarSupabase(clienteServico(), m);

    // Depois do deploy, um admin libera no app novo quem estava bloqueado no Firebase.
    const admin = await criarPessoa({ email: emailUnico('admin-app'), admin: true });
    const id = await idDoEmail(emails.bloqueado);
    await definirStatus(admin.cliente, id, 'liberado');

    const r = await gravarSupabase(clienteServico(), m);
    expect(r.acessosRecusados).toEqual([emails.bloqueado]);
    const { data } = await clienteServico().from('acessos').select('status').eq('user_id', id).single();
    expect(data?.status).toBe('liberado');
    // O cliente liberado no Firebase, que ninguém mexeu, continua recebendo o status de lá.
    const idCliente = await idDoEmail(emails.cliente);
    const { data: c } = await clienteServico().from('acessos').select('status').eq('user_id', idCliente).single();
    expect(c?.status).toBe('liberado');
  });

  it('conta criada no app novo antes da importação: sem decisão do admin recebe o status do Firebase', async () => {
    const { m, emails } = migracaoDeExemplo();
    // O cliente entrou com Google pela URL nova antes da importação: o gatilho o deixou pendente.
    const pessoa = await criarPessoa({ email: emails.cliente });

    const r = await gravarSupabase(clienteServico(), m);
    expect(r.reaproveitados).toBe(1);
    expect(r.acessosRecusados).toEqual([]);
    const { data } = await clienteServico().from('acessos').select('status, liberado_por').eq('user_id', pessoa.id).single();
    expect(data).toEqual({ status: 'liberado', liberado_por: 'chefe@exemplo.com' });
  });

  it('conta criada no app novo e já decidida pelo admin antes da importação mantém a decisão', async () => {
    const { m, emails } = migracaoDeExemplo();
    const pessoa = await criarPessoa({ email: emails.cliente });
    const admin = await criarPessoa({ email: emailUnico('admin-app'), admin: true });
    await definirStatus(admin.cliente, pessoa.id, 'bloqueado');

    const r = await gravarSupabase(clienteServico(), m);
    expect(r.acessosRecusados).toEqual([emails.cliente]);
    const { data } = await clienteServico().from('acessos').select('status').eq('user_id', pessoa.id).single();
    expect(data?.status).toBe('bloqueado');
  });

  it('usuário migrado pede "esqueci minha senha", define a senha e lê o próprio plano', async () => {
    const { m, emails } = migracaoDeExemplo();
    await gravarSupabase(clienteServico(), m);

    const { error: e1 } = await clienteAnonimo().auth.resetPasswordForEmail(emails.cliente, {
      redirectTo: 'http://localhost:5173',
    });
    expect(e1).toBeNull();

    // O link do e-mail abre uma sessão de recuperação; o token vem no fragmento do redirecionamento.
    const resposta = await fetch(await ultimoLinkDeSenha(emails.cliente), { redirect: 'manual' });
    const destino = new URL(resposta.headers.get('location') ?? '');
    const fragmento = new URLSearchParams(destino.hash.slice(1));
    const v = variaveis();
    const recuperando = createClient(v.API_URL, v.ANON_KEY, SEM_SESSAO);
    const { error: e2 } = await recuperando.auth.setSession({
      access_token: fragmento.get('access_token') ?? '',
      refresh_token: fragmento.get('refresh_token') ?? '',
    });
    expect(e2).toBeNull();
    const { error: e3 } = await recuperando.auth.updateUser({ password: 'senha-nova-456' });
    expect(e3).toBeNull();

    const cliente = createClient(v.API_URL, v.ANON_KEY, SEM_SESSAO);
    const { error: e4 } = await cliente.auth.signInWithPassword({ email: emails.cliente, password: 'senha-nova-456' });
    expect(e4).toBeNull();
    const { data, error: e5 } = await cliente.from('planos').select('ano, dados').order('ano');
    expect(e5).toBeNull();
    expect(data?.map((p) => p.ano)).toEqual([2026, 2027]);
    expect(data?.[0].dados).toEqual(m.planos[0].dados);
  });
});
