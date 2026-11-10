---
name: ship
description: Use as soon as a Normal, Structural or Sensitive delivery is implemented, without waiting to be asked - closes it with a commit on a branch, the review for its risk level (by the other model when available), full verification, finding triage, the docs/LOG.md entry, worktree cleanup, then offers push or PR. Not for Trivial changes. With the argument release, check the deploy after the human merged.
argument-hint: "[release]"
---

# /ship

Closes one delivery. The main session runs it as soon as the delivery is implemented, by itself or
by its implementer subagent, without waiting for the user (who may also type it); an implementer
subagent never runs it. A fresh process reviews
the delivery, the other model when available. With the argument `release`, go straight to
**Release check**.

## 1. Scope

- **Base branch:** `git symbolic-ref --short refs/remotes/origin/HEAD` minus `origin/`; when that
  fails, `main` (or `master`).
- **Branch:** on the base branch, create one first: `git switch -c <type>/<short-slug>`. Committing
  to the base branch is merging into it, and that is a human-only step.
- **Level:** the one picked at triage. Unknown → Structural if this branch carries out a plan in
  `docs/superpowers/plans/`, otherwise Normal. Structural with no approved plan → stop and ask.
- Leave unrelated changes out of the delivery; ask when unsure what belongs.

## 2. Commit, then check for Sensitive

Stage the delivery's files by name (never `.env*`, logs or build output) and commit with the
project's message convention; skip this if the work is already committed. The pre-commit runs: fix
what it reports, never `--no-verify`. Committing first gives the reviewer a fixed target.

Sensitive is mechanical. With the globs from AGENTS.md → Project → Sensitive paths:

    git diff --name-only <base>...HEAD -- ':(glob)<glob-1>' ':(glob)<glob-2>'

Any file listed → Sensitive, whatever the triage said; the triage can add Sensitive, never remove
it. No globs yet (`/onboard` hasn't run) → say so and rely on the triage.
New entry points are Sensitive too, wherever they live: check each file that
`git diff --name-only --diff-filter=A <base>...HEAD` lists, and any new route, API handler, server
action, migration or serverless function → Sensitive. The globs only know the folders that existed.
Trivial (copy, config, docs) and not Sensitive → stop here: pre-commit and CI are its checks.

## 3. Start the review

Reviewer: the other model when it is available (Codex in Claude Code, Claude in Codex); otherwise
the same model in a fresh process, at once. Never wait for the other model, retry it or ask the
user to run it.
- Unavailable: `codex login status` fails, or the review exits non-zero or prints nothing (login,
  quota, outage). Don't rerun it to see why; log the exit code.
- No reviewer can run at all → go on and put it under Em aberto; when the level is Sensitive, say
  so first in the hand-off. The user decides at merge.

Reviews take minutes. In Claude Code, start step 4's verification with `run_in_background` first,
then run the review in the foreground with the Bash timeout at its maximum (600000 ms). In Codex
allow up to 20 minutes. Pipe prompts through stdin (Git Bash turns a leading `/code-review` argument
into a Windows path) and keep each on one line, without quotes, backticks or `$`.

- **Normal:** `codex review --base <base> 2>/dev/null`, or for Claude
  `echo "/code-review high <base>...HEAD" | claude -p --disallowedTools "Edit,Write,NotebookEdit"`.
- **Structural:** the plan prompt, as `echo "<plan prompt>" | codex review - 2>/dev/null`, or for
  Claude `echo "<plan prompt>" | claude -p --disallowedTools "Edit,Write,NotebookEdit"`.
- **Sensitive:** the base review and the security prompt at the same time, on the same commit; it
  is never skipped. In Claude Code, start the security review with `run_in_background` too, before
  the base review in the foreground; in Codex, a subagent runs it and returns its output verbatim.
  With neither, run them one after the other. Triage waits for both: never end the turn while a
  review runs, and if the background one is still going, wait on its output in the foreground.

> **Plan prompt:** Adversarial review of git diff <base>...HEAD against the plan in <plan path>.
> Check that every task and every edge-case example is implemented and covered by a test, that the
> stop conditions and human-only steps were respected, and that nothing outside the plan changed.
> Look for failure modes the plan did not consider. Report findings as blocker, should-fix or nit,
> with file:line. Do not edit files.

> **Security prompt:** Security review of git diff <base>...HEAD against docs/SECURITY.md. Check every
> item that applies to the changed code and to the code it relies on. For each finding give
> severity, file:line, the concrete attack vector (request, payload, another tenant id) and how to
> prove it. Then list what you did not check. Do not edit files.

- Codex prints its findings on stdout and its progress on stderr. `--base` takes no prompt: a
  custom prompt goes through stdin as `codex review -`, without `--base`. The tool already reports
  the exit code; don't append `echo $?`.
- In Codex, `claude -p` and `codex review` need the network: the pack's `.codex/rules` allow them.

## 4. While the review runs

Don't edit files the reviewer is reading.
- **Verify** with the Project commands: lint, typecheck, full test suite, build, plus integration
  tests against the disposable local DB when the project has one. Record the real result lines
  (`Tests 412 passed`, `build ok`). A red command is a blocker: fix it together with the findings.
  A report, yours or an agent's, is not evidence. A test that fails in the suite and passes when
  its file runs alone is flaky: rerun the suite once; still red → name the test under Em aberto.
  No more rounds.
- **Verify like a user:** changed screens on mobile (touch) and desktop, with a screenshot when the
  change is visual; production-only behavior (prefetch, caching, env) on a production build or
  preview. If that can't happen now, it goes under Em aberto.
- **Clean worktrees:** each linked worktree whose branch is merged into HEAD →
  `git worktree remove <path>`, then `git branch -d <branch>`. Never force; report the ones that refuse.
- **Draft** the log entry; write it in step 6.

## 5. Triage

Fix each finding, or reject it with a one-line reason; both go to the log.
- Send the fixes to the implementer subagent that built the delivery, continued with its context,
  together with the findings; with no implementer, fix them here. They are committed as
  `fix: address review findings`. If code changed, rerun the verification.
- A finding that can recur (a missing tenant filter, unbounded input) gets its test or lint rule now.
- Fixed a blocker → one re-review of the fix commit only, with the lens that found it:
  `codex review --commit <sha>`, `/code-review high <sha>~1..<sha>`, or the prompt with
  git show <sha> in place of the range. In Sensitive, fixes that touch a sensitive path get that
  re-review with the security prompt even without a blocker: the security review saw the code
  before them. No further rounds; what remains goes under Em aberto.

## 6. Log and hand-off

Add the newest entry to `docs/LOG.md` (below its header), in Portuguese, following its template:
what, why, verification (real results), review (reviewer, level, findings fixed and rejected with
reasons), open items and the commit hashes. Commit it: `docs: log <title>`.

Then offer `git push -u origin <branch>` and `gh pr create` when there is a remote, or a local merge.
Merging into the base branch needs the user's explicit yes. Deploy only after the merge.
The session stays open: the next request starts with its own triage and its own branch.

## Release check

`/ship release`, after the human merged and deployed. Read-only; it follows AGENTS.md → Project →
Deploy.
1. The deployed commit is in the base branch (`git merge-base --is-ancestor <sha> origin/<base>`)
   and its deploy finished. Not in base, failed or canceled → stop and tell the user: the base
   branch and production have diverged.
2. Production migrations are applied (the project's status command). Pending → human-only: say so,
   don't apply them.
3. The production URL and the routes this delivery changed answer 2xx or 3xx
   (`curl -sS -o /dev/null -w "%{http_code}" <url>`).

Report each check with its real output.
