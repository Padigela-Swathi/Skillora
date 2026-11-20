# Test report

Environment: Linux sandbox, Node 22, Chromium (pre-installed, via `E2E_CHROMIUM`), real Supabase project `kqqkowftmlysomzlzzta` (ap-south-1), real NVIDIA API (key injected by the sandbox proxy), real public Judge0 CE and Wandbox. Date: 2026-11-20.
Nothing here is mocked except the unit tests (which use injected fakes on purpose).

## Summary
| Layer | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` (strict) | pass |
| Lint | `npx eslint .` | 0 problems |
| Unit | `npx vitest run tests/unit` | **42 / 42** |
| DB authorisation | `tests/db/rls_authorization.sql` | **63 / 63** on the final schema before the privilege checks were added; the 3 privilege-matrix checks passed ad hoc (service_role ok, anon none, authenticated no insert/delete). A re-run of the full 66-check script was requested but the Supabase tool was waiting on a confirmation prompt: see "Not re-run" |
| Live runner | `npm run test:live` (runner file) | all 5 languages × run / compile-ok / compile-error / timeout / runtime-error on **both** Judge0 and Wandbox |
| Live AI | `npm run test:live` (ai file) | JSON round-trip, HR questions, **full Coding-round interview** (real AI + real sandbox verification of hidden tests), evaluation (canonical sub-scores, mean computed in code), **prompt-injection** (scored < 60), dead-model fallback (410 and 404), each model of the fallback chain |
| Dependencies | `npm audit` | 0 vulnerabilities |
| Build | `npx next build` | pass, 16 routes |
| E2E (Playwright) | desktop 1440×900 + mobile 390×844 | last full passes: desktop 22/22, mobile 22/22 (1 deliberate no-op on desktop: account deletion runs in the mobile pass); later re-run of the 4 fixture-independent specs: 41/42 (see below) |
| Accessibility | axe-core WCAG 2.1 A/AA on every screen + keyboard/focus tests | 0 serious/critical violations (1 real finding fixed: avatar label) |

## What the E2E suite covers (real browser → real Next server → real Supabase/Edge Functions)
`public` landing/sign-in/protected-route redirects/legal/signed-out/security headers · `onboarding` new user: terms gate, decline signs out, accept (RPC), details validation, practice, empty history, **real account deletion** · `app` practice→device check (fake camera/mic)→tips, URL validation, start-interview call, feedback report, ended-early, rating (once), history filters, settings save, nav · `interview` spoken answer, skip, coding **compile + run through the deployed `run-code` function against the real sandbox** (wrong and right solutions, hidden-test non-leak), language switching, finish→processing→evaluate (error path), quit with 0 answers, skip-all dialog, cross-user 404 · `security` direct REST and Edge Function access as anonymous / forged token / other user · `a11y`.

## Defects found and fixed during testing (root cause → fix → regression)
| # | Defect | Fix | Guard |
|---|---|---|---|
| 1 | Edge Functions could read **nothing**: `service_role` had no table grants on this project | migration 003 | D privilege-matrix checks, E interview/run-code |
| 2 | Wandbox fallback hung on infinite loops / Java compile exceeded 12 s | timeout mapped to `timeout` status; 30 s for Java | L runner |
| 3 | Dead NVIDIA models in defaults (`llama-3.3` 410, `gemma-3` 404, `minimax` 529) | configurable fallback chain, 410/404 skip, re-verified chain | U + L fallback tests |
| 4 | Code editor not monospace (unlayered `font-family: inherit` beat utilities) | moved into `@layer base` | visual comparison |
| 5 | Container widths differed from the design (content-box vs border-box) | measured from the handoff PNGs | visual comparison |
| 6 | Raw JSON error page when Google provider is disabled | settings pre-check + friendly message | E public.spec |
| 7 | Avatar link's accessible name lacked its visible text (WCAG 2.5.3) | name now includes initials | E a11y.spec |
| 8 | Stranded interviews had no way back | resume / "get my feedback" banner on Practice | E app.spec |
| 9 | Privacy copy omitted third-party processing (NVIDIA, sandboxes, Chrome STT) | added section 5 | review |
| 10 | Lint: state set in effects, `any` types, client-only helper used in server component | render-phase reset, typed fixtures, moved `buttonClass` | `eslint .` |

## Not verified / limitations (honest list)
- **Google OAuth round-trip**: provider is not enabled in the project; sessions were tested with password users created for tests.
- **Deployed `start-interview` / `evaluate-interview` against NVIDIA**: `NVIDIA_API_KEY` is not set as an Edge Function secret, so these functions return `AI_NOT_CONFIGURED` (verified, and verified not to consume the daily allowance). The same prompts/clients were verified live in `tests/live`, but the **success write-back of a generated interview and of an evaluation through the deployed functions has not run**.
- **Voice**: the Web Speech API cannot run headless; typed answers are verified, dictation and interviewer TTS are not.
- **Real camera/microphone hardware**: only Chromium's fake devices.
- **Visual fidelity**: compared side-by-side with the handoff PNGs by eye (landing, practice, device check, interview room, coding, feedback, history, settings, mobile set). No pixel-diff tool was used, so "pixel-perfect" is **not** claimed.
- Screen-reader (NVDA/VoiceOver) testing, Safari/Firefox, load/performance and real-device mobile testing were not done.
- Public Judge0/Wandbox/NVIDIA free tiers have no guaranteed capacity; observed latency of a 4-test run was ~8 s (first call ~33 s).
- Deployed Edge Function code was last deployed before two small repo changes (Wandbox Java timeout; fallback model chain). Redeploy from the repo (DEPLOYMENT.md §1.2) to pick them up; the chain can also be overridden with the `NVIDIA_FALLBACK_MODEL` secret without redeploying.
- The full live suite flakes only when a free NVIDIA model returns 429/529; the client retries and falls back.

## Not re-run (blocked at the time of writing)
The Supabase tool asked for confirmation of a statement and the prompt timed out, so after the last code changes these were **not** re-run: the full 66-check DB script, the mobile `a11y` interview-room scan and a fresh desktop/mobile `interview.spec` run (fixtures need `tests/e2e/reset-live.sql`). Their last results before the changes were all passing and none of the changes touch those code paths.

## How to reproduce
```bash
npm ci && cp .env.example .env.local   # fill Supabase URL + anon key, E2E_PASSWORD
# in the Supabase SQL editor: tests/e2e/seed.sql (users), tests/e2e/fixtures.sql, then tests/e2e/reset-live.sql before every run
npm run build && npm run test:e2e
npm test && npm run test:live
# DB suite: paste tests/db/rls_authorization.sql into the SQL editor
```
Sandbox-only variables (leave unset elsewhere): `NODE_USE_ENV_PROXY=1`, `E2E_PROXY`, `E2E_INSECURE=1`, `E2E_CHROMIUM`.
