import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Verificação permanente contra a volta do XSS: texto livre só vira HTML pelo markdownSeguro.
const RAIZ = join(__dirname, '..');
const PERMITIDOS = new Set(['components/Taxes.tsx']); // ícones fixos no código

function arquivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosTsx(caminho);
    return caminho.endsWith('.tsx') ? [caminho] : [];
  });
}

describe('HTML cru', () => {
  it('nenhum HTML cru fora do markdownSeguro', () => {
    const violacoes: string[] = [];
    for (const arquivo of arquivosTsx(RAIZ)) {
      const rel = relative(RAIZ, arquivo).split('\\').join('/');
      if (PERMITIDOS.has(rel)) continue;
      const fonte = readFileSync(arquivo, 'utf8');
      let i = fonte.indexOf('dangerouslySetInnerHTML');
      while (i !== -1) {
        if (!fonte.slice(i, i + 200).includes('markdownSeguro(')) {
          const linha = fonte.slice(0, i).split('\n').length;
          violacoes.push(`src/${rel}:${linha}`);
        }
        i = fonte.indexOf('dangerouslySetInnerHTML', i + 1);
      }
    }
    expect(violacoes, `dangerouslySetInnerHTML sem markdownSeguro em:\n${violacoes.join('\n')}`).toEqual([]);
  });
});
