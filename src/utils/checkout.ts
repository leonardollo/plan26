// Link do checkout anual da Hotmart e o preço mostrado nas telas, lidos das variáveis públicas do build.
export type ConfigDoCheckout = { url: string; preco: string | null };

const HOST_DO_CHECKOUT = 'pay.hotmart.com';

/** null quando o link falta ou não é https://pay.hotmart.com/…: as telas mostram "Assinaturas abrem em breve". */
export function configDoCheckout(env: { VITE_HOTMART_CHECKOUT_URL?: string; VITE_PRECO_ANUAL?: string }): ConfigDoCheckout | null {
  const bruto = env.VITE_HOTMART_CHECKOUT_URL?.trim();
  if (!bruto) return null;
  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    return null;
  }
  // why: o botão leva a pessoa a pagar; só aceita o host da Hotmart em https, nunca um link qualquer da configuração.
  if (url.protocol !== 'https:' || url.host !== HOST_DO_CHECKOUT) return null;
  return { url: bruto, preco: env.VITE_PRECO_ANUAL?.trim() || null };
}

/** Acrescenta o e-mail de quem entrou, para a Hotmart já preencher; mantém os parâmetros do link (ex.: ?off=). */
export function linkDoCheckout(config: ConfigDoCheckout, email?: string | null): string {
  if (!email) return config.url;
  const url = new URL(config.url);
  url.searchParams.set('email', email);
  return url.toString();
}

export const CHECKOUT = configDoCheckout(import.meta.env);
