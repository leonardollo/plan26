import { describe, it, expect } from 'vitest';
import { markdownSeguro } from './markdownSeguro';

describe('markdownSeguro', () => {
  it('escapa tag injetada', () => {
    const html = markdownSeguro('<img src=x onerror=alert(1)>', 'relatorio');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toMatch(/<img/i);
  });
  it('mantém negrito e escapa aspas e script', () => {
    const html = markdownSeguro('**Gargalo:** "<script>"', 'relatorio');
    expect(html).toMatch(/<strong [^>]*>Gargalo:<\/strong> &quot;&lt;script&gt;&quot;/);
    expect(html).not.toMatch(/<script/i);
  });
  it('título de relatório vira h3', () => {
    const html = markdownSeguro('### Título\ntexto', 'relatorio');
    expect(html).toMatch(/<h3 [^>]*>Título<\/h3>/);
    expect(html).toContain('texto');
  });
  it('título de análise segue a formatação das Configurações (### vira h4)', () => {
    expect(markdownSeguro('### Título', 'analise')).toMatch(/<h4[^>]*>Título<\/h4>/);
  });
  it('escapa e comercial', () => {
    expect(markdownSeguro('a & b', 'relatorio')).toContain('a &amp; b');
  });
  it('título com atributo injetado continua texto', () => {
    const html = markdownSeguro('### "><img src=x onerror=alert(1)>\n', 'relatorio');
    expect(html).not.toMatch(/<img/i);
  });
  it('vazio, nulo e indefinido viram string vazia', () => {
    expect(markdownSeguro('')).toBe('');
    expect(markdownSeguro(null)).toBe('');
    expect(markdownSeguro(undefined)).toBe('');
  });
});
