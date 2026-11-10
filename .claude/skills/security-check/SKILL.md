---
name: security-check
description: Audit a whole area of the code, not just a diff, against docs/SECURITY.md and prove findings where it is safe. Pass the area, for example auth, billing or src/app/api/admin.
disable-model-invocation: true
argument-hint: "<area>"
---

# /security-check

Audits everything in one area as it is today, not a diff, against `docs/SECURITY.md`. Read-only:
it finds and proves; fixes come later as their own deliveries.

## 1. Scope

- The area is the argument: a path, a module or a flow ("login", "billing export"). None given → ask,
  suggesting the sensitive paths from AGENTS.md → Project.
- Map it before judging: entrypoints (routes, server actions, API handlers, jobs, webhooks), the data
  access they reach, the policies and migrations of the tables they touch, middleware, config and env
  use, and the client code that receives their responses. For a large area, map it with a search
  subagent (Explore in Claude Code) and read the relevant files yourself.
- Say in one line what is in scope and what is not.

## 2. Audit

Read `docs/SECURITY.md`. For each section that applies, go item by item:
- **Applies?** If not, say why in a few words.
- **Evidence:** the file:line that satisfies or breaks it. Follow each id from the request to the
  query: is the caller's scope enforced in the data layer, or only in the UI?
- **Proof,** where it is cheap and safe: the negative case against the local environment, such as an
  anonymous request, another tenant's id, a `..` path, extra fields in the payload, or an API key on
  a session-only route. Never against production or shared data, never with real credentials. Probe
  scripts live in a temp dir outside the repo.
- Layers fail independently: RLS doesn't prove object authorization, and a green suite doesn't prove
  an untested vector.

Beyond the checklist, look at money, date and permission rules with their edge cases, at anything
that trusts the client, and at anything that fans out to a metered service.

## 3. Report

For each finding:
- **Severity:** blocker (exploitable now), should-fix or hardening.
- **Where and what:** file:line and one sentence.
- **Vector and proof:** the concrete request or input, and the command with its output, or "not
  proven" and why.
- **Fix:** the direction in one line, and the test or lint rule that keeps it from coming back.

Close with what was checked (sections, files) and what was not.

Record it as the newest entry of `docs/LOG.md` (below its header), in Portuguese, titled
`Auditoria de segurança — <área>`: Verificação holds what was checked and proven; Em aberto holds the
findings by severity and what was not checked. Leave it uncommitted and tell the user.

## 4. Next

Each fix is a delivery at the Sensitive level (one per blocker, or a plan when there are many), and
each closes with `/ship`. A finding that can recur ships with its test or lint rule.
