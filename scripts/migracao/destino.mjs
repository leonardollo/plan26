// Trava dos scripts que gravam: o destino só é aceito se for o Supabase local ou se quem roda
// digitou o ref do projeto remoto em --confirmo. Assim um .env apontando para a produção não grava por engano.

const HOSTS_LOCAIS = ['127.0.0.1', 'localhost'];

/** Devolve { host, local } ou lança com a instrução do que falta. */
export function conferirDestino(urlTexto, confirmo) {
  let url;
  try {
    url = new URL(urlTexto ?? '');
  } catch {
    throw new Error('SUPABASE_URL vazia ou inválida.');
  }
  if (HOSTS_LOCAIS.includes(url.hostname)) return { host: url.host, local: true };

  const ref = /^([a-z0-9]+)\.supabase\.co$/.exec(url.hostname)?.[1];
  if (url.protocol !== 'https:' || !ref) throw new Error(`Destino ${url.host} não é um projeto https://<ref>.supabase.co.`);
  if (confirmo !== ref) throw new Error(`Destino remoto ${url.host}: para gravar, rode de novo com --confirmo=${ref}.`);
  return { host: url.host, local: false };
}
