import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Verificação permanente: o ano do plano vem de anoPlano/anoBase, nunca de um número fixo no código.
// Anos reais (de lei ou de dado) ficam entre os marcadores ano-real:início e ano-real:fim.
const RAIZ = join(__dirname, '..');

const ANO = /(?<![\w])20[2-3]\d(?!\d)/g;
const MES_OU_DIA_COM_ANO = /(?<![\w])(?:[A-Za-z]{3}|\d{2})\/2\d(?!\d)/g;

function arquivosDoCodigo(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosDoCodigo(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\./.test(nome) ? [caminho] : [];
  });
}

/** Devolve as violações de um arquivo como `src/<rel>:<linha>: <trecho>`. */
function violacoesDoTexto(rel: string, fonte: string): string[] {
  const linhas = fonte.split('\n');

  // 1. Blocos ano-real: as linhas entre os marcadores (inclusive) saem da verificação.
  let inicio = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].includes('ano-real:início')) {
      if (inicio !== -1) return [`src/${rel}:${i + 1}: ano-real:início dentro de outro bloco`];
      inicio = i;
    } else if (linhas[i].includes('ano-real:fim')) {
      if (inicio === -1) return [`src/${rel}:${i + 1}: ano-real:fim sem início`];
      for (let j = inicio; j <= i; j++) linhas[j] = '';
      inicio = -1;
    }
  }
  if (inicio !== -1) return [`src/${rel}:${inicio + 1}: ano-real:início sem ano-real:fim`];

  // 2. Comentários: /* … */ vira quebras de linha equivalentes; // até o fim da linha, se não vier depois de ":" (URLs).
  const semComentarios = linhas
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ''))
    .replace(/(?<!:)\/\/.*$/gm, '');

  // 3. Cada ano fixo restante reprova a linha.
  const violacoes: string[] = [];
  semComentarios.split('\n').forEach((linha, i) => {
    if (rel === 'services/planos.ts' && linha.includes('ANO_DO_PLANO_LEGADO =')) return;
    for (const re of [ANO, MES_OU_DIA_COM_ANO]) {
      for (const achado of linha.matchAll(re)) {
        violacoes.push(`src/${rel}:${i + 1}: ${linha.trim().slice(0, 120)} [${achado[0]}]`);
      }
    }
  });
  return violacoes;
}

describe('ano fixo no código', () => {
  it('nenhum ano fixo fora de ano-real', () => {
    const violacoes: string[] = [];
    for (const arquivo of arquivosDoCodigo(RAIZ)) {
      const rel = relative(RAIZ, arquivo).split('\\').join('/');
      violacoes.push(...violacoesDoTexto(rel, readFileSync(arquivo, 'utf8')));
    }
    expect(violacoes, `ano fixo em:\n${violacoes.join('\n')}`).toEqual([]);
  });

  describe('a própria verificação', () => {
    const v = (texto: string) => violacoesDoTexto('x.tsx', texto);

    it('<h2>Metas 2026</h2> reprova', () => expect(v('<h2>Metas 2026</h2>')).toHaveLength(1));
    it('goals2026.financeiras passa', () => expect(v('const x = goals2026.financeiras;')).toEqual([]));
    it('// até 2027 passa', () => expect(v('const x = 1; // até 2027')).toEqual([]));
    it('/* 2026 */ passa e mantém a numeração', () =>
      expect(v('/* em\n2026 */\nconst a = "2025";')).toEqual(['src/x.tsx:3: const a = "2025"; [2025]']));
    it("'https://x.com/2026' reprova", () => expect(v("const u = 'https://x.com/2026';")).toHaveLength(1));
    it('Saldo Dez/26 reprova', () => expect(v('<span>Saldo Dez/26</span>')).toHaveLength(1));
    it('31/12/25 reprova', () => expect(v('<span>em 31/12/25</span>')).toHaveLength(1));
    it('um bloco ano-real passa', () =>
      expect(v('// ano-real:início\nconst lei = "LC 214/2025";\n// ano-real:fim\nconst y = 1;')).toEqual([]));
    it('bloco ano-real em JSX passa', () =>
      expect(v('{/* ano-real:início */}\n<p>2027: CBS</p>\n{/* ano-real:fim */}')).toEqual([]));
    it('ano-real:início sem fim reprova', () =>
      expect(v('// ano-real:início\nconst lei = 1;')).toEqual(['src/x.tsx:1: ano-real:início sem ano-real:fim']));
    it('ANO_DO_PLANO_LEGADO só em services/planos.ts', () => {
      expect(violacoesDoTexto('services/planos.ts', 'export const ANO_DO_PLANO_LEGADO = 2026;')).toEqual([]);
      expect(v('export const ANO_DO_PLANO_LEGADO = 2026;')).toHaveLength(1);
    });
  });
});
