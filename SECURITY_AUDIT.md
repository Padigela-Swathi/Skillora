# Production security audit — 2026-11-24

Scope: whole repository, the live Supabase project (`kqqkowftmlysomzlzzta`), the production Next.js build, and the Netlify configuration.
Method: read the code and SQL, queried the live catalog (policies, grants, function ACLs, auth settings, advisors, logs), then attacked the
live project and a production build from the position of a normal signed-in user (A, attacker) against another user (B, victim).
Nothing here was deployed to Netlify. "NOT VERIFIED" means it cannot be checked from this environment.

## Verdict
**SAFE TO DEPLOY — conditional on the three actions in "Before you go live" (dashboard settings and data clean-up; no code change needed).** With the Email provider still on, test users present and CORS unpinned, the project is not ready for public launch even though the code is.
One HIGH finding was found and fixed during the audit (H-1). No CRITICAL findings.

## Findings
| ID | Severity | Finding | Status |
|---|---|---|---|
| H-1 | **HIGH** | Daily-limit bypass: `abandoned` interviews are not counted and `finish_interview` with 0 answers abandons an interview, so *start → quit → start* could be looped without limit by one account. Reproduced: 6 AI generations in 27 s against a limit of 3 (≈13/min). Impact: unbounded NVIDIA + sandbox spend, can exhaust the shared quota for every user. | **FIXED** (migration `20261124000004_start_cap.sql`) and re-tested live: the 9th start of the day is rejected (`DAILY_LIMIT`). Quitting right away is still free (not one of the 3), but starts are capped at 8/day and all attempts at 15/day. |
| M-1 | MEDIUM | Email/password provider is **enabled** and sign-ups are open (`/auth/v1/settings`: `email:true`, `disable_sign_up:false`, `mailer_autoconfirm:false`). Anyone with the public key can create an email account (after confirming a mailbox), bypassing "Google only". Unlimited accounts × 8 starts/day = bounded per account but unbounded overall. Test users with a known password (`@skillora-test.invalid`) also exist in this project. | **OPEN – your action** (dashboard). |
| L-1 | LOW | CORS on Edge Functions is `Access-Control-Allow-Origin: *` (live preflight confirmed: `ALLOWED_ORIGINS` is not set). Not exploitable by itself because functions authenticate with a bearer token that a foreign site cannot read, but it should be pinned. | **OPEN – your action** (set secret `ALLOWED_ORIGINS`). |
| L-2 | LOW | CSP keeps `script-src 'unsafe-inline'` (Next.js inline bootstrap scripts). Reduces defence-in-depth against XSS; no XSS was found (see tests). | Accepted; nonce-based CSP is the upgrade path. |
| L-3 | LOW | Supabase session cookie is `HttpOnly=false`, no `Secure` flag, `SameSite=Lax`, 400-day max-age (Supabase browser-client design). An XSS would be able to read it. Mitigated by: no XSS found, CSP, HSTS (2 years, includeSubDomains), HTTPS-only hosting. | Accepted; optional hardening: pass `secure: true` in production cookie options. |
| L-4 | LOW | `run-code` accepts runs for any `in_progress` interview with no time-expiry check (unlike `submit_answer`). Bounded by 12 runs/min/user and the new start cap. | Open (small hardening: reject after `started_at + duration + 5 min`). |
| L-5 | LOW | `interviews.error_message` stores provider detail (e.g. "NVIDIA API 599: <model> did not answer") and is readable by the owner. No secret is ever included. | Open (store a generic message). |
| L-6 | LOW | Supabase advisor "leaked password protection disabled". Only relevant to email/password accounts; moot once M-1 is done. | Resolved by M-1. |
| L-7 | LOW | `.github/workflows/ci.yml` has no explicit `permissions:` block and pins actions by tag. It uses no secrets (placeholder public env). | Open (add `permissions: contents: read`). |
| L-8 | LOW | When the 8/15 hard cap (not the 3/day allowance) is hit, the UI says "You have used all 3 interviews for today". | Cosmetic. |
| I-1 | INFO | 146 server-side `.map` files exist in `.next/server`; 0 in `.next/static`, and `*.js.map` over HTTP returns 404. They are not served. | Accepted. |
| I-2 | INFO | User code and answers leave to third parties (Judge0 CE / Wandbox, NVIDIA, Chrome speech recognition). Disclosed in the privacy draft; needs legal review. | Accepted. |

## PASS (each was executed, see "Tests executed")
Authentication & protected routes · RLS on all 6 tables (fail-closed, no `anon` grants, SELECT-only for clients) · cross-user read/write/IDOR via REST, RPC, Edge Functions and pages ·
hidden test cases unreadable by anyone (incl. owner, incl. embedded-resource tricks) · column-level grants (no client write to `terms_version`, `id`, scores, status) ·
SECURITY DEFINER functions (`search_path=''`, `auth.uid()` checks, `reserve_interview` service-only, `handle_new_user` unreachable) · forged / `alg:none` / swapped-`sub` / anon-key-as-bearer tokens ·
input validation at the DB (CHECK constraints) and at the Edge Functions (zod) · XSS (stored and reflected) · prompt-injection score inflation · race conditions on the daily limit ·
service-role key and NVIDIA key absent from the repo, history, and client/server build output · no storage buckets · dependencies (0 vulnerabilities) · production build has no dev surface · logs contain no secrets.

## Before you go live (your actions)
1. **Turn the Email provider OFF** (Supabase → Authentication → Sign In / Providers → Email). This also disables `/dev-login` and the E2E test users, so keep a separate dev/test project. (M-1, L-6)
2. **Delete the test data**: users `%@skillora-test.invalid` and `%@skillora-dbtest.invalid` (SQL in `DEPLOYMENT.md`). (M-1)
3. **Set the Edge Function secret `ALLOWED_ORIGINS`** to your Netlify origin(s). (L-1)
Also check in the Supabase dashboard (not verifiable here): Authentication → URL Configuration (Site URL = production URL; Redirect URLs = exact `/auth/callback` URLs, **no wildcards**), JWT expiry and refresh-token reuse detection, and that the Google OAuth client secret was only ever entered in the dashboard.

## Netlify
- `netlify.toml`: only `command`, `publish`, `NODE_VERSION`. No secrets, no `[[headers]]` conflicts. Security headers come from `next.config.ts` (verified on a production build: CSP with `frame-ancestors 'none'`, no `unsafe-eval`, HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy; `X-Powered-By` removed; `Cache-Control: private, no-store` on dynamic responses).
- Environment variables: Netlify needs only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`. These are bundled into the browser by design; the anon/publishable key is protected by RLS. Server secrets (`NVIDIA_API_KEY`, service-role key, `JUDGE0_AUTH_TOKEN`) live only in Supabase; a scan of the production build found none of them (and no JWT with `role: service_role`).
- Secrets scanning (from Netlify's docs, https://docs.netlify.com/security/secret-scanning/ and the Secrets Controller page; **not tested on a real Netlify build**): standard scanning only looks for the *values of variables you mark "Contains secret values"*, in the repo and the build output, and fails the build on a match. So **do not mark the `NEXT_PUBLIC_*` variables as secret** (they are in the bundle on purpose and would fail every build). Smart detection scans the repo and build output for secret-looking strings and may flag the publishable key in `.next/static`. If it does, add that one value to `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` (a site environment variable set in the Netlify UI) instead of disabling scanning; use `SECRETS_SCAN_OMIT_KEYS` only for a key flagged by name. Never set `SECRETS_SCAN_ENABLED=false`: it removes protection for every real secret.

## Tests executed (results)
| # | What | Result |
|---|---|---|
| 1 | Secret scan of all 11 commits and the working tree (key patterns, JWT decode, committed passwords) | 0 findings; `.env*` never committed (only `.env.example`) |
| 2 | `npm audit` (prod + dev) | 0 vulnerabilities |
| 3 | Live catalog: RLS flags, 7 policies, table/column grants, function ACLs, storage, extensions, auth settings | as designed (see PASS) |
| 4 | Supabase security advisors | 1 INFO (intentional), 5 WARN SECURITY DEFINER (intentional API, each checks `auth.uid()`), 1 WARN leaked-password protection (L-6) |
| 5 | Live attacker suite #1 (anon, forged tokens, cross-user, writes, RPC abuse, Edge abuse) | 104 / 104 passed |
| 6 | Live attacker suite #2 (race, constraint bypass, hidden-test leakage, rate limit, state machine, prompt injection) | 23 / 23 valid checks passed (2 further CORS checks in that script were invalid because of a header-casing bug and are discarded; CORS was re-tested with curl and is L-1) |
| 7 | Daily-limit abuse loop | **failed before the fix** (6 generations for 1 account) → **held after** (2 more succeeded up to the 8/day cap, then `DAILY_LIMIT`) |
| 8 | Production build: 0 static source maps, no secrets/JWTs/test password in `.next`, dev routes 404, headers, 10 protected routes redirect anonymous users, OAuth callback ignores `next=`/Host spoofing | all passed |
| 9 | Playwright `security-pages.spec.ts` (new) + `security.spec.ts` on desktop and mobile: page-level IDOR, profile-field XSS, headers, dev surface | 12 / 12 passed |
| 10 | One-off stored-XSS render test of question text, transcript, feedback, strengths/weaknesses/tips with `<img onerror>`, `<script>`, `<svg onload>` payloads (fixtures restored afterwards) | passed on desktop and mobile; payload shown as text, nothing executed |
| 11 | Supabase logs (24 h): function logs, gateway, auth, Postgres | no tokens, keys, or transcript content |
| 12 | `npm run check` (typecheck, eslint, 51 unit tests) | passed |
| 13 | Full Playwright regression (desktop + mobile) after the migration | first run 48 passed / 14 failed, all traced to test-fixture state (consumed "live" interviews, expired fixture timer, one-shot user C, a hard-coded "Up N points" that real AI scores turned into "Down 13"), none to the audit changes. After resetting fixtures: 57 passed + 4 re-run (history, skip-all) passed. The assertion for the trend direction was made data-independent. **Not re-run:** the onboarding spec (needs the one-shot test user `e2e-c`, which the committed `seed.sql` does not create, and which that spec deletes) and the env-gated live-AI / dev-server specs (8 skipped). |

Not run / not verified: the 66-check SQL suite `tests/db/rls_authorization.sql` (now 69 checks, three added for H-1) was **not re-run** because the SQL tool asks for confirmation on `delete` statements; paste it into the Supabase SQL editor. Dashboard-only settings listed above. A real Netlify deployment. The Google OAuth flow itself (needs a human).

## Reproduce
The attacker scripts live outside the repo (they need the test-user password). The durable regression tests are `tests/e2e/security.spec.ts`, `tests/e2e/security-pages.spec.ts`, `tests/db/rls_authorization.sql`.
