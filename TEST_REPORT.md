# Test report

Environment: Linux sandbox, Node 22, Chromium (pre-installed, via `E2E_CHROMIUM`), real Supabase project `kqqkowftmlysomzlzzta` (ap-south-1), real NVIDIA API (key injected by the sandbox proxy), real public Judge0 CE and Wandbox. Date: 2026-11-20.
Nothing here is mocked except the unit tests (which use injected fakes on purpose).

## Summary
| Layer | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` (strict) | pass |
| Lint | `npx eslint .` | 0 problems |
| Unit | `npx vitest run tests/unit` | **44 / 44** |
| DB authorisation | `tests/db/rls_authorization.sql` | **63 / 63** on the final schema before the privilege checks were added; the 3 privilege-matrix checks passed ad hoc (service_role ok, anon none, authenticated no insert/delete). A re-run of the full 66-check script was requested but the Supabase tool was waiting on a confirmation prompt: see "Not re-run" |
| Live (full suite, clean run) | `npm run test:live` | **34 / 34** (after the fixes below) |
| Live runner | (runner file) | all 5 languages × run / compile-ok / compile-error / timeout / runtime-error on **both** Judge0 and Wandbox |
| Live AI | (ai file) | JSON round-trip, HR questions, **full Coding-round interview** (real AI + real sandbox verification of hidden tests), evaluation (canonical sub-scores, mean computed in code), **prompt-injection** (scored < 60), dead-model fallback (410 and 404), each model of the fallback chain |
| Dependencies | `npm audit` | 0 vulnerabilities |
| Build | `npx next build` | pass, 16 routes |
| E2E (Playwright) | desktop 1440×900 + mobile 390×844 | final runs after the last code and Edge Function deploy: **desktop 26/26** (accessibility, interview incl. real coding runs through deployed `run-code` v2, app, public, security, dev-login 404; onboarding passed in the earlier full run) and **mobile 26/26**; earlier full passes were 22/22 per viewport |
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
| 10 | Judge0 client failed over on a single dropped connection (`fetch failed`) | quick retry before failover | U runner |
| 11 | `step-5-preview` fallback stalled >2 min; no global AI time budget | removed from chain; `chatJson` 100 s budget | U nvidia (budget test), L |
| 12 | **Interview room crashed with "Maximum update depth exceeded" on `npm run dev`** (reported by the user after real Google sign-in). `useNow` passed React a new `subscribe` function every render and that function changed the clock, so each render re-subscribed and re-rendered. Hidden in the production-build tests because consecutive renders usually landed in the same millisecond; dev mode is slower so the value always changed | stable shared clock store (`src/lib/clock.ts`), `subscribe` never notifies | U `clock.test.ts` (4) + dev-server E2E `room-dev.spec.ts` (3, incl. working speech recognition and the full practice→AI start→room flow) |
| 13 | Lint: state set in effects, `any` types, client-only helper used in server component | render-phase reset, typed fixtures, moved `buttonClass` | `eslint .` |
| 14 | **"Start interview" hung for ~100 s, then failed** (reported by the user on a Technical round). The primary NVIDIA model `google/gemma-4-31b-it` accepted requests but did not answer for 90 s+, while the fallback models answered in ~1 s. The old client waited 80 s on the primary before trying a fallback, leaving too little budget (and parallel coding/spoken calls all waited on the same stalled model). 4 of the user's attempts ended `failed` with "time budget exhausted … NVIDIA API 599" | per-call timeout 35 s, a stalled/overloaded model is skipped immediately and remembered for 5 min (so parallel calls and later requests go straight to a healthy model); UI shows an honest "AI is a bit slow" note after 20 s | U `nvidia.test.ts` (+3: stalled primary → fallback, health memory, budget) ; live: Technical 5-min start 48.6 s cold (one 35 s stall) → 13.2 s warm; HR 4.5 s |

## Live AI run on the deployed project (2026-11-21, manual, real HTTP with a real user token)
| Step | Result |
|---|---|
| `start-interview` HR / Easy / 5 min | 200 in 8.2 s; 3 spoken questions tailored to an IT 3rd-year student |
| answer 2, skip 1, `finish_interview`, `evaluate-interview` | completed, score 82 (sub-scores 85/82/90/80/75 → mean 82.4); first run took **101 s** |
| Root cause of the 101 s | the primary model (`gemma-4-31b-it`) normally answers in ~25 s but sometimes stalls; an 80 s per-call timeout let a stall consume the budget before failing over |
| Fix | evaluation calls now time out at 55 s and fail over to the fast fallback; `evaluate-interview` redeployed |
| `start-interview` Coding / Easy / 5 min | 200 in 32 s: 1 spoken + 2 AI-written coding problems; 6 sandbox-verified tests each; starters for 5 languages; public JSON contains no expected outputs |
| `run-code` on the AI problems | wrong solution 2/6, correct 6/6 and 6/6 (judge0); no hidden-test data in responses |
| answer all 3, finish, `evaluate-interview` | **24.7 s**, score 93 (Correctness 100 = consistent with 12/12 tests) |
| UI | the real report renders on desktop and mobile (`tests/e2e/live-ai.spec.ts`, axe clean) |
Per-model evaluation latency measured by `tests/live/timing.live.test.ts`: gemma-4-31b 25 s, laguna 9 s, nemotron-bolt 4.7 s.

**Why the tests missed it:** the E2E suite runs against `next start` (production). Timing-dependent render loops can behave differently on a slower dev server. `room-dev.spec.ts` therefore targets a running `npm run dev` (`E2E_DEV=1 E2E_PORT=3200`).

## Not verified / limitations (honest list)
- **Google OAuth round-trip**: provider is not enabled in the project; sessions were tested with password users created for tests.
- ~~Deployed AI functions~~ **now verified** (2026-11-21, after the NVIDIA key was added): see "Live AI run on the deployed project" below.
- **Voice**: the Web Speech API cannot run headless; typed answers are verified, dictation and interviewer TTS are not.
- **Real camera/microphone hardware**: only Chromium's fake devices.
- **Visual fidelity**: compared side-by-side with the handoff PNGs by eye (landing, practice, device check, interview room, coding, feedback, history, settings, mobile set). No pixel-diff tool was used, so "pixel-perfect" is **not** claimed.
- Screen-reader (NVDA/VoiceOver) testing, Safari/Firefox, load/performance and real-device mobile testing were not done.
- Public Judge0/Wandbox/NVIDIA free tiers have no guaranteed capacity; observed latency of a 4-test run was ~8 s (first call ~33 s).
- The deployed Edge Functions were redeployed (version 2) after the last code change, so the dev project runs the repo code; the model chain can also be overridden with the `NVIDIA_FALLBACK_MODEL` secret without redeploying.
- Free NVIDIA models sometimes return 429/529 or stall; the client retries, falls back and gives up after 100 s with `AI_UNAVAILABLE`. Live tests of single named models can therefore fail transiently.

## Not re-run
The full 66-check DB script was not re-run after adding the 3 privilege-matrix checks: the Supabase tool asks for confirmation on SQL containing `delete` and the prompt timed out. The earlier 63/63 run and the ad hoc privilege query both passed. Paste `tests/db/rls_authorization.sql` into the Supabase SQL editor to run it.
A browser-only gotcha when reproducing in a proxied sandbox: if the proxy port changes, `E2E_PROXY` goes stale and every browser call to Supabase fails with `ERR_PROXY_CONNECTION_FAILED` (looks like app failures; it is not).

## How to reproduce
```bash
npm ci && cp .env.example .env.local   # fill Supabase URL + anon key, E2E_PASSWORD
# in the Supabase SQL editor: tests/e2e/seed.sql (users), tests/e2e/fixtures.sql, then tests/e2e/reset-live.sql before every run
npm run build && npm run test:e2e
npm test && npm run test:live
# DB suite: paste tests/db/rls_authorization.sql into the SQL editor
```
Sandbox-only variables (leave unset elsewhere): `NODE_USE_ENV_PROXY=1`, `E2E_PROXY`, `E2E_INSECURE=1`, `E2E_CHROMIUM`.
