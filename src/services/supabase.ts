import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Valores públicos do cliente (a chave publishable não é segredo); quem barra é o RLS.
const URL_DO_PLAN26 = 'https://aixjmxfkaziqlxnpudkk.supabase.co';
const CHAVE_DO_PLAN26 = 'sb_publishable_dBg8bB4xBbSK6TzcFKCSIA_a9KjnmEZ';

// Supabase local (`npm run db:local`): URL e chave publishable de demonstração, iguais em toda máquina
// (a chave anon em JWT também serviria, mas o gitleaks a barra como segredo).
const URL_LOCAL = 'http://127.0.0.1:54321';
const CHAVE_LOCAL = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

type Ambiente = {
  DEV: boolean;
  MODE: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

// Modo do `npm run dev:local`. Não pode ser "local": o Vite o recusa, por colidir com o sufixo .local dos .env.
export const MODO_LOCAL = 'banco-local';

export function configDoSupabase(env: Ambiente): { url: string; chave: string } {
  // Só no `vite --mode banco-local` de desenvolvimento: um build de produção nunca aponta para 127.0.0.1.
  if (env.DEV && env.MODE === MODO_LOCAL) return { url: URL_LOCAL, chave: CHAVE_LOCAL };
  return {
    url: env.VITE_SUPABASE_URL || URL_DO_PLAN26,
    chave: env.VITE_SUPABASE_ANON_KEY || CHAVE_DO_PLAN26,
  };
}

const config = configDoSupabase(import.meta.env as unknown as Ambiente);

export const supabase: SupabaseClient = createClient(config.url, config.chave);

// Com os padrões do PLAN26 nunca é verdade (como já era com o Firebase); preserva o modo local do app, sem servidor.
export const semServidor = !config.url || !config.chave;

// O mesmo mínimo do Auth (local em supabase/config.toml; no PLAN26, no painel).
export const SENHA_MINIMA = 6;

export type UsuarioDoApp = {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
};

export function usuarioDoSupabase(
  u: {
    id: string;
    email?: string;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown>;
  } | null | undefined,
): UsuarioDoApp | null {
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  // `name` vem do cadastro com senha; `full_name`, do Google.
  const nome = [meta.name, meta.full_name].find((v) => typeof v === 'string' && v.trim() !== '');
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName: (nome as string | undefined) ?? null,
    emailVerified: Boolean(u.email_confirmed_at),
  };
}

export function telaDeEntrada(e: {
  recuperandoSenha: boolean;
  temUsuario: boolean;
}): 'definir_senha' | 'app' | 'login' {
  if (!e.temUsuario) return 'login';
  // O link de "criar senha" abre uma sessão: sem esta tela, a pessoa entraria sem nunca escolher a senha.
  return e.recuperandoSenha ? 'definir_senha' : 'app';
}
