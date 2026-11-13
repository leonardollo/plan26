import { describe, expect, it, vi } from 'vitest';
import { TAMANHO_MAXIMO_DO_CORPO } from './aviso';
import { atenderWebhook, type DependenciasDoWebhook, type PedidoDoWebhook, type ResultadoDoBanco } from './fluxo';

const HOTTOK = 'hottok-de-teste';
const PRODUTO = '900001';

function corpo(evento = 'PURCHASE_APPROVED', status = 'APPROVED', produto: unknown = 900001, email = 'Ana@X.com ') {
  return JSON.stringify({
    event: evento,
    data: { purchase: { transaction: 'HP1', status }, buyer: { email }, product: { id: produto } },
  });
}

type ExtraDoPedido = Partial<Omit<PedidoDoWebhook, 'lerCorpo'>> & { corpo?: string };

/** O corpo só é lido quando o fluxo pede (lerCorpo); o espião mostra se o portão leu antes da hora. */
function pedido(extra: ExtraDoPedido = {}) {
  const { corpo: c = corpo(), ...resto } = extra;
  const lerCorpo = vi.fn(async () => c);
  return { metodo: 'POST', hottok: HOTTOK, tamanho: c.length, lerCorpo, ...resto } satisfies PedidoDoWebhook;
}

function resultado(r: string, userId: string | null = 'u1'): ResultadoDoBanco {
  return { resultado: r, user_id: userId, antes: null, depois: null };
}

function deps(extra: Partial<DependenciasDoWebhook> = {}): DependenciasDoWebhook {
  return {
    hottok: HOTTOK,
    produtoId: PRODUTO,
    aplicar: vi.fn(async () => resultado('liberou')),
    criarConta: vi.fn(async () => ({ id: 'u1' })),
    nuncaEntrou: vi.fn(async () => true),
    enviarEmailDeSenha: vi.fn(async () => true),
    registrarFalhaDeEmail: vi.fn(async () => {}),
    ...extra,
  };
}

function nadaChamado(d: DependenciasDoWebhook) {
  expect(d.aplicar).not.toHaveBeenCalled();
  expect(d.criarConta).not.toHaveBeenCalled();
  expect(d.enviarEmailDeSenha).not.toHaveBeenCalled();
}

describe('atenderWebhook: portão', () => {
  it('ex11: segredo ausente → 500 e nada chamado', async () => {
    for (const hottok of [null, '']) {
      const d = deps({ hottok });
      expect((await atenderWebhook(pedido(), d)).status).toBe(500);
      nadaChamado(d);
    }
  });

  it('hottok errado ou vazio → 401 e nada chamado', async () => {
    for (const hottok of ['outro', '', null, `${HOTTOK}x`]) {
      const d = deps();
      expect((await atenderWebhook(pedido({ hottok }), d)).status, String(hottok)).toBe(401);
      nadaChamado(d);
    }
  });

  it('método GET → 405', async () => {
    const d = deps();
    expect((await atenderWebhook(pedido({ metodo: 'GET' }), d)).status).toBe(405);
    nadaChamado(d);
  });

  it('corpo acima do limite → 413 e nada chamado', async () => {
    const d = deps();
    const grande = 'x'.repeat(TAMANHO_MAXIMO_DO_CORPO + 1);
    expect((await atenderWebhook(pedido({ corpo: grande, tamanho: null }), d)).status).toBe(413);
    expect((await atenderWebhook(pedido({ tamanho: TAMANHO_MAXIMO_DO_CORPO + 1 }), d)).status).toBe(413);
    nadaChamado(d);
  });

  it('segredo ausente, hottok errado/ausente, GET ou Content-Length grande → o corpo nem é lido', async () => {
    const casos: Array<[string, DependenciasDoWebhook, ExtraDoPedido]> = [
      ['segredo ausente', deps({ hottok: null }), {}],
      ['hottok errado', deps(), { hottok: 'outro' }],
      ['hottok ausente', deps(), { hottok: null }],
      ['GET', deps(), { metodo: 'GET' }],
      ['Content-Length grande', deps(), { tamanho: TAMANHO_MAXIMO_DO_CORPO + 1 }],
    ];
    for (const [nome, d, extra] of casos) {
      const p = pedido(extra);
      await atenderWebhook(p, d);
      expect(p.lerCorpo, nome).not.toHaveBeenCalled();
    }
  });

  it('pedido válido lê o corpo uma vez', async () => {
    const p = pedido();
    expect((await atenderWebhook(p, deps())).status).toBe(200);
    expect(p.lerCorpo).toHaveBeenCalledTimes(1);
  });

  it('JSON inválido → 400', async () => {
    const d = deps();
    expect((await atenderWebhook(pedido({ corpo: '{nao json' }), d)).status).toBe(400);
    nadaChamado(d);
  });

  it('ex10: outro produto ou HOTMART_PRODUTO_ID ausente → 200 e aplicar não é chamado', async () => {
    const outro = deps();
    expect(await atenderWebhook(pedido({ corpo: corpo('PURCHASE_APPROVED', 'APPROVED', 123) }), outro)).toMatchObject({
      status: 200,
      corpo: { ignorado: 'produto' },
    });
    nadaChamado(outro);
    const semProduto = deps({ produtoId: null });
    expect((await atenderWebhook(pedido(), semProduto)).status).toBe(200);
    nadaChamado(semProduto);
  });

  it('ex14: evento sem efeito ou sem e-mail → 200 e aplicar não é chamado', async () => {
    const d = deps();
    expect((await atenderWebhook(pedido({ corpo: corpo('PURCHASE_CANCELED', 'CANCELED') }), d)).status).toBe(200);
    expect((await atenderWebhook(pedido({ corpo: corpo('SUBSCRIPTION_CANCELLATION') }), d)).status).toBe(200);
    expect((await atenderWebhook(pedido({ corpo: corpo('PURCHASE_APPROVED', 'APPROVED', 900001, 'sem-arroba') }), d)).status).toBe(200);
    nadaChamado(d);
  });
});

describe('atenderWebhook: aprova', () => {
  it('ex1: sem conta → cria, aplica de novo, manda a senha uma vez', async () => {
    const aplicar = vi.fn().mockResolvedValueOnce(resultado('sem_conta', null)).mockResolvedValueOnce(resultado('liberou'));
    const d = deps({ aplicar });
    const r = await atenderWebhook(pedido(), d);
    expect(r).toMatchObject({ status: 200, corpo: { resultado: 'liberou' } });
    expect(d.criarConta).toHaveBeenCalledWith('ana@x.com');
    expect(aplicar).toHaveBeenCalledTimes(2);
    expect(aplicar).toHaveBeenNthCalledWith(1, 'HP1', 'ana@x.com', 'aprova', 'PURCHASE_APPROVED');
    expect(d.enviarEmailDeSenha).toHaveBeenCalledTimes(1);
    expect(d.enviarEmailDeSenha).toHaveBeenCalledWith('ana@x.com');
  });

  it('conta criada ao mesmo tempo por outro aviso (jaExiste) → aplica de novo', async () => {
    const aplicar = vi.fn().mockResolvedValueOnce(resultado('sem_conta', null)).mockResolvedValueOnce(resultado('estendeu'));
    const d = deps({ aplicar, criarConta: vi.fn(async () => ({ jaExiste: true as const })) });
    expect((await atenderWebhook(pedido(), d)).status).toBe(200);
    expect(aplicar).toHaveBeenCalledTimes(2);
    expect(d.enviarEmailDeSenha).not.toHaveBeenCalled();
  });

  it('ex13: criarConta falha na corrida com outro aviso → aplica de novo e segue com a conta do outro', async () => {
    const aplicar = vi.fn().mockResolvedValueOnce(resultado('sem_conta', null)).mockResolvedValueOnce(resultado('estendeu'));
    const criarConta = vi.fn(async () => Promise.reject(new Error('Database error creating new user')));
    const d = deps({ aplicar, criarConta });
    expect(await atenderWebhook(pedido(), d)).toMatchObject({ status: 200, corpo: { resultado: 'estendeu' } });
    expect(aplicar).toHaveBeenCalledTimes(2);
  });

  it('criarConta falha e a conta continua não existindo → 500', async () => {
    const d = deps({
      aplicar: vi.fn(async () => resultado('sem_conta', null)),
      criarConta: vi.fn(async () => Promise.reject(new Error('Auth fora do ar'))),
    });
    const r = await atenderWebhook(pedido(), d);
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.corpo)).not.toContain('Auth fora do ar');
    expect(d.enviarEmailDeSenha).not.toHaveBeenCalled();
  });

  it('sem conta mesmo depois de criar → 500', async () => {
    const d = deps({ aplicar: vi.fn(async () => resultado('sem_conta', null)) });
    expect((await atenderWebhook(pedido(), d)).status).toBe(500);
    expect(d.enviarEmailDeSenha).not.toHaveBeenCalled();
  });

  it('ex2: aviso repetido (resultado repetido) → não manda e-mail', async () => {
    const d = deps({ aplicar: vi.fn(async () => resultado('repetido')) });
    expect((await atenderWebhook(pedido(), d)).status).toBe(200);
    expect(d.nuncaEntrou).not.toHaveBeenCalled();
    expect(d.enviarEmailDeSenha).not.toHaveBeenCalled();
  });

  it('envia senha no retry quando a conta nunca entrou', async () => {
    const aplicar = vi
      .fn()
      .mockResolvedValueOnce(resultado('sem_conta', null))
      .mockRejectedValueOnce(new Error('banco caiu'))
      .mockResolvedValueOnce(resultado('liberou'));
    const d = deps({ aplicar });

    const primeira = await atenderWebhook(pedido(), d);
    expect(primeira.status).toBe(500);
    expect(JSON.stringify(primeira.corpo)).not.toContain('banco caiu');
    expect(d.criarConta).toHaveBeenCalledTimes(1);
    expect(d.enviarEmailDeSenha).not.toHaveBeenCalled();

    const segunda = await atenderWebhook(pedido(), d);
    expect(segunda.status).toBe(200);
    expect(d.criarConta).toHaveBeenCalledTimes(1);
    expect(d.enviarEmailDeSenha).toHaveBeenCalledTimes(1);
  });

  it('pendente que já entrou e paga → libera sem mandar e-mail', async () => {
    const d = deps({ nuncaEntrou: vi.fn(async () => false) });
    expect((await atenderWebhook(pedido(), d)).status).toBe(200);
    expect(d.nuncaEntrou).toHaveBeenCalledWith('u1');
    expect(d.enviarEmailDeSenha).not.toHaveBeenCalled();
  });

  it('e-mail que não saiu → 200 e registrarFalhaDeEmail chamado', async () => {
    const d = deps({ enviarEmailDeSenha: vi.fn(async () => false) });
    expect((await atenderWebhook(pedido(), d)).status).toBe(200);
    expect(d.registrarFalhaDeEmail).toHaveBeenCalledWith('u1', 'ana@x.com', 'HP1');
  });

  it('estendeu, sem prazo ou conta barrada → não manda e-mail', async () => {
    for (const r of ['estendeu', 'sem_prazo', 'conta_barrada']) {
      const d = deps({ aplicar: vi.fn(async () => resultado(r)) });
      expect((await atenderWebhook(pedido(), d)).status, r).toBe(200);
      expect(d.enviarEmailDeSenha, r).not.toHaveBeenCalled();
    }
  });

  it('erro do banco → 500 sem detalhe interno', async () => {
    const d = deps({ aplicar: vi.fn(async () => Promise.reject(new Error('segredo interno'))) });
    const r = await atenderWebhook(pedido(), d);
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.corpo)).not.toContain('segredo interno');
  });
});

describe('atenderWebhook: estorna', () => {
  it('estorno nunca cria conta', async () => {
    const d = deps({ aplicar: vi.fn(async () => resultado('estorno_sem_efeito', null)) });
    const r = await atenderWebhook(pedido({ corpo: corpo('PURCHASE_REFUNDED', 'REFUNDED') }), d);
    expect(r.status).toBe(200);
    expect(d.aplicar).toHaveBeenCalledWith('HP1', 'ana@x.com', 'estorna', 'PURCHASE_REFUNDED');
    expect(d.criarConta).not.toHaveBeenCalled();
    expect(d.enviarEmailDeSenha).not.toHaveBeenCalled();
  });
});

describe('atenderWebhook: logs', () => {
  // why: mensagem do Postgres ou do Auth pode trazer o e-mail do comprador; o log só leva evento, transação e resultado.
  const MSG = 'duplicate key (email)=(ana@x.com) já existe';

  function erroComEmail(extra: Record<string, unknown> = {}) {
    return Object.assign(new Error(MSG), extra);
  }

  async function logsDe(d: DependenciasDoWebhook) {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await atenderWebhook(pedido(), d);
      return JSON.stringify([...erro.mock.calls, ...log.mock.calls], (_k, v) => (v instanceof Error ? { m: v.message, n: v.name } : v));
    } finally {
      erro.mockRestore();
      log.mockRestore();
    }
  }

  function semDadosDoComprador(texto: string) {
    expect(texto.toLowerCase()).not.toContain('ana@x.com');
    expect(texto).not.toContain('duplicate key');
  }

  it('Auth e banco lançam com o e-mail na mensagem → nenhum log leva o e-mail nem a mensagem', async () => {
    semDadosDoComprador(
      await logsDe(
        deps({
          aplicar: vi.fn(async () => resultado('sem_conta', null)),
          criarConta: vi.fn(async () => Promise.reject(erroComEmail({ code: 'ana@x.com' }))),
        }),
      ),
    );
    semDadosDoComprador(await logsDe(deps({ aplicar: vi.fn(async () => Promise.reject(erroComEmail({ code: '23505' }))) })));
    semDadosDoComprador(
      await logsDe(
        deps({
          nuncaEntrou: vi.fn(async () => Promise.reject(erroComEmail({ name: 'AuthApiError' }))),
          enviarEmailDeSenha: vi.fn(async () => false),
          registrarFalhaDeEmail: vi.fn(async () => Promise.reject({ message: MSG, code: 'P0001' })),
        }),
      ),
    );
  });

  it('o log de falha leva um código curto (code ou name), não a mensagem', async () => {
    const texto = await logsDe(deps({ aplicar: vi.fn(async () => Promise.reject(erroComEmail({ code: '23505' }))) }));
    expect(texto).toContain('23505');
    expect(texto).toContain('HP1');
  });
});
