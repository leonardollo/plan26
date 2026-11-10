@AGENTS.md

## Claude Code

- Implementer: the Agent tool with `subagent_type: "general-purpose"` and `model: "sonnet"`
  (`"opus"` if Sensitive), never a fork; continue it with `SendMessage`. Search: `Explore` (no CLAUDE.md).
- `/ship` is a skill: invoke it yourself and follow it; never improvise the review.
- `/codex:*` plugin commands are for the user; `/ship` runs the `codex review` CLI. No review gate.
- A routine command that keeps prompting → suggest an allow rule in `.claude/settings.json` at the end.
