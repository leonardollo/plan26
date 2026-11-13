import { describe, expect, it, vi } from 'vitest';
import { criarCliente, reenviarEmailDeSenha } from './adminUsuarios';

// O fluxo de verdade está em tests/db/admin-usuarios.test.ts; aqui só a chamada e a conversão de erro.
function cliente(resposta: { data: unknown; error: unknown }) {
  return { functions: { invoke: vi.fn(async () => resposta) } } as any;
}

function erroHttp(status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  return {
    name: 'FunctionsHttpError',
    message: 'Edge Function returned a non-2xx status code',
    context: new Response(JSON.stringify(corpo), { status, headers: cabecalhos }),
  };
}

describe('criarCliente', () => {
  it('chama admin-usuarios com acao criar e devolve o resultado', async () => {
    const c = cliente({ data: { resultado: 'criado' }, error: null });
    expect(await criarCliente(c, 'ana@x.com', 'Ana')).toEqual({ resultado: 'criado' });
    expect(c.functions.invoke).toHaveBeenCalledWith('admin-usuarios', { body: { acao: 'criar', email: 'ana@x.com', nome: 'Ana' } });
  });

  it('ja_existe passa com status e alvo', async () => {
    const c = cliente({ data: { resultado: 'ja_existe', status: 'removido', alvo: 'u' }, error: null });
    expect(await criarCliente(c, 'ana@x.com', 'Ana')).toEqual({ resultado: 'ja_existe', status: 'removido', alvo: 'u' });
  });

  it('400 { erro } vira Error com a mensagem', async () => {
    const c = cliente({ data: null, error: erroHttp(400, { erro: 'Nome obrigatório' }) });
    await expect(criarCliente(c, 'ana@x.com', '')).rejects.toThrow(new Error('Nome obrigatório'));
  });

  it('erro sem corpo legível vira Error genérico', async () => {
    const c = cliente({ data: null, error: { name: 'FunctionsFetchError', message: 'Failed to send a request' } });
    await expect(criarCliente(c, 'ana@x.com', 'Ana')).rejects.toThrow('Não foi possível falar com o servidor');
  });
});

describe('reenviarEmailDeSenha', () => {
  it('chama admin-usuarios com acao reenviar', async () => {
    const c = cliente({ data: { resultado: 'enviado' }, error: null });
    await reenviarEmailDeSenha(c, 'u');
    expect(c.functions.invoke).toHaveBeenCalledWith('admin-usuarios', { body: { acao: 'reenviar', alvo: 'u' } });
  });

  it('400 { erro } vira Error com a mensagem', async () => {
    const c = cliente({ data: null, error: erroHttp(400, { erro: 'Reative o cliente antes' }) });
    await expect(reenviarEmailDeSenha(c, 'u')).rejects.toThrow(new Error('Reative o cliente antes'));
  });
});

describe('limite de envios (429)', () => {
  it('vira "Muitos envios; tente de novo em X min", arredondando para cima', async () => {
    const casos: Array<[number, string]> = [[600, '10 min'], [61, '2 min'], [1, '1 min'], [3600, '60 min']];
    for (const [segundos, texto] of casos) {
      const c = cliente({ data: null, error: erroHttp(429, { erro: 'limite', esperaSegundos: segundos }) });
      await expect(reenviarEmailDeSenha(c, 'u'), texto).rejects.toThrow(new Error(`Muitos envios; tente de novo em ${texto}`));
    }
  });

  it('sem esperaSegundos no corpo, usa o Retry-After', async () => {
    const c = cliente({ data: null, error: erroHttp(429, { erro: 'limite' }, { 'Retry-After': '120' }) });
    await expect(criarCliente(c, 'ana@x.com', 'Ana')).rejects.toThrow(new Error('Muitos envios; tente de novo em 2 min'));
  });

  it('sem tempo nenhum, pede para tentar mais tarde', async () => {
    const c = cliente({ data: null, error: erroHttp(429, { erro: 'limite' }) });
    await expect(criarCliente(c, 'ana@x.com', 'Ana')).rejects.toThrow(new Error('Muitos envios; tente de novo mais tarde'));
  });
});
