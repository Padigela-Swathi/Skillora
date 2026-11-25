# Security

No system is "absolutely secure"; this lists what is enforced, how it was checked, and what remains your responsibility.
The final pre-production audit (findings, fixes, tests run) is in [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md).

## Trust boundaries
Browser (untrusted) → Next.js server (holds only the public URL + publishable key) → Supabase (Auth, PostgREST+RLS, Edge Functions).
Secrets (`NVIDIA_API_KEY`, `JUDGE0_AUTH_TOKEN`, service-role key) exist **only** as Supabase Edge Function secrets/environment. A scan of the production client bundle found no secret names and exactly one key: the publishable key.

## Controls
| Area | Control | Verified by |
|---|---|---|
| Authentication | Supabase Auth, Google OAuth (PKCE), cookie session via `@supabase/ssr`; `proxy.ts` and every page call `auth.getUser()` (server-validated JWT), never trust the cookie alone | E anonymous redirects / sign-out |
| Authorisation | RLS on all 6 tables, fail-closed (no `anon` grants, SELECT-only for clients, column-level UPDATE on profiles, INSERT-only ratings) | D (66 checks), E security.spec (REST) |
| Privileged operations | State changes only via SECURITY DEFINER RPCs (explicit `auth.uid()` checks) or Edge Functions; `reserve_interview` callable by service role only | D, E |
| Role escalation | No role concept to escalate; `profiles.id`/`terms_version` not client-writable; JWT claims never used for authorisation beyond `sub` | D |
| Tenant isolation | `user_id` on every row; cross-user reads return nothing, cross-user RPC/Edge calls return NOT_FOUND | D, E |
| Hidden test cases | `question_private` has no policy/grants; outcomes for hidden tests omit input/expected/actual; public `coding` JSON contains only the two visible examples | D, U, E (assertion that hidden values never appear) |
| Edge Functions | `verify_jwt=true` **and** in-function `getUser()`; zod input validation; size limits; stable error codes; messages-only logging (no code, transcripts or tokens) | E security.spec (no/forged token → 401, bad input → 400) |
| Abuse limits | 3 counted interviews/day/user plus a hard cap of 8 started and 15 attempted per day (DB; closes the start→quit loop found in the 2026-11-24 audit), single in-flight generation, 12 code runs/min/user, 20k-char source cap, 3–5 s CPU limits in the sandbox | D, E |
| Prompt injection | Student text is wrapped as untrusted data; the model never decides the compiled score (code computes the mean, clamps 0–100, canonicalises sub-score names); coding correctness is fed from measured test results, bound to a hash of the exact submitted code | U, L (an answer saying "output 100" scored < 60) |
| Code execution | User code never runs on Supabase or Netlify; it runs in third-party sandboxes (Judge0 CE / Wandbox) | – |
| Web | CSP (`frame-ancestors 'none'`, `connect-src` limited to the Supabase host), HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy (camera/mic self only), `poweredByHeader` off; no `dangerouslySetInnerHTML`/`eval` in `src` | E headers test, grep |
| Dependencies | `npm audit`: 0 vulnerabilities (prod and dev) | M |
| Storage | No buckets exist (no uploads in V1; camera/audio never stored) | M |
| Admin page | `/admin` returns 404 unless `is_admin()`; the stats come from `admin_reach_stats()` (SECURITY DEFINER, re-checks admin, aggregates only); `admins` has no client access; no service-role key in the web app | D |
| Account deletion | `delete-account` uses the admin API; FK cascade removes all rows | E (real deletion), D |

## Supabase advisors (final)
- INFO `question_private` has RLS but no policy: **intentional** (deny-all to clients).
- WARN ×5 SECURITY DEFINER functions executable by `authenticated`: **intentional**, they are the API; each checks `auth.uid()`.
- WARN leaked-password protection disabled: only relevant to email/password accounts; moot once Email signups are disabled (below).

## Risks and actions that are yours
1. **Turn the Email provider OFF** (Dashboard → Authentication → Sign In / Providers → Email → disable). Today anyone with the public key can create email accounts, bypassing "Google only"; each account gets 3 AI interviews/day, so unlimited accounts = unbounded AI spend. Supabase has no "email sign-ups only" switch: the global "Allow new users to sign up" would also block new Google users, so the whole Email provider must go. This also disables `/dev-login` and the password users used by the E2E suite, so keep it ON only in a separate dev/test project. Consider CAPTCHA or a college-domain restriction if abuse appears.
2. **Third-party data flows** (now disclosed in the privacy draft, needs legal review): answers + code → NVIDIA; code → Judge0/Wandbox public sandboxes; Chrome speech recognition → Google. Self-host Judge0 (`JUDGE0_URL`) if code must stay private.
3. **Public sandboxes have no SLA.** Failover to Wandbox is automatic; heavy traffic needs a self-hosted Judge0.
4. **CORS** on Edge Functions is `*` until the secret `ALLOWED_ORIGINS` is set (confirmed live on 2026-11-24). Bearer tokens, no cookies, so it is not exploitable by itself, but set it to your site origin(s) before launch.
5. CSP keeps `'unsafe-inline'` for scripts/styles because Next.js injects inline bootstrap scripts; move to nonces if you need a stricter policy.
6. Rotate the NVIDIA key if it was ever pasted anywhere outside the Supabase secret form.
7. A service-role key for an unrelated project was present in the build sandbox environment; it was not used. Make sure it is not a leaked credential of yours.
