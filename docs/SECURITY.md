# Security checklist

Used by `/ship` for sensitive reviews and by `/security-check`. Each rule names the case that
proves it. Layers fail independently — database grants/RLS, object authorization, secrets,
content — so auditing one says nothing about the others. A clean scan or green unit tests is
not an audit: say what was checked, with which lens, and what was not looked at.

## 1. Authorization — no tool detects this layer; only review does

- [ ] Every endpoint that receives an id crosses it with the caller's scope before reading or
  writing, for queries and mutations alike, in the data layer (`WHERE id = ? AND tenant = ?`)
  through one shared scope helper. *Prove:* another tenant's id is refused **and the data
  function is never called**.
- [ ] RLS doesn't replace object authorization: know which role each access path uses (owner
  and service roles bypass RLS). Tenant-context helpers are used on every query, listings
  included. *Prove:* a listing returns nothing from another tenant.
- [ ] Writes take an allowlist of fields (schema rejects unknown keys), never the whole body.
  *Prove:* extra `role`, `tenantId` or `id` in the payload is rejected or ignored.
- [ ] A restricted privileged role never shares procedures with the full admin — separate them
  in the types, not in each author's discipline.
- [ ] The server decides access. Hidden buttons, roles in `localStorage` and client-decoded
  tokens decide nothing.
- [ ] Bulk and destructive operations: session auth only (no API keys unless designed for it),
  a cap per call, confirmation showing the exact N from a preview, and a server-side check that
  the selection didn't change (409). Guards cover legacy rows whose state predates current
  invariants. *Prove:* API key → 403; changed selection → 409; legacy row stays protected.
- [ ] Concurrent edits to sets (tags, members) apply deltas inside a transaction, never
  rewrite the whole set.
- [ ] Unauthenticated endpoints treat every field as hostile: identity only from a signed token,
  file references only under the prefix the upload itself generated.

## 2. Secrets and sessions

- [ ] `.gitignore` has `.env*` plus `!.env.example` — narrow patterns once missed `.envtest`
  and leaked 55 production variables. A leaked secret is **rotated**, not just removed.
- [ ] Build prefixes are public (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, `EXPO_PUBLIC_`): no key
  that authorizes spend or privileged access goes there.
- [ ] Secret-strength guards check placeholder words and entropy, not length.
- [ ] Tokens are verified, never just decoded; short expiry; revocable. Session cookies are
  `HttpOnly` + `Secure` + `SameSite`.
- [ ] Passwords use argon2id, bcrypt or scrypt at a calibrated cost; the session id is
  regenerated on login and privilege change; login, OTP and reset are throttled without
  locking the real user out; responses don't reveal whether the account exists.
- [ ] No secret goes into an LLM prompt. Third-party content in the model's context is hostile
  input, and model output is untrusted before it drives an action.

## 3. Input and output

- [ ] Server-side validation at every trust boundary, with bounds (`.max()` on strings and
  arrays even when the UI limits them — routes get called directly).
- [ ] Public and expensive endpoints (signup, contact, email/SMS, AI calls, search, exports) have a
  server-side rate limit per user and per IP, answering 429 with `Retry-After` — a disabled button
  limits nothing. List endpoints cap the page size. *Prove:* the N+1th request in the window gets
  429, and `?limit=100000` returns at most the cap.
- [ ] Parameterized SQL only. No non-literal `innerHTML`, `dangerouslySetInnerHTML` or `v-html`
  without sanitizing. No shell-out with user input. No `eval`, `new Function` or unsafe
  deserialization (`yaml.load`, `pickle`) of client data.
- [ ] Responses carry only what the screen needs: no full lists of people in client payloads
  or props, no `select *` with hashes or PII, no stack traces. Logs use an allowlist of fields —
  no PII, no credentials.
- [ ] Paths are decoded and split, and `..`, `.` and empty segments rejected, **before** any
  prefix comparison, at the choke point that signs or reads.
- [ ] Incoming webhooks verify the provider signature with a constant-time comparison before
  processing anything.
- [ ] Error messages match the cause: a 500 never shows up as "wrong password".

## 4. Storage and network

- [ ] Personal or company documents live in a private bucket behind signed URLs with a TTL —
  separate by bucket, not by folder.
- [ ] Uploads check real magic bytes, store the detected type, and have a size cap and rate limit.
- [ ] Server-side fetches of user-supplied URLs use a host allowlist enforced on the actual
  connection. URL signing anchors the host in env and fails closed without it.

## 5. Database (Postgres / Supabase)

- [ ] RLS is enabled in the same migration that creates the table; a policy on a table without
  RLS does nothing.
- [ ] Privilege audits cover SELECT, INSERT, UPDATE and DELETE for the anonymous and
  authenticated roles, plus default privileges (`for role <migration role>`, sequences too).
- [ ] Role checks inside policies use a `SECURITY DEFINER` function with a fixed `search_path`.
- [ ] Views over protected tables use `security_invoker = on`. Materialized views can't: revoke
  their grants or move them out of exposed schemas. No backup tables with PII in exposed schemas.

## 6. Transport and headers

- [ ] CORS lists origins explicitly — never reflect the request origin with credentials — and
  sends `Vary: Origin`.
- [ ] CSRF defense for cookie-authenticated mutations; HSTS when HTTPS-only; `frame-ancestors`.

## 7. Operations

- [ ] Anything that polls or fans out to a metered service (Redis, email, AI) has a budget per
  user or tab and an alert before the quota runs out.
- [ ] After a release, confirm the deploy finished and migrations were applied — `main` and
  production must not diverge silently.
- [ ] Install from the lockfile and run the stack's dependency audit in CI. Before installing a
  package an AI suggested, confirm it exists, who publishes it and since when.
- [ ] New routes are mounted in every entrypoint (dev and prod).

## How to review

- Prove with the real vector — anonymous request, `..` payload, another tenant's id — not only
  with a green unit test.
- A finding that can recur becomes a test or lint rule in the same delivery.
