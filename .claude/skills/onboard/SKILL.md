---
name: onboard
description: Set up this project for the Starter Pack - detect the stack, run the real commands, fill the Project section of AGENTS.md, enable the pre-commit, fill CI and permissions, and migrate from Starter Pack v1. Safe to rerun.
disable-model-invocation: true
---

# /onboard

Makes every fact in AGENTS.md → Project true for this repository, and every command there one that
ran here. Safe to rerun: later runs change only what is out of date. Nothing is deleted without the
user's explicit yes. Never open real `.env` files; variable names come from `.env.example`.

## 1. Survey (read-only)

- `git status`. Not a repository → `git init -b main` (ask first if they want another branch name).
- Stack signals: manifests and lockfiles (`package.json` and its lockfile, `pyproject.toml`,
  `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`), task runners (`Makefile`, `justfile`), the
  current CI, Docker/compose, database tooling (`supabase/`, `prisma/`, `drizzle.config.*`,
  migrations) and hosting config (`vercel.json`, `netlify.toml`, `fly.toml`).
- Pack files the copy skipped because the project already had one: an `AGENTS.md` without
  `<!-- project:start`, a `CLAUDE.md` that doesn't start with `@AGENTS.md`, a `.claude/settings.json`
  with `hooks`, a `.github/workflows/ci.yml` that isn't the pack's. Get the pack's version from a
  fresh clone (`git clone --depth 1 https://github.com/wbicca/vibecoderpack.git` into a temp dir,
  files under `template/`), never from memory.
- Starter Pack v1 present (`CODEX.md`, `_bmad/`, `scripts/quality/`, `docs/STACK.md`,
  `.claude/hooks/`) → follow [migrate-v1.md](migrate-v1.md) first, then come back to step 2.

Tell the user what you found in a few lines before changing anything.

## 2. Commands: run, then record

For install, lint, typecheck, affected tests, full tests, build and, when there is a database, the
disposable local DB:
- Prefer what the project defines (package scripts, Makefile targets, current CI) over tool
  defaults, and the package manager of the lockfile.
- Run each one. Passes → record it. Fails on problems that already exist, or on a missing tool such
  as Docker → record it as `<cmd> (fails today: <reason>)` and tell the user; onboarding doesn't fix
  product code.
- Doesn't exist → `_none_`. Don't add tooling unless the user asks.
- An install that recreates the dependency folder (`npm ci`) deletes it first: stop the project's
  running dev servers before it, or ask. On Windows a running one locks its binaries (`EPERM`) and
  leaves the folder half deleted.
- Affected tests use the runner's related-files mode (`vitest related --run <files>`,
  `jest --findRelatedTests <files>`, `pytest <paths>`).
- Prefer quiet flags and summary reporters, so agents keep their context small.

## 3. Project section

An `AGENTS.md` or `CLAUDE.md` that isn't the pack's: start from the pack's files and carry over the
old ones' project facts (commands, conventions, domain terms, gotchas); drop process rules the pack
already covers and show the user what was dropped.

Edit AGENTS.md only between `<!-- project:start` and `<!-- project:end -->`, in English like the rest
of the file. Facts, not prose. AGENTS.md and CLAUDE.md together stay within 120 lines (~2.5k tokens,
loaded on every call); anything longer goes in a doc linked here.

- **What / Stack:** the product and its users in one line; the stack as the manifests show it.
- **Commands:** from step 2.
- **Disposable local DB:** a local instance built from the migrations (`supabase start` then
  `supabase db reset`, a compose service, testcontainers) and the command that creates or resets it.
  Integration tests run against it, never against a shared or production database. Local
  connection strings only; list the variables the user must set.
- **Sensitive paths:** git glob pathspecs, relative and without a leading `/`, for auth,
  authorization, tenant scoping/RLS, payments, secrets and config, PII, bulk or destructive
  operations, migrations, webhooks and admin areas, e.g. `src/auth/**`, `**/middleware.ts`,
  `supabase/migrations/**`. Propose them from the tree; the user confirms. `/ship` matches diffs
  against them mechanically, so a missing path is a skipped security review. Each must match files:
  `git ls-files -- ':(glob)<glob>'`.
- **Human-only steps:** keep the defaults and add the project's own (applying production migrations,
  pulling production env, promoting a deploy).
- **Deploy:** how to see that the deploy of a given commit finished (`vercel ls`, `gh run list`),
  how to check that production migrations are applied, and the production URL. `/ship release`
  runs exactly this.
- **Notes,** only when needed: the tenant or isolation unit every query must carry, files over 1,000
  lines (read by range, never whole), and facts agents keep getting wrong. One line each.

## 4. Git hooks and ignores

- `git config core.hooksPath .githooks`. Already using husky, lefthook or pre-commit? Don't replace
  it silently: move its checks into the block below, or call one hook from the other; ask which.
- `.gitattributes` has `.githooks/* text eol=lf`, `*.sh text eol=lf` and
  `**/skills/*/scripts/* text eol=lf` (append what is missing): with CRLF these scripts break in Git
  Bash. Files already checked out with CRLF: `git add --renormalize .githooks .claude .agents`.
- `git add --chmod=+x` on `.githooks/pre-commit` and on the skills' scripts (`*.sh` and
  `executing-plans/scripts/*`, in `.claude/skills` and `.agents/skills`), so they run on macOS and
  Linux clones.
- Fill the block between `# >>> project checks` and `# <<< project checks`: format and lint in check
  mode, on staged files only (the hook's `$staged`), in seconds; never rewrite files from the hook.
  Reuse lint-staged or pre-commit if the project has them. For JS/TS with Prettier and ESLint:

      files=$(printf '%s\n' "$staged" | grep -E '\.(js|jsx|ts|tsx|mjs|cjs)$' || true)
      if [ -n "$files" ]; then
        printf '%s\n' "$files" | tr '\n' '\0' | xargs -0 npx --no-install prettier --check --end-of-line auto || exit 1
        printf '%s\n' "$files" | tr '\n' '\0' | xargs -0 npx --no-install eslint --no-warn-ignored || exit 1
      fi

  `--end-of-line auto`: Windows clones check out CRLF, Prettier expects LF, git stores LF anyway.
  `--no-warn-ignored` (ESLint 9) silences "file ignored" for skipped files such as skill scripts.
  Add `--max-warnings=0` only when the lint has no warnings today.

- `.gitignore` has `.env*`, `!.env.example` and `.superpowers/` (plan ledgers, brainstorm mockups).
  Narrower env patterns once let 55 production variables into git.
- No `gitleaks` on this machine → tell the user how to install it (`winget install gitleaks`,
  `brew install gitleaks`). CI runs it anyway.

## 5. CI

In `.github/workflows/ci.yml`, replace the "Not configured" step between the `project checks`
markers with: runtime setup at the project's version, install from the lockfile (`npm ci`,
`pnpm install --frozen-lockfile`, `uv sync --locked`), lint, typecheck, full tests, build, and the
stack's dependency audit (`npm audit --audit-level=high`, `pip-audit`). With a database, add a
service container for the disposable DB and run the migrations before the tests. No production
secrets in CI. CI has no local `.env`: the build-time public variables it reads (`VITE_*`,
`NEXT_PUBLIC_*` from `.env.example`) get placeholder values in the step's `env`, or every run fails.
Keep the `secrets` and `skills-mirror` jobs as they are; a project CI that isn't the pack's keeps its
checks and gains those two jobs.

## 6. Permissions

Add each verified project command, and the format and lint commands the pre-commit runs (check and
write), to `permissions.allow` in `.claude/settings.json` as `Bash(<cmd> *)` and `PowerShell(<cmd> *)`:
the trailing ` *` also matches the bare command and lets agents add flags and file paths. Never wider
than one command (`Bash(npm *)`, `Bash(npx *)`). Keep the pack's `ask` and `deny` entries.

The pack's `deny` only knows the usual env names. Add `Read(**/<name>)` for every real secret file
the project keeps on disk under another name (`.env.credenciais`, `.env.vercel`, `SENHA-*.txt`):
list the ignored files (`git status --ignored --short`) and pick the ones that hold credentials.
Never deny `.env.example`, which `/onboard` itself reads.

Add the project's production commands to `permissions.ask`, from Human-only steps and Deploy:
deploys (`vercel --prod`, `git push origin main` when a push deploys), anything applied to a remote
database or function (`supabase db push`, `supabase functions deploy`), and MCP tools that write to
production (`mcp__supabase__execute_sql`, `mcp__supabase__apply_migration`). Ask beats allow in every
settings file and in auto mode; tell the user which local allow rules it now overrides. The edit
needs the user's approval in the prompt: Claude Code protects `.claude/`.

Codex gets the same in `.codex/rules/project.rules`: each verified command as
`prefix_rule(pattern = ["npm", "test"], decision = "allow")` (runs outside the sandbox, which
blocks `.git` writes, local databases and network), each production command with
`decision = "prompt"`. Check them with `codex execpolicy check -r .codex/rules/project.rules <cmd>`.
Codex loads project rules once the user trusts the project there.

## 7. Report and commit

Show the user each command with its real result, the sensitive globs with the files they match, the
human-only steps, the files changed, and what only they can do (install gitleaks, set secrets, branch
protection, link the deploy). With their yes, commit `chore: onboard Starter Pack v2` on a branch,
or on the base branch if this is the repository's first commit.
