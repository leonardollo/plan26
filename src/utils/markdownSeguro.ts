// Texto de cliente e de IA só vira HTML por aqui: escapa tudo e só depois aplica a formatação.
// Duas variantes porque o relatório e as Configurações já formatavam de jeitos diferentes; o visual não muda.

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;') // primeiro, para não escapar de novo as entidades abaixo
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatarRelatorio(html: string): string {
  return html
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
    .replace(/### (.*?)\n/g, '<h3 class="text-lg font-bold text-gray-800 mt-6 mb-2 border-l-4 border-brand-orange pl-3">$1</h3>\n')
    .replace(/#### (.*?)\n/g, '<h4 class="text-base font-bold text-gray-700 mt-4 mb-1">$1</h4>\n')
    .replace(/\n/g, '<br/>');
}

function formatarAnalise(texto: string): string {
  let html = texto
    // Títulos
    .replace(/^### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^## (.*$)/gm, '<h3>$1</h3>')
    .replace(/^# (.*$)/gm, '<h2>$1</h2>')
    // Negrito e itálico
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Listas
    .replace(/^\s*[-*]\s+(.*$)/gm, '<li>$1</li>')
    .replace(/^\s*\d+\.\s+(.*$)/gm, '<li>$1</li>')
    // Parágrafos
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Agrupa <li> consecutivos em <ul>
  html = html.replace(/(<li>.*?<\/li>)+/gs, (match) => `<ul>${match}</ul>`);

  return `<p>${html}</p>`;
}

export function markdownSeguro(
  texto: string | null | undefined,
  variante: 'analise' | 'relatorio' = 'analise',
): string {
  if (!texto) return '';
  const escapado = escapar(texto);
  return variante === 'relatorio' ? formatarRelatorio(escapado) : formatarAnalise(escapado);
}
