# Feature matrix (requirement → implementation → evidence)

Status vocabulary: **Verified** = exercised end-to-end against real services · **Verified (partial)** = main path verified, a named part is not ·
**Implemented / unverified** = code exists, could not be exercised here (reason given) · **Blocked** = needs an external action.
Test IDs refer to `TEST_REPORT.md` (U = unit, L = live, D = DB suite, E = Playwright, M = manual/analysis).

| REQ | Feature | Role | UI / routes | Backend (DB / functions) | Authorisation | Evidence | Status |
|---|---|---|---|---|---|---|---|
| 001 | Landing site | Anon | `/` (hero, how-it-works, rounds, benefits, CTA, footer) | – | public | E public.spec (both viewports), screenshot vs design | **Verified** |
| 002 | Google sign-in, session, protected routes, sign out | Student | `/signin`, `/auth/callback`, `proxy.ts`, Settings→Sign out | Supabase Auth (PKCE via `@supabase/ssr`) | `getUser()` re-validation in proxy and every page | E: anonymous redirects, cookie sessions (real password users), sign-out; provider-disabled message | **Verified (partial)** – the Google round-trip itself is **Blocked** (provider not enabled; needs OAuth client) |
| 003 | Terms/Privacy accept · decline signs out · re-acceptance | Student | `/onboarding/terms`, `/signed-out`, `/legal/*` | `profiles.terms_version`, `accept_terms()` | version stored per user; `start-interview` re-checks | E onboarding.spec, D (direct write denied) | **Verified** |
| 004 | Basic profile (name, college, branch, year, gender?, age?) | Student | `/onboarding/details`, `/settings` | `profiles` + CHECK constraints | RLS own-row, column-level UPDATE grant | E onboarding/app.spec, D | **Verified** |
| 005 | Round / level / duration selection, 3·6·9 questions | Student | `/practice` | `QUESTION_COUNT` shared config | – | E app.spec, U config | **Verified** |
| 006 | Camera + mic check, device pickers, level meter, never recorded | Student | `/practice/setup` | none (browser only) | – | E with Chromium fake devices; **real hardware not tested** | **Verified (partial)** |
| 007 | Pre-interview tips | Student | `/practice/tips` | – | – | E app.spec | **Verified** |
| 008 | AI question generation (NVIDIA), coding mixed in, verified tests | Student | tips → "start interview" overlay | Edge `start-interview`, `reserve_interview()` | JWT + terms/profile gate + daily limit | L: real NVIDIA + real sandbox build a full Coding-round interview; E: gate/validation/`AI_NOT_CONFIGURED` fail-fast; **deployed function → NVIDIA path unverified** (secret not set) | **Implemented; AI path of deployed function unverified** |
| 009 | Interview room: timer, progress, Done/Skip/Quit, 2-min soft limit, time-up | Student | `/interview/[id]` | `submit_answer()`, `finish_interview()` | owner-only, state + time enforced in SQL | E interview.spec (spoken, skip, quit, skip-all dialog), D (TIME_UP, double submit…) | **Verified** |
| 010 | Voice answering + live transcript, typed fallback, interviewer voice | Student | room | Web Speech API / `speechSynthesis` (browser) | – | E typed path; speech recognition needs a real mic + Chrome → **not testable headless** | **Implemented / unverified (voice)**, typed path verified |
| 011 | Code editor: Python, Java, C++, C, JavaScript · Compile · Run vs hidden tests | Student | room (coding question) | Edge `run-code` → Judge0 CE (+Wandbox fallback), `question_private`, `code_runs` | JWT, ownership, active interview, rate limit, hidden tests server-only | L runner (5 languages × run/compile/timeout, both providers), E real runs through deployed function, E security | **Verified** |
| 012 | AI evaluation: per-question + sub-scores, compiled score in code | Student | `/interview/[id]/processing` | Edge `evaluate-interview` | owner, state `processing` | L: real NVIDIA evaluation (canonical sub-scores, injection resistance), U scoring; E: ownership/state/error-recorded + retry UI; **success write-back unverified** (needs secret) | **Implemented; end-to-end unverified** |
| 013 | Feedback report, ended-early, generating screen | Student | `/feedback/[id]`, processing | `interviews`, `interview_questions` | RLS own rows | E app.spec on seeded completed data, screenshots vs design | **Verified** (data seeded; live-generated report pending AI secret) |
| 014 | Retry round / try another / history | Student | feedback actions | – | – | E app.spec | **Verified** |
| 015 | History: overall, trend, average by round, filters | Student | `/history` | select own `interviews` | RLS | E app.spec (incl. empty state) | **Verified** |
| 016 | Settings: edit profile, sign out, delete account | Student | `/settings` | Edge `delete-account` (admin deleteUser, FK cascade) | JWT, `confirm:"DELETE"` | E: real deletion of a throwaway account + login fails after; D cascade | **Verified** |
| 017 | 3 interviews/day (IST), server-enforced | Student | practice chip + disabled Continue | `reserve_interview()` advisory-locked | service-role-only RPC | D (limit, failed/abandoned not counted, concurrency lock); E chip | **Verified (DB)**; function path needs AI secret |
| 018 | Rating after 1st then every 5th | Student | feedback | `rating_due()`, `feedback_ratings` | RLS insert-only own completed interview | D (due, duplicate, impersonation), E (submit + hidden after) | **Verified** |
| 019 | Per-user isolation | – | – | RLS, column grants, SECURITY DEFINER RPCs | see SECURITY.md | D 66 checks, E security.spec (REST + Edge) | **Verified** |
| 020 | Responsive + accessible | – | all | – | – | E both viewports; axe-core WCAG 2.1 A/AA scan on every screen (0 serious/critical); keyboard/focus-trap test | **Verified** (automated; no manual screen-reader pass) |
| 021 | Netlify preparation | – | `netlify.toml`, DEPLOYMENT.md | – | – | `next build` passes; **not deployed** (by instruction) | **Prepared** |
| 022 | Zero extra cost | – | – | Judge0 CE public + Wandbox free; browser STT/TTS | – | L | **Verified** (public services have no SLA/limits guarantee) |
| 023 | Storage buckets | – | – | none needed (D-06) | – | n/a | **Not required** |

## Known deviations from the design (intentional)
- Camera preview shows the real camera (the prototype faked it). Interviewer is still the illustrated placeholder avatar (handoff §12).
- Added (not in the prototype): "Type or edit instead" for the live transcript, replay-question button, coding-problem statement/examples in the question card, resume/get-feedback banner on Practice, history empty state.
- Company list stays at the 7 companies in the design (target was 8–10): adding employer claims was not invented.
- Rating UI is shown only when due; the design's static screenshot always showed it.
