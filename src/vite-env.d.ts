/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Link do checkout anual (https://pay.hotmart.com/…); sem ele, as telas mostram "Assinaturas abrem em breve". */
  readonly VITE_HOTMART_CHECKOUT_URL?: string;
  /** Preço anual como aparece no cartão, ex.: "R$ 497". */
  readonly VITE_PRECO_ANUAL?: string;
}
