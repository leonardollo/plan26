# Third-party notice

Six skills in this folder come from Superpowers (https://github.com/obra/superpowers) by Jesse
Vincent, release v6.4.2 (commit 8ca22dba9a94f28898bbce59f2537ff4d87c747d), under the MIT License
below: `brainstorming`, `writing-plans`, `executing-plans`, `dispatching-parallel-agents`,
`using-git-worktrees` and `systematic-debugging`. The other skills belong to the Starter Pack.

They run without Superpowers' session-start hook and without `using-superpowers`. The Starter
Pack changed only what is listed here.

## All six

- `description` narrowed to the Starter Pack's triage in AGENTS.md.
- `superpowers:<skill>` references written as plain skill names.

## Left out

Files that nothing references: `brainstorming/spec-document-reviewer-prompt.md`, and
`systematic-debugging/CREATION-LOG.md`, `test-academic.md` and `test-pressure-1.md` to `-3.md`.

## brainstorming

- The visual companion guide is referenced from this skill's folder.

## writing-plans

- The plan header and the execution handoff name executing-plans only, run by an implementer
  subagent the main session dispatches and followed by `/ship`; subagent-driven-development is not
  included.

## executing-plans

- `task-brief` and `sdd-workspace` are copied from `subagent-driven-development/scripts/` into
  `scripts/`; `task-start` and `task-done` call them there. `task-brief` is unchanged.
  `sdd-workspace` has one bug fix: a failed `mkdir` or marker write exits with an error instead of
  counting as another plan's workspace (which looped forever), and the collision counter stops at 50.
- The final whole-branch review (`review-package` plus `requesting-code-review`'s reviewer) is
  replaced by `/ship`, where the other model reviews; Finish hands off to `/ship` instead of
  `finishing-a-development-branch`, and "Deferred minors" went with the review.
- When to Use no longer offers subagent-driven-development. The implementer is the subagent the
  main session dispatched with the plan (or a fresh session); a long plan continues in a new
  implementer from the ledger. `/ship` is run by the main session, not asked of the user.
- `test-driven-development` and `verification-before-completion` point to the AGENTS.md rules.

## systematic-debugging

- `test-driven-development` and `verification-before-completion` point to the AGENTS.md rules.

---

MIT License

Copyright (c) 2025 Jesse Vincent

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
