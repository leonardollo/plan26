import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// O app vai para o navegador inteiro: nada do Firebase e nenhuma chave de serviço do Supabase pode estar aqui.
const PROIBIDOS = ['firebase/', 'service_role', 'SERVICE_ROLE'];
const RAIZ = join(__dirname);
const ESTE_ARQUIVO = 'seguranca.test.ts';

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap(nome => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}

describe('código do app', () => {
  it('não cita o SDK do Firebase nem a chave de serviço', () => {
    const achados = arquivos(RAIZ)
      .filter(c => relative(RAIZ, c) !== ESTE_ARQUIVO)
      .flatMap(c => {
        const texto = readFileSync(c, 'utf8');
        return PROIBIDOS.filter(p => texto.includes(p)).map(p => `${relative(RAIZ, c)}: ${p}`);
      });
    expect(achados).toEqual([]);
  });
});
