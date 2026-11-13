// Rótulo do prazo do acesso pago, na data de São Paulo (a dos clientes), não na do navegador.
const DATA_EM_SP: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' };

/** "Sem prazo" | "dd/mm/aaaa" | "Vencido em dd/mm/aaaa"; vence em prazo <= agora, como no banco. */
export function rotuloDoPrazo(acessoAte: string | null | undefined, agora: Date = new Date()): string {
  if (!acessoAte) return 'Sem prazo';
  const prazo = new Date(acessoAte);
  if (Number.isNaN(prazo.getTime())) return 'Sem prazo';
  const data = prazo.toLocaleDateString('pt-BR', DATA_EM_SP);
  return prazo.getTime() <= agora.getTime() ? `Vencido em ${data}` : data;
}
