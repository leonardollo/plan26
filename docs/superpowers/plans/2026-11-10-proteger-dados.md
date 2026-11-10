# Entrega 1 — Proteger os dados: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `executing-plans`, como o subagente implementador que a sessão principal despacha, para implementar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** nenhuma falha consegue apagar o plano de um cliente, trancar o admin fora do próprio espaço, dar poder de admin a quem não é dono do e-mail, rodar script de terceiros na sessão, ou deixar a chave do Gemini de um cliente para o próximo usuário do navegador.

**Arquitetura:**
- **Regras do Firestore:** passam a ser testadas no emulador (`@firebase/rules-unit-testing`, projeto `demo-plan`).
- **Hook `usePlanData`:** ganha um estado de carga explícito, que bloqueia gravações até o plano ser lido.
- **Gate do `App`:** a decisão de qual tela mostrar vira uma função pura testada.
- **HTML de texto livre:** sai de um único escapador, `markdownSeguro`.

**Tecnologias:** React 19, Vite 7, TypeScript 5.9, Firebase 12 (Auth + Firestore), Vitest + jsdom + Testing Library, Firebase Emulator (Java 21).

**Especificação:** `docs/superpowers/specs/2026-11-10-proteger-dados-design.md`. Leia junto com este plano.

## Restrições globais

- **Branch:** `fix/proteger-dados`, no checkout principal, sem worktree. Commits pequenos, um por tarefa no mínimo.
- **npm:** usar só o npm. O `pnpm-lock.yaml` está desatualizado e não deve ser tocado.
- **Projeto do emulador:** sempre `demo-plan`. Nenhum comando fala com `plan-ea4cc`.
- **Proibido** `firebase deploy`, `vercel`, push e merge na `main`.
- **RAM (16 GB):** `tsc`, `vitest`, `build` e o emulador rodam um de cada vez. Rode só os testes afetados (`npx vitest related --run <arquivos>` ou o arquivo de teste). A suíte inteira, o typecheck e o build completos ficam para o `/ship`.
- **Comandos:** um comando simples por chamada, a partir da raiz, sem `cd`, sem `$?` e sem `${...}`. Edite com a ferramenta de edição, nunca com `sed -i`.
- **Arquivos grandes:** leia por faixa, nunca inteiros: `src/hooks/usePlanData.tsx`, `src/services/geminiService.ts`, `src/components/CommercialPlanning.tsx`.
- **Comentários:** decisão que restringe código ganha um comentário de uma linha dizendo o porquê, em português, onde ela se aplica.
- **Textos fixos da interface (exatos):**
  - "O plano ainda não foi carregado"
  - "Não consegui abrir seu plano. Nada foi alterado."
  - "Tentar de novo"
  - "Seu e-mail é de administrador, mas ainda não foi verificado."
  - "Enviar e-mail de verificação"
  - "Já verifiquei"
  - "Sair"
  - "E-mail verificado"
- **Chave do Gemini no `localStorage`:** `google_gemini_api_key`.

## Pré-requisito (sessão principal, antes do despacho)

- `brew install openjdk`, aprovado pelo usuário em 2026-11-10.
- `java -version` precisa responder 21 ou mais. Se não estiver no PATH, a sessão principal resolve com o usuário antes de despachar.

## Foco da revisão

1. **A carga falha de novo depois de "Tentar de novo".** Esperado: continua `falhou`, nenhum `setDoc`, nenhum laço de recarga sozinho. Teste na tarefa 4.
2. **A carga falha com a chave de outra pessoa no navegador.** Esperado: a chave sai do `localStorage` mesmo assim. Teste na tarefa 6.
3. **E-mail do admin com maiúsculas no token** (`Admin@GI.com`). Esperado: lê `admins/admin@gi.com` e é admin. Teste na tarefa 3.
4. **O admin clica em "Já verifiquei" sem ter verificado.** Esperado: continua na tela de verificação, com aviso, e nunca cai no app vazio. Teste na tarefa 5.
5. **"Salvar agora" com a carga em `falhou`.** Esperado: `saveStatus = 'error'` e o motivo "O plano ainda não foi carregado" visível na barra, nunca "salvo". Teste na tarefa 4.

---

### Tarefa 1: Vitest e `markdownSeguro` (partes 0 e 4)

**Arquivos:**
- Criar: `vitest.config.ts`, `src/utils/markdownSeguro.ts`, `src/utils/markdownSeguro.test.ts`, `src/utils/semHtmlCru.test.ts`
- Modificar: `package.json` (devDependencies, script `test`), `package-lock.json`
- Modificar: `src/components/reports/ReportPreview.tsx:239-245`
- Modificar: `src/components/Settings.tsx`, com uso na linha 321 e remoção da `formatMarkdown` local nas linhas 437-459

**Interfaces:**
- Produz: `markdownSeguro(texto: string | null | undefined, variante?: 'analise' | 'relatorio'): string`. O padrão é `'analise'`.
  - `'relatorio'` reproduz exatamente as trocas de `ReportPreview.tsx:239-245`: negrito com as classes atuais, `###`/`####` com as classes atuais, `\n` → `<br/>`.
  - `'analise'` reproduz exatamente a `formatMarkdown` de `Settings.tsx:437-459`.
  - Existem duas variantes para o visual não mudar. A especificação pede "as mesmas trocas usadas hoje", e hoje as duas telas formatam de jeitos diferentes.
- Produz: o script `npm test` (= `vitest run`) roda `src/**/*.test.{ts,tsx}` em jsdom e não roda `tests/rules/**`.

- [ ] **Passo 1: instalar as dependências de desenvolvimento**

  Rode: `npm install -D vitest jsdom @testing-library/react @testing-library/dom`

  Depois rode `npm audit --audit-level=high`. Se falhar por causa delas: **pare** e traga as opções. Não mude a política do audit.

- [ ] **Passo 2: criar `vitest.config.ts` e o script `test`**

  - `vitest.config.ts`: `environment: 'jsdom'`, `include: ['src/**/*.test.{ts,tsx}']`, sem plugins.
  - `package.json`: `"test": "vitest run"`.

- [ ] **Passo 3: escrever os testes que falham, em `src/utils/markdownSeguro.test.ts`**

  ```ts
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
  ```

- [ ] **Passo 4: escrever o teste que falha, em `src/utils/semHtmlCru.test.ts`**

  É a verificação permanente contra a volta do XSS. O teste percorre `src/**/*.tsx` com `fs` e exige que toda ocorrência de `dangerouslySetInnerHTML` seja uma destas:
  - estar em `src/components/Taxes.tsx`, que usa ícones fixos no código;
  - ter `markdownSeguro(` na mesma expressão, procurando nos 200 caracteres seguintes.

  O nome do teste é `nenhum HTML cru fora do markdownSeguro`. A mensagem de falha lista arquivo:linha.

- [ ] **Passo 5: rodar e ver falhar**

  Rode: `npx vitest run src/utils`

  Esperado: FAIL. `markdownSeguro` ainda não existe, e o `semHtmlCru` aponta `ReportPreview.tsx` e `Settings.tsx`.

- [ ] **Passo 6: implementar `src/utils/markdownSeguro.ts`**

  - Primeiro escape `&` (antes dos outros), `<`, `>`, `"` e `'` (`&#39;`).
  - Depois aplique as trocas da variante.

- [ ] **Passo 7: trocar os dois usos**

  - `ReportPreview.tsx:239-245` → `markdownSeguro(analysisText, 'relatorio')`.
  - `Settings.tsx:321` → `markdownSeguro(marketAnalysis, 'analise')`.
  - Remova a `formatMarkdown` local de `Settings.tsx`.

- [ ] **Passo 8: rodar e ver passar**

  Rode: `npx vitest run src/utils`

  Esperado: PASS, 8 testes.

- [ ] **Passo 9: commit**

  ```bash
  git add package.json package-lock.json vitest.config.ts src/utils/markdownSeguro.ts src/utils/markdownSeguro.test.ts src/utils/semHtmlCru.test.ts src/components/reports/ReportPreview.tsx src/components/Settings.tsx
  git commit -m "fix(xss): texto livre só vira HTML pelo markdownSeguro"
  ```

---

### Tarefa 2: Emulador, PR #4 e testes de `users` (partes 0 e 2)

**Arquivos:**
- Criar: `vitest.rules.config.ts`, `tests/rules/ambiente.ts`, `tests/rules/users.test.ts`
- Modificar: `package.json` (devDependencies, script `test:rules`), `package-lock.json`
- Modificar: `.github/workflows/ci.yml`, entre os marcadores `project checks`
- Modificar: `AGENTS.md`, só entre `<!-- project:start` e `<!-- project:end -->`
- Modificar: `.claude/settings.json`, `.codex/rules/project.rules`
- Mesclar: commit `4399e2c`, que traz `firestore.rules`, `Sidebar.tsx`, `usePlanData.tsx` e `types.ts`

**Interfaces:**
- Produz, em `tests/rules/ambiente.ts`:
  - `criarAmbiente(): Promise<RulesTestEnvironment>`, com `projectId: 'demo-plan'` e as regras lidas de `firestore.rules`;
  - `semear(env): Promise<void>`, que grava com as regras desligadas:
    - `admins/admin@gi.com` = `{}`;
    - `acessos/uid-liberado` = `{ status: 'liberado', email: 'liberado@x.com' }`;
    - `acessos/uid-pendente` = `{ status: 'pendente', email: 'pendente@x.com' }`;
    - `acessos/uid-bloqueado` = `{ status: 'bloqueado', email: 'bloqueado@x.com' }`;
    - `users/uid-outro` = `{ planData: {} }`;
  - os tokens usados em todos os testes de regra:
    - `ADMIN = { uid: 'uid-admin', token: { email: 'admin@gi.com', email_verified: true } }`;
    - `LIBERADO`, `PENDENTE`, `BLOQUEADO`, com uids iguais aos de `acessos` e `email_verified: true`.
- Produz: `npm run test:rules` = `firebase emulators:exec --only firestore --project demo-plan "vitest run --config vitest.rules.config.ts"`.
- Produz: do PR #4, `motivoDoErroAoSalvar: string` no contexto e a função `podeUsarOEspaco()` nas regras.

- [ ] **Passo 1: instalar as dependências**

  Rode: `npm install -D @firebase/rules-unit-testing firebase-tools`

  Depois rode `npm audit --audit-level=high`. Falhou por causa delas: **pare** e traga as opções.

- [ ] **Passo 2: criar a configuração e o script do emulador**

  - `vitest.rules.config.ts`: `environment: 'node'`, `include: ['tests/rules/**/*.test.ts']`, `fileParallelism: false` (os arquivos dividem o mesmo emulador), `testTimeout: 20000`.
  - Em `package.json`, o script `test:rules` descrito acima.
  - Em `vitest.config.ts`, o `include` já deixa de fora `tests/rules`.

- [ ] **Passo 3: escrever `tests/rules/users.test.ts` (tabela da parte 2)**

  - Um `it` por célula: 5 pessoas × 2 alvos (`users/{próprio}` e `users/uid-outro`), com leitura (`getDoc`) e gravação (`setDoc`).
  - Use `assertSucceeds` e `assertFails`.
  - "Sem login" usa `env.unauthenticatedContext()`.
  - Esperado:
    - admin e liberado: leem e gravam o próprio espaço;
    - todo o resto: negado;
    - `users/uid-outro`: sempre negado.

- [ ] **Passo 4: rodar e ver falhar**

  Rode: `npm run test:rules`

  - Esperado: FAIL só nas células "admin lê/grava o próprio espaço", porque a regra da `main` exige `acessos` liberado.
  - Se o emulador não subir: **pare** e reporte. Não pule estes testes.

- [ ] **Passo 5: commitar a base do emulador antes da mesclagem**

  Assim a mesclagem parte de uma árvore limpa. O teste do admin fica vermelho neste commit, de propósito.

  ```bash
  git add package.json package-lock.json vitest.rules.config.ts tests/rules
  git commit -m "test(rules): emulador do Firestore e tabela de acesso a users"
  ```

- [ ] **Passo 6: mesclar o PR #4 sem alterar o commit**

  Rode: `git merge --no-edit 4399e2c`

  Se houver conflito fora de `src/hooks/usePlanData.tsx` e `src/types.ts`: **pare** e reporte.

- [ ] **Passo 7: rodar e ver passar**

  Rode: `npm run test:rules`

  Esperado: PASS em todas as células.

- [ ] **Passo 8: atualizar CI, comandos e permissões**

  - **`ci.yml`**, no job `checks`:
    - depois do `setup-node`, `actions/setup-java@v4` com `distribution: temurin` e `java-version: 21`;
    - depois do `typecheck`, os passos `npm test` e `npm run test:rules`, antes do build;
    - trocar o comentário "No lint or tests" por "No lint in this project yet.".
  - **`AGENTS.md`, em Commands:**
    - test, affected only: `npx vitest related --run <files>`;
    - test, full: `npm test && npm run test:rules` (rules need Java 21 and run in the Firestore emulator, project `demo-plan`);
    - disposable local DB: `npm run test:rules` starts and discards the Firestore emulator.
  - **`.claude/settings.json`**, em `allow`: `Bash(npm test *)`, `Bash(npm run test:rules *)`, `Bash(npx vitest *)` e os equivalentes `PowerShell(...)`. Essa edição pede aprovação do usuário. Se for negada, siga e reporte.
  - **`.codex/rules/project.rules`**: `prefix_rule` com `allow` para `["npm","test"]`, `["npm","run","test:rules"]` e `["npx","vitest"]`.

- [ ] **Passo 9: commit**

  ```bash
  git add .github/workflows/ci.yml AGENTS.md .claude/settings.json .codex/rules/project.rules
  git commit -m "ci: testes do app e das regras antes do build"
  ```

---

### Tarefa 3: Regras de admin verificado (parte 3, regras)

**Arquivos:**
- Modificar: `firestore.rules` (`souAdmin`, `match /admins/{email}`, `match /acessos/{uid}` create)
- Criar: `tests/rules/admins.test.ts`, `tests/rules/acessos.test.ts`

**Interfaces:**
- Consome: `criarAmbiente`, `semear` e os tokens da tarefa 2.
- Produz: o campo `emailVerificado` (boolean) aceito no create de `acessos`, quando for igual ao `email_verified` do token. A tarefa 5 grava esse campo.

- [ ] **Passo 1: escrever os testes que falham (tabela da parte 3 + foco 3)**

  Token `ADMIN_NAO_VERIFICADO = { uid: 'uid-admin2', token: { email: 'admin@gi.com', email_verified: false } }`.

  `admins.test.ts`:
  - `list` em `admins` com `LIBERADO` → negado;
  - `LIBERADO` lê `admins/liberado@x.com` (não existe) → permitido;
  - `LIBERADO` lê `admins/admin@gi.com` → negado;
  - token `{ email: 'Admin@GI.com', email_verified: true }` lê `admins/admin@gi.com` → permitido, e faz `update` em `acessos/uid-pendente` → permitido;
  - sem login lê `admins/admin@gi.com` → negado.

  `acessos.test.ts`:
  - `ADMIN` faz `update` de `status` em `acessos/uid-pendente` → permitido;
  - `ADMIN_NAO_VERIFICADO` faz `update` em `acessos/uid-pendente` → negado;
  - `ADMIN_NAO_VERIFICADO` lê `users/uid-admin2` → negado;
  - token `{ email: 'novo@x.com', email_verified: false }` cria o próprio `acessos` com:
    - `emailVerificado: true` → negado;
    - `emailVerificado: false` → permitido;
    - sem o campo → permitido;
    - `status: 'liberado'` → negado.

  Os payloads de create seguem o formato de `obterOuCriarAcesso`: `email` em minúsculas, `nome`, `status: 'pendente'`, `criadoEm`, `liberadoEm: null`, `liberadoPor: null`.

- [ ] **Passo 2: rodar e ver falhar**

  Rode: `npm run test:rules`

  Esperado: FAIL em:
  - `list`;
  - leitura de outro e-mail;
  - `update` do admin não verificado;
  - `users` do admin não verificado;
  - create com `emailVerificado: true` e token falso.

- [ ] **Passo 3: editar `firestore.rules` conforme a parte 3**

  - **`souAdmin()`:** acrescente `&& request.auth.token.email_verified == true`. Acima, o comentário: `// Sem e-mail verificado, quem cria conta com o e-mail de um admin sem conta ganharia o poder.`
  - **`admins/{email}`:** `allow get` só quando `request.auth.token.email.lower() == email`. Sem `list`.
  - **Create de `acessos`:** `!('emailVerificado' in request.resource.data) || request.resource.data.emailVerificado == request.auth.token.email_verified`. Acima, o comentário: `// Campo opcional: o bundle antigo ainda aberto não o envia.`
  - Antes de editar, procure por `admins` em `src` (`grep -rn "COLECAO_ADMINS\|'admins'" src`). Se algum fluxo legítimo listar `admins`: **pare** e reporte.

- [ ] **Passo 4: rodar e ver passar**

  Rode: `npm run test:rules`

  Esperado: PASS em `users`, `admins` e `acessos`.

- [ ] **Passo 5: commit**

  ```bash
  git add firestore.rules tests/rules/admins.test.ts tests/rules/acessos.test.ts
  git commit -m "fix(rules): admin só com e-mail verificado e sem listar admins"
  ```

---

### Tarefa 4: Carga e salvamento seguros (parte 1)

**Arquivos:**
- Modificar: `src/types.ts`, perto das linhas 11-12 e de `PlanContextType`, por volta da 657
- Modificar: `src/hooks/usePlanData.tsx`:
  - estado: ~244;
  - `saveToFirebase`: 246-267, já com o PR #4;
  - efeito de carga: 269-320;
  - salvamento automático: 322-340;
  - `checkSubscription`: ~352;
  - `value`: ~1605.
- Criar: `src/utils/telaDoApp.ts`, `src/utils/telaDoApp.test.ts`, `src/components/ErroAoAbrirPlano.tsx`, `src/hooks/usePlanData.test.tsx`
- Modificar: `src/App.tsx`, no `MainLayout` (78-96)

**Interfaces:**
- Produz, em `types.ts`:
  - `type EstadoDaCarga = 'carregando' | 'carregado' | 'falhou'`;
  - em `PlanContextType`: `estadoDaCarga: EstadoDaCarga` e `tentarCarregarDeNovo: () => Promise<void>`.
- Produz, no hook:
  - `carregarPlano(): Promise<void>` (interna), que substitui o `loadData` e define `estadoDaCarga`;
  - `estadoDaCargaRef`, um espelho em ref, lido por `checkSubscription` e pelo `saveToFirebase`.
- Produz, em `src/utils/telaDoApp.ts`:
  - `type TelaDoApp = 'conferindo' | 'aguardando' | 'expirado' | 'abrindo_plano' | 'erro_ao_abrir' | 'app'`;
  - `telaDoApp(status: SubscriptionStatus, carga: EstadoDaCarga): TelaDoApp`.
- Produz: `ErroAoAbrirPlano: React.FC<{ onTentarDeNovo: () => Promise<void>; onLogout: () => void }>`.
- Consome: `motivoDoErroAoSalvar` do PR #4.

- [ ] **Passo 1: escrever os testes que falham, em `src/utils/telaDoApp.test.ts`**

  - `('loading', *)` → `'conferindo'`;
  - `('not_found', *)` e `('inactive', *)` → `'aguardando'`;
  - `('expired', *)` → `'expirado'`;
  - `('active','carregando')` → `'abrindo_plano'`;
  - `('active','falhou')` → `'erro_ao_abrir'`;
  - `('active','carregado')` → `'app'`.

- [ ] **Passo 2: escrever os testes do hook que falham, em `src/hooks/usePlanData.test.tsx`**

  **Simulação** (com `vi.mock`, no topo do arquivo):
  - `firebase/app`: `initializeApp`, `getApps → []` e `getApp`.
  - `firebase/auth`: `getAuth` devolve sempre o mesmo objeto `authFalso = { currentUser: null }`, criado com `vi.hoisted`. O módulo chama `getAuth` no import, então os testes da tarefa 5 alteram `authFalso.currentUser`, e não o retorno de uma nova chamada. `onAuthStateChanged`, `signOut` e os demais são `vi.fn()`.
  - `firebase/firestore`:
    - `getFirestore → {}`;
    - `doc → (_db, ...p) => p.join('/')`;
    - `getDoc` e `setDoc` são `vi.fn()` controlados por teste;
    - as demais exportações são `vi.fn()`.
  - `../services/acesso`: `ehAdministrador`, `obterOuCriarAcesso`, `listarAcessos` e `definirStatus` são `vi.fn()`. O padrão é cliente liberado: `ehAdministrador → false`, `obterOuCriarAcesso → { status: 'liberado' }`.
  - `../services/geminiService` com automock.

  **Execução:**
  - Renderize com `renderHook(() => usePlan(), { wrapper })`, sendo o wrapper `<PlanProvider user={{ uid: 'u1', email: 'c@x.com', name: 'C', emailVerified: true }}>`.
  - Use `vi.useFakeTimers()`. Esvazie as promessas com `await act(async () => {})`. Avance o tempo com `await act(() => vi.advanceTimersByTimeAsync(3500))`.
  - "Editar" é `act(() => result.current.updateCompanyProfile('name', 'Nova'))`.
  - O documento do banco é `{ exists: () => true, data: () => ({ planData: { companyProfile: { name: 'Empresa Real', cnpj: '', industry: '', geminiApiKey: '' } } }) }`.

  **Testes** (exemplos da parte 1 + focos 1 e 5):
  - `carga negada não grava nada`: `getDoc` rejeita com `permission-denied`; edita; avança 3,5 s. Esperado: `estadoDaCarga === 'falhou'` e `setDoc` não chamado.
  - `tentar de novo carrega e libera a gravação`: `getDoc` rejeita uma vez e depois resolve com o documento; `await act(() => result.current.tentarCarregarDeNovo())`. Esperado:
    - `estadoDaCarga === 'carregado'`;
    - `planData.companyProfile.name === 'Empresa Real'`;
    - depois de editar e avançar 3,5 s, `setDoc` chamado 1 vez.
  - `nova falha ao tentar de novo continua bloqueado e sem laço`: `getDoc` sempre rejeita; chama `tentarCarregarDeNovo`; avança 10 s. Esperado:
    - `getDoc` chamado exatamente 2 vezes;
    - `setDoc` não chamado;
    - `estadoDaCarga === 'falhou'`.
  - `conta nova carrega vazio e a primeira edição grava`: `getDoc → { exists: () => false }`. Esperado: `carregado`; após editar e avançar 3,5 s, `setDoc` chamado 1 vez.
  - `carga ok sem edição não regrava`: documento existe; avança 10 s. Esperado: `setDoc` não chamado e `saveStatus` diferente de `'unsaved'`.
  - `salvar agora com carga falha mostra o motivo`: `getDoc` rejeita; `await expect(result.current.saveDataNow()).rejects.toThrow('O plano ainda não foi carregado')`. Esperado:
    - `saveStatus === 'error'`;
    - `motivoDoErroAoSalvar === 'O plano ainda não foi carregado'`;
    - `setDoc` não chamado.
  - `fechar a aba com edição pendente pede confirmação`: carga ok, edita e dispara `new Event('beforeunload', { cancelable: true })` em `window` antes de 3 s. Esperado: `defaultPrevented === true`.
  - `fechar a aba com erro de gravação pede confirmação`: carga ok, `setDoc` rejeita, edita, avança 3,5 s e dispara `beforeunload`. Esperado: `defaultPrevented === true`.
  - `liberado depois de pendente recarrega o plano`:
    - `obterOuCriarAcesso` devolve `pendente` e depois `liberado`;
    - `getDoc` rejeita e depois resolve;
    - `await act(() => result.current.checkSubscription())`.
    - Esperado: `getDoc` chamado 2 vezes, `estadoDaCarga === 'carregado'` e o nome `'Empresa Real'`.

  O modo local (sem Firebase) não muda e não tem teste aqui: o módulo decide o modo no import, e os testes sempre carregam o modo Firebase.

- [ ] **Passo 3: rodar e ver falhar**

  Rode: `npx vitest run src/utils/telaDoApp.test.ts src/hooks/usePlanData.test.tsx`

  Esperado: FAIL. `telaDoApp`, `estadoDaCarga` e `tentarCarregarDeNovo` ainda não existem.

- [ ] **Passo 4: implementar no hook**

  - **`estadoDaCarga`**: estado iniciado em `'carregando'`, com espelho em `estadoDaCargaRef`. Remova `isInitialLoad`.
  - **`carregarPlano()`**:
    - define `carregando`;
    - lê como hoje;
    - no sucesso, aplica o estado lido e define `carregado` no mesmo tique;
    - em qualquer exceção, define `falhou` e mantém o `console.error`.
  - **`tentarCarregarDeNovo`** = `carregarPlano`.
  - **Efeito de montagem**: roda `carregarPlano()` e `checkSubscription()`, como hoje.
  - **`checkSubscription`**: ao concluir em `active`, chama `carregarPlano()` se `estadoDaCargaRef.current === 'falhou'`. Comentário: `// Pendente → liberado: a primeira carga foi negada pela regra; sem isto o app abriria vazio.`
  - **`saveToFirebase`**: fora de `carregado`, não grava. Define `saveStatus 'error'` e `motivoDoErroAoSalvar 'O plano ainda não foi carregado'`, e rejeita com `new Error('O plano ainda não foi carregado')`.
  - **Salvamento automático**:
    - não roda fora de `carregado`;
    - ignora a primeira execução depois de entrar em `carregado`, usando a ref `acabouDeCarregar` marcada pela carga e `estadoDaCarga` nas dependências;
    - comentário: `// O que acabou de ser lido não é edição; regravar arriscaria sobrescrever o banco com o estado de antes da carga.`
  - **`beforeunload`**: registrado uma vez. Lê `saveStatusRef.current` e avisa em `unsaved`, `saving` e `error`.
  - **`value`**: expõe `estadoDaCarga` e `tentarCarregarDeNovo`.

  Os efeitos derivados (`usePlanData.tsx` ~396 pontuação, ~468 produtividade, ~545 cenários) podem recalcular depois da carga, quando o valor guardado no banco está desatualizado, e gerar uma gravação. Isso é aceitável: grava valores calculados sobre o plano já lido, nunca o estado vazio. O documento do teste `carga ok sem edição não regrava` usa só o perfil, e os demais campos vêm dos valores iniciais, que os efeitos já estabilizaram na montagem; por isso ele não dispara gravação. Se esse teste falhar por causa de um efeito derivado: **pare** e reporte. Não enfraqueça o teste.

- [ ] **Passo 5: implementar `telaDoApp`, `ErroAoAbrirPlano` e o gate do `App`**

  - **`ErroAoAbrirPlano`**: mesmo cartão visual de `AguardandoLiberacao`. Mostra o texto "Não consegui abrir seu plano. Nada foi alterado.", o botão primário "Tentar de novo" (desabilitado e com "Tentando…" enquanto roda) e o botão secundário "Sair". O "Sair" não está na especificação; sem ele, quem está nesta tela não tem como sair.
  - **`MainLayout`**: troque os `if` de `subscriptionStatus` por um `switch (telaDoApp(subscriptionStatus, estadoDaCarga))`:
    - `'conferindo'` → `<LoadingScreen message="Conferindo seu acesso..." />`;
    - `'abrindo_plano'` → `<LoadingScreen message="Abrindo seu plano..." />`;
    - `'erro_ao_abrir'` → `<ErroAoAbrirPlano onTentarDeNovo={tentarCarregarDeNovo} onLogout={onLogout} />`;
    - os demais casos ficam como hoje.

- [ ] **Passo 6: rodar e ver passar**

  Rode: `npx vitest run src/utils/telaDoApp.test.ts src/hooks/usePlanData.test.tsx`

  Esperado: PASS.

- [ ] **Passo 7: commit**

  ```bash
  git add src/types.ts src/hooks/usePlanData.tsx src/hooks/usePlanData.test.tsx src/utils/telaDoApp.ts src/utils/telaDoApp.test.ts src/components/ErroAoAbrirPlano.tsx src/App.tsx
  git commit -m "fix(dados): carga que falhou nunca sobrescreve o plano"
  ```

---

### Tarefa 5: Verificação de e-mail do admin no app (parte 3, app)

**Arquivos:**
- Modificar: `src/types.ts`
  - linha 11: `SubscriptionStatus` ganha `'verificar_email'`;
  - linhas 18-22: `User` ganha `emailVerified: boolean`.
- Modificar: `src/App.tsx`, no `setUser` (141-146) e no `switch` da tarefa 4.
- Modificar: `src/utils/telaDoApp.ts` e seu teste: `('verificar_email', *)` → `'verificar_email'`.
- Modificar: `src/hooks/usePlanData.tsx`, em `authService` (~53-100) e `checkSubscription`.
- Modificar: `src/services/acesso.ts`
- Criar: `src/services/acesso.test.ts`
- Criar: `src/components/VerificarEmailAdmin.tsx`
- Modificar: `src/components/GestaoDeAcessos.tsx` (tabela)
- Teste: `src/hooks/usePlanData.test.tsx`

**Interfaces:**
- Consome: a tela `'verificar_email'` em `TelaDoApp` e o switch do `MainLayout` da tarefa 4; o campo `emailVerificado` aceito pela regra da tarefa 3.
- Produz:
  - `authService.enviarVerificacaoDeEmail(): Promise<void>`, que chama `sendEmailVerification(auth.currentUser)`. No modo local, não faz nada.
  - `authService.recarregarUsuario(): Promise<void>`, que faz `await auth.currentUser.reload()` e depois `await auth.currentUser.getIdToken(true)`.
  - `obterOuCriarAcesso(db, uid, email, nome, emailVerificado: boolean): Promise<Acesso>`, que grava `emailVerificado` no create.
  - `Acesso.emailVerificado?: boolean`.
  - `rotuloEmailVerificado(v: boolean | undefined): 'Sim' | 'Não' | '—'`.
  - `VerificarEmailAdmin: React.FC<{ onLogout: () => void }>`.

- [ ] **Passo 1: escrever os testes que falham**

  `src/services/acesso.test.ts`, com `firebase/firestore` simulado:
  - `obterOuCriarAcesso(db,'u','A@x.com','A', false)` sem documento. Esperado: `setDoc` recebe um objeto com `emailVerificado: false`, `status: 'pendente'` e `email: 'a@x.com'`.
  - `rotuloEmailVerificado`: `true → 'Sim'`, `false → 'Não'`, `undefined → '—'`.

  No `usePlanData.test.tsx`, use `ehAdministrador → true`:
  - `admin sem e-mail verificado vai para a verificação`:
    - `authFalso.currentUser = { emailVerified: false }`;
    - esperado: `subscriptionStatus === 'verificar_email'`, `souAdmin === false` e `obterOuCriarAcesso` não chamado.
  - `admin verificado entra direto`:
    - `currentUser.emailVerified = true`;
    - esperado: `'active'` e `souAdmin === true`.
  - `Já verifiquei sem ter verificado continua na verificação`:
    - `emailVerified` continua `false`;
    - chamar `checkSubscription` de novo;
    - esperado: `'verificar_email'`.
  - `cliente grava emailVerificado no pedido`:
    - `ehAdministrador → false`;
    - esperado: `obterOuCriarAcesso` chamado com o 5º argumento `true`, vindo do `user` do wrapper.

- [ ] **Passo 2: rodar e ver falhar**

  Rode: `npx vitest run src/services/acesso.test.ts src/hooks/usePlanData.test.tsx src/utils/telaDoApp.test.ts`

  Esperado: FAIL.

- [ ] **Passo 3: implementar**

  - **`App.tsx`**: `emailVerified: !!firebaseUser.emailVerified` no `setUser`; `case 'verificar_email'` → `<VerificarEmailAdmin onLogout={onLogout} />`.
  - **`checkSubscription`**:
    - `const verificado = auth?.currentUser ? auth.currentUser.emailVerified : user.emailVerified`, com o comentário `// reload() não dispara onAuthStateChanged: o user do App fica com o valor antigo.`;
    - admin e não verificado: `setSouAdmin(false)`, `setStatusAcesso(null)`, `setSubscriptionStatus('verificar_email')` e retorna;
    - cliente: passa `verificado` para `obterOuCriarAcesso`;
    - no modo local, nada muda.
  - **`VerificarEmailAdmin`**: mesmo cartão visual de `AguardandoLiberacao`.
    - Texto: "Seu e-mail é de administrador, mas ainda não foi verificado." e o e-mail da pessoa.
    - **"Enviar e-mail de verificação"**:
      - sucesso → "Enviamos o link para {email}. Abra o link e clique em Já verifiquei.";
      - erro → "Não consegui enviar agora. Tente de novo em alguns minutos.".
    - **"Já verifiquei"**: `await authService.recarregarUsuario()` e depois `await checkSubscription()`. Se continuar `verificar_email` → "Ainda não aparece como verificado. Abra o link do e-mail e tente de novo.".
    - **"Sair"**: chama `onLogout`.
    - Os botões ficam desabilitados enquanto a ação roda.
  - **`GestaoDeAcessos`**: coluna "E-mail verificado" entre "Cadastrou" e "Situação", com `rotuloEmailVerificado(a.emailVerificado)`.

- [ ] **Passo 4: rodar e ver passar**

  Rode o mesmo comando do passo 2. Esperado: PASS.

- [ ] **Passo 5: commit**

  ```bash
  git add src/types.ts src/App.tsx src/utils/telaDoApp.ts src/utils/telaDoApp.test.ts src/hooks/usePlanData.tsx src/hooks/usePlanData.test.tsx src/services/acesso.ts src/services/acesso.test.ts src/components/VerificarEmailAdmin.tsx src/components/GestaoDeAcessos.tsx
  git commit -m "feat(acesso): admin com senha verifica o e-mail antes de entrar"
  ```

---

### Tarefa 6: A chave do Gemini não passa de um usuário para outro (parte 5)

**Arquivos:**
- Modificar: `src/hooks/usePlanData.tsx`, em `authService.logout` (~84) e em `carregarPlano`, onde ficavam as linhas 302-305
- Modificar: `src/components/Settings.tsx:21-28`, removendo o `useEffect` da migração
- Modificar: `src/services/geminiService.ts:726`
- Testes: `src/hooks/usePlanData.test.tsx`, `src/services/geminiService.test.ts` (criar), `src/components/Settings.test.tsx` (criar)

**Interfaces:**
- Consome: `carregarPlano` da tarefa 4.
- Produz: nenhum nome novo.

- [ ] **Passo 1: escrever os testes que falham**

  No `usePlanData.test.tsx` (exemplos da parte 5 + foco 2):
  - `logout apaga a chave`: `localStorage` com `kA`; `await authService.logout()`. Esperado: `getItem('google_gemini_api_key') === null`.
  - `logout apaga a chave mesmo se signOut falhar`: `signOut` rejeita; `await authService.logout().catch(() => {})`. Esperado: chave `null`.
  - `B sem chave no plano remove a chave de A`: `localStorage` com `kA`; documento sem chave. Esperado: chave `null` depois da carga.
  - `B com chave kB grava kB`: documento com `geminiApiKey: 'kB'`. Esperado: `getItem` → `'kB'`.
  - `carga negada também remove a chave de A`: `localStorage` com `kA`; `getDoc` rejeita. Esperado: chave `null`.

  Em `src/services/geminiService.test.ts`:
  - Simule `@google/genai`, capturando o argumento de `generateContent`. Siga o formato que `generateComprehensiveStrategicAnalysis` lê da resposta.
  - Chame a função com `companyProfile: { name: 'Empresa X', ..., geminiApiKey: 'kA-segredo' }` e `localStorage` com uma chave qualquer, para `getAI` funcionar.
  - Esperado: o prompt serializado não contém `'kA-segredo'` e contém `'Empresa X'`.

  Em `src/components/Settings.test.tsx`:
  - Simule `../hooks/usePlanData` com um `usePlan` falso. Ele fornece o mínimo que `Settings` lê, com `companyProfile.geminiApiKey: ''` e `updateCompanyProfile: vi.fn()`.
  - Use `localStorage` com `kA` e renderize `<Settings />`.
  - Esperado: `updateCompanyProfile` nunca chamado com `'geminiApiKey'`, e o `localStorage` mantém `kA`. Remover essa chave é papel da carga, não das Configurações.

- [ ] **Passo 2: rodar e ver falhar**

  Rode: `npx vitest run src/hooks/usePlanData.test.tsx src/services/geminiService.test.ts src/components/Settings.test.tsx`

  Esperado: FAIL.

- [ ] **Passo 3: implementar**

  - **`logout`**: `localStorage.removeItem('google_gemini_api_key')` como **primeira** linha, valendo para os dois modos. Comentário: `// O próximo usuário deste navegador não pode herdar a chave de quem saiu.`
  - **`carregarPlano`**: remove a chave no início. Depois de uma leitura bem-sucedida, grava a chave do plano, se houver. Comentário: `// O navegador só guarda a chave de quem acabou de entrar.`
  - **`Settings.tsx`**: remova o `useEffect` da migração (linhas 21-28). O `handleSaveKey` não muda.
  - **`geminiService.ts:726`**: serializa o perfil sem `geminiApiKey`, com `const { geminiApiKey: _semChave, ...perfilParaPrompt } = planData.companyProfile`.

- [ ] **Passo 4: rodar e ver passar**

  Rode o mesmo comando do passo 2. Esperado: PASS.

- [ ] **Passo 5: commit**

  ```bash
  git add src/hooks/usePlanData.tsx src/hooks/usePlanData.test.tsx src/components/Settings.tsx src/components/Settings.test.tsx src/services/geminiService.ts src/services/geminiService.test.ts
  git commit -m "fix(gemini): chave sai no logout, na troca de usuário e do prompt"
  ```

---

## Condições de parada (copiadas da especificação)

- **`npm audit --audit-level=high` falha por uma dependência nova:** parar e trazer as opções.
- **Algum fluxo legítimo depende de listar `admins`, ou de admin sem e-mail verificado:** parar e reportar.
- **O emulador não sobe:** parar e reportar. Não pular os testes de regra.
- **A mesclagem do PR #4 conflita fora de `usePlanData.tsx` e `types.ts`:** parar e reportar.
- **Novas neste plano:**
  - um teste do hook só passa com mudança fora dos arquivos listados na tarefa → parar e reportar;
  - `carga ok sem edição não regrava` falha por causa de um efeito derivado → parar e reportar;
  - simular `Settings` exige reescrever o componente → parar e reportar.

## Passos humanos (depois do merge na `main`, nesta ordem)

1. Deploy do app na Vercel, **antes** das regras.
2. `firebase deploy --only firestore:rules --project plan-ea4cc`.
3. Conferir se `VITE_API_KEY` está na Vercel e, se estiver, remover.
4. Ligar a proteção contra enumeração de e-mail no Firebase Auth.
5. Tirar de `admins` os e-mails sem conta.
6. Cada admin que entra com senha verifica o e-mail pela nova tela.

Nenhum deles é feito pelo implementador.
