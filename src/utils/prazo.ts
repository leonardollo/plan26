// Prazo do acesso pago, sempre no dia de São Paulo (o dos clientes e o de admin_definir_prazo), não no do navegador.
const FUSO = 'America/Sao_Paulo';
const DATA_EM_SP: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO };
const DIA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIA_MS = 24 * 60 * 60 * 1000;

export const MSG_DATA_FUTURA = 'Escolha uma data futura; para cortar o acesso, use Bloquear';
export const MSG_MAX_5_ANOS = 'O prazo vai até 5 anos à frente';

/** 'AAAA-MM-DD' do instante no dia de São Paulo. */
function diaDoInstante(instante: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(instante);
}

export function hojeEmSP(agora: Date = new Date()): string {
  return diaDoInstante(agora);
}

/** Dia (São Paulo) de um prazo gravado; é o valor inicial do campo de data. */
export function diaEmSP(acessoAte: string): string {
  return diaDoInstante(new Date(acessoAte));
}

function diaValido(dia: string): boolean {
  const m = DIA_ISO.exec(dia);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA_MS);
}

export function somarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Soma anos como o Postgres (date + interval): 29/02 vira 28/02 quando o ano de destino não é bissexto. */
export function somarAnos(dia: string, anos: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  const ultimoDoMes = new Date(Date.UTC(a + anos, m, 0)).getUTCDate();
  return `${a + anos}-${String(m).padStart(2, '0')}-${String(Math.min(d, ultimoDoMes)).padStart(2, '0')}`;
}

/** Ponto de partida dos atalhos +1 ano / +30 dias: o prazo, se ainda vale; senão, hoje. */
export function baseDosAtalhos(acessoAte: string | null | undefined, agora: Date = new Date()): string {
  if (acessoAte) {
    const prazo = new Date(acessoAte);
    if (!Number.isNaN(prazo.getTime()) && prazo.getTime() > agora.getTime()) return diaDoInstante(prazo);
  }
  return hojeEmSP(agora);
}

/** Mesmas regras de admin_definir_prazo: só dia futuro, até 5 anos à frente. null = válido. */
export function validarDiaDoPrazo(dia: string, agora: Date = new Date()): string | null {
  if (!diaValido(dia)) return 'Escolha uma data';
  const hoje = hojeEmSP(agora);
  if (dia <= hoje) return MSG_DATA_FUTURA;
  if (dia > somarAnos(hoje, 5)) return MSG_MAX_5_ANOS;
  return null;
}

/**
 * "Sem prazo" | "Acesso até dd/mm/aaaa · faltam N dias" | "Vencido em dd/mm/aaaa · há N dias".
 * Vence em prazo <= agora, como no banco; os dias contam no calendário de São Paulo.
 */
export function rotuloDoPrazo(acessoAte: string | null | undefined, agora: Date = new Date()): string {
  if (!acessoAte) return 'Sem prazo';
  const prazo = new Date(acessoAte);
  if (Number.isNaN(prazo.getTime())) return 'Sem prazo';
  const data = prazo.toLocaleDateString('pt-BR', DATA_EM_SP);
  const dias = diasEntre(hojeEmSP(agora), diaDoInstante(prazo));
  if (prazo.getTime() <= agora.getTime()) {
    const ha = dias === 0 ? 'hoje' : `há ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`;
    return `Vencido em ${data} · ${ha}`;
  }
  const falta = dias === 0 ? 'vence hoje' : dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`;
  return `Acesso até ${data} · ${falta}`;
}
