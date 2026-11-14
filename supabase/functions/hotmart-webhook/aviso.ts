// Leitura pura do aviso (webhook v2) da Hotmart: sem Deno e sem rede, para o vitest testar direto.
// Os campos são lidos em vários caminhos porque a Hotmart muda a forma conforme o evento; o que não casa
// vira null e o aviso é ignorado, nunca libera.
import { normalizarEmail } from '../admin-usuarios/regras.ts';

export type TipoDoAviso = 'aprova' | 'estorna' | 'ignora';
export type Aviso = {
  evento: string;
  tipo: TipoDoAviso;
  transacao: string | null;
  email: string | null;
  produtoId: string | null;
};

/** Um aviso legítimo tem poucos KB; acima disso a função recusa sem ler. */
export const TAMANHO_MAXIMO_DO_CORPO = 100_000;

const EVENTOS_QUE_APROVAM = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE']);
const STATUS_PAGOS = new Set(['APPROVED', 'COMPLETE', 'COMPLETED']);
const EVENTOS_QUE_ESTORNAM = new Set(['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK']);

function ler(payload: unknown, ...caminho: string[]): unknown {
  let atual: unknown = payload;
  for (const chave of caminho) {
    if (typeof atual !== 'object' || atual === null || Array.isArray(atual)) return undefined;
    atual = (atual as Record<string, unknown>)[chave];
  }
  return atual;
}

/** Texto curto vindo de terceiro: sem caractere de controle (vai a log e ao Registro), aparado e cortado em 64. */
function identificador(v: unknown): string | null {
  const cru = typeof v === 'number' && Number.isFinite(v) ? String(v) : typeof v === 'string' ? v : null;
  if (cru === null) return null;
  const semControle = Array.from(cru)
    .filter((c) => {
      const codigo = c.codePointAt(0) ?? 0;
      return codigo > 31 && codigo !== 127;
    })
    .join('');
  const limpo = semControle.trim().slice(0, 64);
  return limpo === '' ? null : limpo;
}

function primeiro<T>(...valores: (T | null)[]): T | null {
  for (const v of valores) if (v !== null) return v;
  return null;
}

export function lerAviso(payload: unknown): Aviso {
  const evento = identificador(ler(payload, 'event')) ?? '';
  const status = identificador(ler(payload, 'data', 'purchase', 'status'))?.toUpperCase() ?? '';
  let tipo: TipoDoAviso = 'ignora';
  if (EVENTOS_QUE_APROVAM.has(evento) && STATUS_PAGOS.has(status)) tipo = 'aprova';
  else if (EVENTOS_QUE_ESTORNAM.has(evento)) tipo = 'estorna';

  return {
    evento,
    tipo,
    transacao: identificador(ler(payload, 'data', 'purchase', 'transaction')),
    email: primeiro(
      normalizarEmail(ler(payload, 'data', 'buyer', 'email')),
      normalizarEmail(ler(payload, 'data', 'subscriber', 'email')),
    ),
    produtoId: primeiro(
      identificador(ler(payload, 'data', 'product', 'id')),
      identificador(ler(payload, 'data', 'purchase', 'product', 'id')),
      identificador(ler(payload, 'data', 'subscription', 'product', 'id')),
    ),
  };
}

/** why: comparação em tempo constante (percorre o maior comprimento e acumula XOR), para o tempo de resposta não revelar o hottok. */
export function tokenConfere(recebido: string, esperado: string): boolean {
  if (!esperado) return false;
  const tamanho = Math.max(recebido.length, esperado.length);
  let diferenca = recebido.length ^ esperado.length;
  for (let i = 0; i < tamanho; i++) {
    diferenca |= (recebido.charCodeAt(i) || 0) ^ (esperado.charCodeAt(i) || 0);
  }
  return diferenca === 0;
}
