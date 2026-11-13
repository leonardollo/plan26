// O fluxo da Edge Function admin-usuarios, sem Deno e sem rede: o index.ts injeta o acesso ao Supabase,
// e o vitest testa cada caminho (inclusive "conta criada e e-mail não saiu") com dependências falsas.
import { cabecalhosCors, segundosAteLiberar, validarCriar, validarReenviar } from './regras.ts';

export type Status = 'pendente' | 'liberado' | 'bloqueado' | 'removido';
export type Conta = { id: string; email: string; status: Status };

export interface Dependencias {
  /** Quem está chamando, pelo token; null se o token não vale. */
  quemChama(autorizacao: string): Promise<{ email: string } | null>;
  /** sou_admin() com o token de quem chamou (exige e-mail confirmado). */
  souAdmin(autorizacao: string): Promise<boolean>;
  contaPorEmail(email: string): Promise<Conta | null>;
  contaPorId(id: string): Promise<Conta | null>;
  ehAdmin(email: string): Promise<boolean>;
  /** Cria a conta já confirmada; jaExiste se o Auth disser que o e-mail já está registrado. */
  criarConta(email: string, nome: string): Promise<{ id: string } | { jaExiste: true }>;
  /** definir_status_de_acesso(id, 'liberado') com o token de quem chamou. */
  liberar(id: string): Promise<void>;
  /** Manda o "Defina sua senha"; false se não saiu. */
  enviarEmailDeSenha(email: string): Promise<boolean>;
  registrar(adminEmail: string, acao: string, alvo: string | null, alvoEmail: string | null, detalhe: Record<string, unknown>): Promise<void>;
  /**
   * Reserva um envio no limite do banco (trava, conta e grava numa só transação).
   * null: reservado, pode chamar o Auth; uma data: limite estourado, libera nessa hora.
   */
  reservarEnvio(adminEmail: string, destinatario: string, tipo: 'criar' | 'reenviar'): Promise<Date | null>;
  agora?(): Date;
}

export type Pedido = { metodo: string; origem: string | null; autorizacao: string | null; corpo: unknown };
export type Resposta = { status: number; corpo: unknown; cabecalhos: Record<string, string> };

export async function atender(pedido: Pedido, deps: Dependencias): Promise<Resposta> {
  const cors = cabecalhosCors(pedido.origem);
  const responder = (status: number, corpo: unknown): Resposta => ({ status, corpo, cabecalhos: cors });
  const limiteEstourado = (liberaEm: Date): Resposta => {
    const esperaSegundos = segundosAteLiberar(liberaEm, deps.agora?.() ?? new Date());
    return { status: 429, corpo: { erro: 'limite', esperaSegundos }, cabecalhos: { ...cors, 'Retry-After': String(esperaSegundos) } };
  };

  if (pedido.metodo === 'OPTIONS') return responder(204, null);
  if (pedido.metodo !== 'POST') return responder(405, { erro: 'Método não permitido' });

  const autorizacao = pedido.autorizacao;
  if (!autorizacao || !/^Bearer\s+\S+$/i.test(autorizacao)) return responder(401, { erro: 'Faça login' });
  const quem = await deps.quemChama(autorizacao);
  if (!quem) return responder(401, { erro: 'Faça login' });
  if (!(await deps.souAdmin(autorizacao))) return responder(403, { erro: 'Só um administrador faz isso' });

  const corpo = pedido.corpo as { acao?: unknown } | null;
  const acao = corpo && typeof corpo === 'object' ? corpo.acao : undefined;

  if (acao === 'criar') {
    const v = validarCriar(corpo);
    if ('erro' in v) return responder(400, { erro: v.erro });
    const existente = await deps.contaPorEmail(v.email);
    // why: admins casa por e-mail; criar conta para um e-mail já em admins (mesmo sem conta) faria dele admin sem querer.
    const ehAdmin = await deps.ehAdmin(v.email);
    if (existente || ehAdmin) {
      const status = ehAdmin ? 'administrador' : existente!.status;
      return responder(200, { resultado: 'ja_existe', status, ...(existente ? { alvo: existente.id } : {}) });
    }
    const liberaEm = await deps.reservarEnvio(quem.email, v.email, 'criar');
    if (liberaEm) return limiteEstourado(liberaEm);
    const criada = await deps.criarConta(v.email, v.nome);
    if ('jaExiste' in criada) {
      // Corrida: alguém criou a conta entre a busca e o createUser; responde com o que houver agora.
      const agora = await deps.contaPorEmail(v.email);
      const status = (await deps.ehAdmin(v.email)) ? 'administrador' : (agora?.status ?? 'pendente');
      return responder(200, { resultado: 'ja_existe', status, ...(agora ? { alvo: agora.id } : {}) });
    }
    await deps.liberar(criada.id);
    await deps.registrar(quem.email, 'adicionou cliente', criada.id, v.email, { nome: v.nome });
    if (await deps.enviarEmailDeSenha(v.email)) return responder(200, { resultado: 'criado' });
    await deps.registrar(quem.email, 'e-mail de senha não saiu', criada.id, v.email, {});
    return responder(200, { resultado: 'criado_sem_email' });
  }

  if (acao === 'reenviar') {
    const v = validarReenviar(corpo);
    if ('erro' in v) return responder(400, { erro: v.erro });
    const conta = await deps.contaPorId(v.alvo);
    if (!conta) return responder(400, { erro: 'Cliente não encontrado' });
    if (conta.status === 'removido') return responder(400, { erro: 'Reative o cliente antes' });
    const liberaEm = await deps.reservarEnvio(quem.email, conta.email, 'reenviar');
    if (liberaEm) return limiteEstourado(liberaEm);
    if (!(await deps.enviarEmailDeSenha(conta.email))) return responder(502, { erro: 'O e-mail não saiu; tente de novo' });
    await deps.registrar(quem.email, 'reenviou e-mail de senha', conta.id, conta.email, {});
    return responder(200, { resultado: 'enviado' });
  }

  return responder(400, { erro: 'Ação desconhecida' });
}

/** O mesmo atender, mas uma exceção vira 500 com os cabeçalhos CORS, para a tela ler a mensagem e não um erro de rede. */
export async function atenderSemFalhar(pedido: Pedido, deps: Dependencias): Promise<Resposta> {
  try {
    return await atender(pedido, deps);
  } catch (erro) {
    console.error('admin-usuarios: erro interno', erro);
    return { status: 500, corpo: { erro: 'Erro interno; tente de novo' }, cabecalhos: cabecalhosCors(pedido.origem) };
  }
}
