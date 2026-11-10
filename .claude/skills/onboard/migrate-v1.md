# Migrating from Starter Pack v1

Read by `/onboard` when the project has v1 files (github.com/wbicca/Starter-Pack). Order: carry
over, list, confirm, remove, restore the pack. Then continue with `/onboard` step 2.

## 1. Carry over

- `docs/STACK.md` → input for the Project section: the resolved stack, the commands (run them again
  in step 2; v1's CONFIGURED status is not evidence), sensitive paths (rewritten as git globs), the
  isolation unit, what is explicitly out of scope, and the visual language in one line. Profile,
  status, agents, planning track, gates and remote-execution policy don't carry over.
- `AGENTS.md`, `CLAUDE.md`, `CODEX.md`: only what is about this project (domain, conventions,
  gotchas). v1's process rules don't carry over.
- `.claude/settings.json`: project-specific `allow` rules survive; `hooks`, v1's plugin entries and
  its `defaultMode` give way to the pack's file.
- Project docs from v1's onboarding (`PROJECT_BRIEF`, `ARCHITECTURE`, `API_CONTRACTS`, `DATABASE`,
  `DEPLOYMENT`, `TESTING`, `SECURITY_CONTRACT` under `docs/`) belong to the project and stay. Take
  what the Project section needs (deploy check, production URL, test database), and link
  `SECURITY_CONTRACT.md` from it when it records project decisions. One that is still an unfilled
  template goes on the removal list.

## 2. List what goes

Show the paths that exist here, grouped, and wait for an explicit yes:
- Agent hooks and agents: `.claude/hooks/`, `.claude/agents/`, and v1's `.codex/` (hooks, agents,
  config; the pack's `.codex/rules/` comes back in step 4).
- Rules: `.claude/rules/`.
- Skills, in both `.claude/skills/` and `.agents/skills/`: every `bmad-*`, plus v1's `brainstorming`,
  `dispatching-parallel-agents`, `executing-plans`, `finishing-a-development-branch`, `impress-gate`,
  `project-onboarding`, `quality-gate`, `receiving-code-review`, `refactor-pass`, `release-sanity`,
  `requesting-code-review`, `skill-discovery`, `starter-feedback`, `subagent-driven-development`,
  `systematic-debugging`, `test-driven-development`, `using-git-worktrees`, `using-superpowers`,
  `verification-before-completion`, `writing-plans`, `writing-skills`. Pack skills with the same
  name come back in step 4. Any other skill is the project's: keep it and mention it.
- BMAD: `_bmad/`, and `_bmad-output/` when it holds nothing but `.gitkeep` files.
- Scripts: `scripts/quality/`, and package scripts that call it.
- Root files: `CODEX.md`, `USAGE.md`, `VERSION`, `.starter-template-state.json`; `README.md`,
  `CHANGELOG.md` and `NOTICE.md` only when they are the Starter Pack's own (their first lines say
  so). A `NOTICE.md` that also carries the app's attributions (licenses of copied code, original
  assets) keeps those sections; only the v1 part goes. Without a README of its own, offer to write
  a short one for the project.
- v1 docs under `docs/`: `AUDIT_EVIDENCE.md`, `CONSTITUTION.md`, `DESIGN_STANDARDS.md`,
  `ENGINEERING_STANDARDS.md`, `QUALITY_GATES.md`, `RUNTIME_COMPATIBILITY.md`,
  `SCALABILITY_CHECKLIST.md`, `SECURITY_BASELINE.md`, `STACK.md`, `STARTER_FEEDBACK.md`,
  `TEMPLATE_UPDATES.md`, and `security/audit-receipts.jsonl`.
- CI: workflows that run `scripts/quality/` (v1's `ci.yml` is one). The pack's `ci.yml` replaces
  them; other workflows stay.
- Local state: `.claude/.audit-log.jsonl`, `.claude/.governance-log.jsonl`,
  `.claude/.quick-check-baseline.json`, and v1's lines in `.gitignore`.
- Worktrees: `git worktree list`. Offer to remove those whose branch is merged
  (`git worktree remove`, then `git branch -d`), and those whose commits all reached HEAD by
  cherry-pick (`git cherry HEAD <branch>` prints no `+` line; their branch needs `-D`, under the
  same yes). Keep the ones with unique commits or uncommitted changes, and say why. A worktree
  locked by a running agent session stays: name the session. Never force. Stop the dev servers
  running inside a worktree first.

Stays as history: `docs/DELIVERY_LOG.md`, `docs/DECISIONS.md`, `docs/superpowers/`, other specs and
plans, and `_bmad-output/` when it has content.

## 3. Remove

Tracked files with `git rm -r`, so they stay recoverable from history; untracked ones only under the
same yes. If `.claude/settings.local.json` has hooks that point at removed files, tell the user:
that file is theirs.

## 4. Restore the pack

Copy `template/` from the clone again without overwriting (`cp -Rn <clone>/template/. .`, or
`robocopy <clone>\template . /E /XC /XN /XO`): the removed skills and CI come back as the pack's.
Put the pack's `AGENTS.md`, `CLAUDE.md` and `.claude/settings.json` in place with what step 1
carried over. Below the header of `docs/LOG.md`, add the line
`Histórico do v1: docs/DELIVERY_LOG.md e docs/DECISIONS.md (somente leitura).`
