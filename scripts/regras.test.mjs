// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (arquivo) => readFileSync(join(import.meta.dirname, '..', arquivo), 'utf8');

/** Cada `allow <métodos>: if <condição>;` do arquivo, sem comentários e com espaços normalizados. */
function regras(texto) {
  const semComentarios = texto.replace(/\/\/.*$/gm, '');
  const achadas = [...semComentarios.matchAll(/allow\s+([a-z,\s]+?)\s*:\s*if\s+([\s\S]*?);/g)].map((r) => ({
    metodos: r[1].split(',').map((m) => m.trim()),
    condicao: r[2].replace(/\s+/g, ' ').trim(),
  }));
  // Um `allow` que a expressão acima não pegou passaria sem conferência.
  expect(achadas).toHaveLength((semComentarios.match(/\ballow\b/g) ?? []).length);
  return achadas;
}

const ESCRITA = ['write', 'create', 'update', 'delete'];
const LEITURA = ['read', 'get', 'list'];

function leituras(texto) {
  return regras(texto).flatMap((r) => r.metodos.filter((m) => LEITURA.includes(m)).map((m) => `${m}: ${r.condicao}`));
}

describe('firestore.congelado.rules', () => {
  const congelado = ler('firestore.congelado.rules');

  it('nenhuma escrita com condição diferente de false', () => {
    const abertas = regras(congelado).filter((r) => r.metodos.some((m) => ESCRITA.includes(m)) && r.condicao !== 'false');
    expect(abertas).toEqual([]);
  });

  it('nenhuma regra mistura leitura e escrita (a leitura herdaria o false, ou a escrita a condição)', () => {
    const mistas = regras(congelado).filter((r) => r.metodos.some((m) => ESCRITA.includes(m)) && r.metodos.some((m) => LEITURA.includes(m)));
    expect(mistas.filter((r) => r.condicao !== 'false')).toEqual([]);
  });

  it('as leituras são as mesmas do firestore.rules, na mesma ordem', () => {
    expect(leituras(congelado)).toEqual(leituras(ler('firestore.rules')));
  });
});
