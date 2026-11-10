# Log de entregas

Uma entrada por entrega, escrita pelo `/ship`, a mais recente no topo. Não é carregado
automaticamente: sessões novas leem as últimas entradas e o plano em andamento.

## 2026-11-10 — Correção das vulnerabilidades do npm audit

- **O quê:** `npm audit fix` (só patch/minor: `vite` 7.3.2→7.3.8, `uuid` 13.0.0→13.0.2, `esbuild`,
  `postcss`, `ws`, `nanoid`, `@babel/core` e outras transitivas) e `overrides` de `@grpc/grpc-js`
  para `^1.13.6`. Audit foi de 13 vulnerabilidades (1 crítica, 8 altas) para 0.
- **Por quê:** o passo de audit do CI ficava vermelho. Os 4 alertas restantes vinham do
  `@grpc/grpc-js` 1.9.16 dentro do `@firebase/firestore`, que fixa `~1.9.0` até no Firebase 13.2.0;
  o "fix" do npm era voltar ao Firebase 9. O grpc só é usado no build Node do Firestore e não entra
  no bundle do navegador (conferido em `dist/`), então o override não muda o app. Revisar o
  override quando o Firebase subir o grpc-js.
- **Verificação:** `npm ci` ok; `npm run typecheck` sem erros; `npm run build` ok (built in 1.71s);
  `npm audit --audit-level=high` → found 0 vulnerabilities. Preview do build de produção: tela de
  login renderiza no celular (390×844) e no desktop, sem erros no console.
- **Revisão:** Codex (`codex review --base vibecoderpack`), nível Normal: sem achados.
- **Em aberto:** telas internas não testadas após o login (sem credencial de teste).
- **Commit/PR:** `56a273c` na branch `npm-audit-fix`, criada a partir de `vibecoderpack`.

<!--
## AAAA-MM-DD — título curto

- **O quê:** o que foi entregue, em uma ou duas linhas.
- **Por quê:** decisões tomadas e o motivo (o que restringe código também vira comentário no código).
- **Verificação:** comandos rodados no estado final e o resultado (ex.: `test 412/412`, build ok).
- **Revisão:** quem revisou e o nível; achados corrigidos e rejeitados, com motivo.
- **Em aberto:** defeitos conhecidos, riscos aceitos, passos humanos pendentes.
- **Commit/PR:** hash ou link.
-->
