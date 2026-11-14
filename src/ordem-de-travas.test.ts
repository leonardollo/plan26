import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Toda função que trava pagamentos_hotmart e acessos o faz nessa ordem (a do estorno da Hotmart);
// a ordem inversa em outra função dá deadlock (40P01) com um estorno simultâneo do mesmo cliente.
const MIGRACOES = join(__dirname, '..', 'supabase', 'migrations');
// Trava = select/perform ... for update ou um update direto na tabela.
const trava = (tabela: string) =>
  new RegExp(`from\\s+public\\.${tabela}\\b[^;]*\\bfor\\s+update|update\\s+public\\.${tabela}\\b`, 'i');
const TRAVA_PAGAMENTOS = trava('pagamentos_hotmart');
const TRAVA_ACESSOS = trava('acessos');

function corposDeFuncao(sql: string): string[] {
  return sql.split('$$').filter((_, i) => i % 2 === 1);
}

describe('migrações', () => {
  it('travam pagamentos_hotmart antes de acessos em toda função que trava os dois', () => {
    const invertidas = readdirSync(MIGRACOES)
      .filter((nome) => nome.endsWith('.sql'))
      .flatMap((nome) =>
        corposDeFuncao(readFileSync(join(MIGRACOES, nome), 'utf8'))
          .filter((corpo) => {
            const pagamentos = corpo.search(TRAVA_PAGAMENTOS);
            const acessos = corpo.search(TRAVA_ACESSOS);
            return pagamentos >= 0 && acessos >= 0 && acessos < pagamentos;
          })
          .map(() => nome),
      );
    expect(invertidas).toEqual([]);
  });
});
