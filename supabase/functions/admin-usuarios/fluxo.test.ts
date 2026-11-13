import { describe, expect, it, vi } from 'vitest';
import { atender, type Dependencias, type Pedido } from './fluxo';

const ADMIN = 'admin@gi.com';
const ORIGEM = 'http://localhost:5173';
const ALVO = '3f1c2a9e-1b2c-4d5e-8f90-1234567890ab';

function deps(sobre: Partial<Dependencias> = {}): Dependencias {
  return {
    quemChama: vi.fn(async () => ({ email: ADMIN })),
    souAdmin: vi.fn(async () => true),
    contaPorEmail: vi.fn(async () => null),
    contaPorId: vi.fn(async () => ({ id: ALVO, email: 'ana@x.com', status: 'liberado' as const })),
    ehAdmin: vi.fn(async () => false),
    criarConta: vi.fn(async () => ({ id: ALVO })),
    liberar: vi.fn(async () => {}),
    enviarEmailDeSenha: vi.fn(async () => true),
    registrar: vi.fn(async () => {}),
    ...sobre,
  };
}

function pedido(corpo: unknown, sobre: Partial<Pedido> = {}): Pedido {
  return { metodo: 'POST', origem: ORIGEM, autorizacao: 'Bearer token', corpo, ...sobre };
}

describe('atender: portão', () => {
  it('OPTIONS responde 204 com CORS, sem olhar login', async () => {
    const d = deps();
    const r = await atender(pedido(null, { metodo: 'OPTIONS', autorizacao: null }), d);
    expect(r.status).toBe(204);
    expect(r.cabecalhos['Access-Control-Allow-Origin']).toBe(ORIGEM);
    expect(d.quemChama).not.toHaveBeenCalled();
  });

  it('sem login: 401', async () => {
    const d = deps({ quemChama: vi.fn(async () => null) });
    expect((await atender(pedido({ acao: 'criar' }, { autorizacao: null }), d)).status).toBe(401);
    expect((await atender(pedido({ acao: 'criar' }), d)).status).toBe(401);
  });

  it('não admin: 403, e nada é criado', async () => {
    const d = deps({ souAdmin: vi.fn(async () => false) });
    const r = await atender(pedido({ acao: 'criar', email: 'a@x.com', nome: 'Ana' }), d);
    expect(r.status).toBe(403);
    expect(d.criarConta).not.toHaveBeenCalled();
  });

  it('ação desconhecida: 400', async () => {
    const r = await atender(pedido({ acao: 'apagar' }), deps());
    expect(r.status).toBe(400);
    expect(r.corpo).toHaveProperty('erro');
  });
});

describe('atender: criar', () => {
  it('cria, libera, registra "adicionou cliente" e manda o e-mail', async () => {
    const d = deps();
    const r = await atender(pedido({ acao: 'criar', email: ' Ana@X.com ', nome: ' Ana ', redirectTo: 'https://evil.com' }), d);
    expect(r).toMatchObject({ status: 200, corpo: { resultado: 'criado' } });
    expect(d.criarConta).toHaveBeenCalledWith('ana@x.com', 'Ana');
    expect(d.liberar).toHaveBeenCalledWith(ALVO);
    expect(d.registrar).toHaveBeenCalledWith(ADMIN, 'adicionou cliente', ALVO, 'ana@x.com', { nome: 'Ana' });
    expect(d.enviarEmailDeSenha).toHaveBeenCalledWith('ana@x.com');
  });

  it('e-mail falhou depois de criar: criado_sem_email e Registro "e-mail de senha não saiu"', async () => {
    const d = deps({ enviarEmailDeSenha: vi.fn(async () => false) });
    const r = await atender(pedido({ acao: 'criar', email: 'ana@x.com', nome: 'Ana' }), d);
    expect(r).toMatchObject({ status: 200, corpo: { resultado: 'criado_sem_email' } });
    expect(d.liberar).toHaveBeenCalledWith(ALVO);
    expect(d.registrar).toHaveBeenCalledWith(ADMIN, 'adicionou cliente', ALVO, 'ana@x.com', { nome: 'Ana' });
    expect(d.registrar).toHaveBeenCalledWith(ADMIN, 'e-mail de senha não saiu', ALVO, 'ana@x.com', {});
  });

  it('e-mail existente: ja_existe com o status e nada muda', async () => {
    for (const status of ['pendente', 'liberado', 'bloqueado', 'removido'] as const) {
      const d = deps({ contaPorEmail: vi.fn(async () => ({ id: ALVO, email: 'ana@x.com', status })) });
      const r = await atender(pedido({ acao: 'criar', email: 'ana@x.com', nome: 'Ana' }), d);
      expect(r, status).toMatchObject({ status: 200, corpo: { resultado: 'ja_existe', status, alvo: ALVO } });
      expect(d.criarConta).not.toHaveBeenCalled();
      expect(d.liberar).not.toHaveBeenCalled();
      expect(d.registrar).not.toHaveBeenCalled();
      expect(d.enviarEmailDeSenha).not.toHaveBeenCalled();
    }
  });

  it('e-mail de admin: ja_existe (administrador)', async () => {
    const d = deps({
      contaPorEmail: vi.fn(async () => ({ id: ALVO, email: 'ana@x.com', status: 'pendente' as const })),
      ehAdmin: vi.fn(async () => true),
    });
    const r = await atender(pedido({ acao: 'criar', email: 'ana@x.com', nome: 'Ana' }), d);
    expect(r.corpo).toEqual({ resultado: 'ja_existe', status: 'administrador', alvo: ALVO });
  });

  it('criarConta diz que o e-mail já está registrado: ja_existe, nada mais', async () => {
    const d = deps({ criarConta: vi.fn(async () => ({ jaExiste: true as const })) });
    const r = await atender(pedido({ acao: 'criar', email: 'ana@x.com', nome: 'Ana' }), d);
    expect(r.corpo).toMatchObject({ resultado: 'ja_existe' });
    expect(d.liberar).not.toHaveBeenCalled();
    expect(d.enviarEmailDeSenha).not.toHaveBeenCalled();
  });

  it('e-mail inválido ou nome vazio: 400 e nada criado', async () => {
    for (const corpo of [{ acao: 'criar', email: 'ana@', nome: 'Ana' }, { acao: 'criar', email: 'a@x.com', nome: '  ' }]) {
      const d = deps();
      const r = await atender(pedido(corpo), d);
      expect(r.status).toBe(400);
      expect(d.criarConta).not.toHaveBeenCalled();
    }
  });
});

describe('atender: reenviar', () => {
  it('manda de novo e registra "reenviou e-mail de senha"', async () => {
    const d = deps();
    const r = await atender(pedido({ acao: 'reenviar', alvo: ALVO }), d);
    expect(r).toMatchObject({ status: 200, corpo: { resultado: 'enviado' } });
    expect(d.enviarEmailDeSenha).toHaveBeenCalledWith('ana@x.com');
    expect(d.registrar).toHaveBeenCalledWith(ADMIN, 'reenviou e-mail de senha', ALVO, 'ana@x.com', {});
  });

  it('cliente removido: 400 "Reative o cliente antes"', async () => {
    const d = deps({ contaPorId: vi.fn(async () => ({ id: ALVO, email: 'ana@x.com', status: 'removido' as const })) });
    const r = await atender(pedido({ acao: 'reenviar', alvo: ALVO }), d);
    expect(r).toMatchObject({ status: 400, corpo: { erro: 'Reative o cliente antes' } });
    expect(d.enviarEmailDeSenha).not.toHaveBeenCalled();
  });

  it('alvo inexistente ou inválido: 400', async () => {
    const d = deps({ contaPorId: vi.fn(async () => null) });
    expect((await atender(pedido({ acao: 'reenviar', alvo: ALVO }), d)).status).toBe(400);
    expect((await atender(pedido({ acao: 'reenviar', alvo: 'x' }), deps())).status).toBe(400);
  });

  it('envio falhou: 502 e nada no Registro', async () => {
    const d = deps({ enviarEmailDeSenha: vi.fn(async () => false) });
    const r = await atender(pedido({ acao: 'reenviar', alvo: ALVO }), d);
    expect(r.status).toBe(502);
    expect(d.registrar).not.toHaveBeenCalled();
  });
});
