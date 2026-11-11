# AGENTS.md

Operating contract for coding agents (Claude Code and Codex) in this repository.
Always reply to the user in Brazilian Portuguese. Write plans, specs and log entries in Portuguese;
code, identifiers and commit messages follow the project's conventions.

<!-- project:start — filled by /onboard; preserved on pack updates -->
## Project

- **What:** PLAN 2026 (Gestão de Impacto): SPA where business owners build their 2026 strategic,
  commercial and financial plan; admins approve sign-ups and manage access.
- **Stack:** React 19 + Vite 7 + TypeScript 5.9 + Tailwind CSS 4; Firebase Auth + Firestore
  (project `plan-ea4cc`); Gemini (`@google/genai`); DPE import from an external Supabase.
- **Commands** (verified by `/onboard`, npm — `pnpm-lock.yaml` is stale, ignore it):
  - install: `npm ci`
  - lint: _none_
  - typecheck: `npm run typecheck`
  - test, affected only: `npx vitest related --run <files>`
  - test, full: `npm test && npm run test:rules` (rules: Java 21, Firestore emulator, `demo-plan`)
  - build: `npm run build` (typecheck + `vite build`)
  - audit: `npm audit --audit-level=high` (passes at high; 13 moderate remain, from the `firebase-tools` devDependency)
  - disposable local DB: `npm run test:rules` starts and discards the Firestore emulator
  - local app with fake login (dev only, project `demo-plan`): `npm run emuladores`, then
    `npm run emuladores:semear` (accounts in `scripts/semear-emuladores.mjs`), then `npm run dev:local`
- **Sensitive paths** (a diff touching them triggers the security review): `firestore.rules`,
  `firebase.json`, `.firebaserc`, `.env.example`, `src/App.tsx`, `src/hooks/usePlanData.tsx`,
  `src/services/**`, `src/components/Login.tsx`, `src/components/GestaoDeAcessos.tsx`,
  `src/components/AguardandoLiberacao.tsx`, `src/components/SubscriptionExpiredPage.tsx`
- **Human-only steps** (agents stop and ask): setting secrets · writing production data ·
  pulling production env · merging to `main` · publishing Firestore rules
  (`firebase deploy --only firestore:rules`) · approving or blocking users in production
- **Deploy:** Vercel, `https://plan2026.gestaoimpacto.com`, by Leonardo via `vercel` CLI (Git→Vercel link broken;
  `wbicca-5368` can't see it); rules apart, `firebase deploy --only firestore:rules`. No migrations.
- **Notes:** read by range, never whole: `src/hooks/usePlanData.tsx`,
  `src/components/CommercialPlanning.tsx`, `src/services/geminiService.ts`. The Firebase web
  config fallbacks in `usePlanData.tsx` and the DPE anon key are public client keys, not secrets;
  access control lives in `firestore.rules`. `origin` is `leonardollo/plan26`.
<!-- project:end -->

## Triage — pick the level before acting

| Level | Trigger | Flow |
|---|---|---|
| Trivial | copy, config, docs, typo | Just do it, in this session. |
| Normal | clear scope, no sensitive path | Implement here → affected tests → `/ship`. |
| Structural | new product or module, data migration, architecture change, 3+ independent parts | `brainstorming` → `writing-plans` → **explicit human approval** → implementer subagent runs `executing-plans` → `/ship`. |
| Sensitive (adds to any level) | sensitive path, auth, authorization, tenant isolation/RLS, payments, secrets, PII, bulk or destructive operations, migrations on production data | Base flow + a security review of the branch, alongside the base review. Never skipped. |

Unsure between two levels? Take the higher one and say so in one line.

## Rules

- **Ask, don't assume.** Ambiguous intent or requirement → ask before implementing.
- **Business rules need examples.** Dates, money, aggregates, permissions: write concrete
  examples with edge cases (partial periods, empty sets, legacy rows) and turn them into tests.
- **Surgical changes.** Touch only what the task needs; remove what your change orphaned.
- **Evidence, not claims.** "Done" requires the real output of the project commands on the
  current state. A report (yours or an agent's) is never proof.
- **Regression tests count only after you saw them fail** without the fix.
- **Verify like a user.** UI: check changed screens on mobile (touch) and desktop. Behavior that
  differs in production builds (prefetch, caching, env): check a production build or preview.
- **Recurring findings become checks.** If a review finding could happen again, add a test or
  lint rule in the same delivery.
- **Why-comments.** A decision that constrains code gets a one-line comment where it applies.
- **Secrets.** Never read, print or commit real `.env` values. Stop at human-only steps.
- **Quiet commands.** Summary reporters and `tail` on long output. Search first, then read large
  files by line range; don't re-read what is already in context.
- **Deploy only what is in `main`.** A deploy request on another branch → ask for the merge first.
- **No-prompt commands.** One plain command per call, from the repo root: no `cd` prefix, no `$?`
  or `${...}`; edit with the edit tool, not `sed -i`.

## Delegation and state

- This session implements Trivial and Normal work itself, then runs `/ship`. Subagents only where
  they pay off: an approved plan, 2+ parallel parts, and large reads (a read-only search subagent).
- An approved plan → one implementer subagent runs `executing-plans` on the delivery branch you
  create. Announce it in one line as you dispatch; relay its questions at once; fixes go back to it.
- **As a subagent:** do the brief yourself, never delegate it again, never run `/ship` or merge.
  Commit on the branch, run the affected tests, report in ≤ 10 lines (files, commits, test result,
  decisions, open questions). At a stop condition or ambiguity, return the question.
- State lives in files: specs and plans in `docs/superpowers/`, deliveries in `docs/LOG.md`.
  After a compaction or in a new session, read the current plan and the last log entries.
- Plans include: examples with edge cases · stop conditions ("if a legitimate flow depends on
  this, stop and report") · human-only steps, approved before execution starts. No final
  full-verification task: `/ship` runs it.

## Review — the implementer never reviews

| Level | Review, run by `/ship` |
|---|---|
| Trivial | none (pre-commit + CI) |
| Normal | the branch |
| Structural | the branch, against the plan's risks |
| Sensitive | also the branch with `docs/SECURITY.md`, alongside the base review |

- The reviewer runs in a fresh process: the other model when available (Codex reviews Claude's
  work and vice versa), otherwise the same model, at once. Never wait or stop for the other model.
- The reviewer never edits. Each finding is fixed by the implementer or rejected with a reason (logged).
  At most one re-review, of the delta only, and only after fixing a blocker.

## Parallel work

- Only for 2+ parts with disjoint files, on a stable base.
- One worktree per part; consolidate by merge; `/ship` removes merged worktrees and branches.
  Sequential work, plans included, runs on a branch in the main checkout, without a worktree.
- JS projects need an install and build per worktree — parallelize only when the gain is clear.

## Closing

Run `/ship` yourself once a non-trivial delivery is implemented; never ask the user to type it. It
runs full verification once, the level's review, triage, the log entry, cleanup and the PR offer.
