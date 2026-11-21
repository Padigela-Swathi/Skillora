# Handoff

## 1. Overall status: **IMPLEMENTED WITH DOCUMENTED LIMITATIONS**
Every mandatory requirement is implemented and, except for three items, verified end-to-end against the real Supabase project in a real browser. The three that are **not** verified all depend on things only you can do (Google OAuth client, NVIDIA key as a Supabase secret, a real microphone). See `TEST_REPORT.md` and `FEATURE_MATRIX.md`. This is not "COMPLETE AND VERIFIED" because of them.

## 2. What you must do at the end (checklist, in order)
**A. To make the product work**
1. **NVIDIA key** → Supabase Dashboard → Edge Functions → Secrets → add `NVIDIA_API_KEY` (from build.nvidia.com). *(I could not set it: the value must never pass through me.)* Then try a 5-min HR interview.
2. **Google sign-in** → Google Cloud Console: create an OAuth client (Web) with redirect URI `https://kqqkowftmlysomzlzzta.supabase.co/auth/v1/callback`; paste client ID/secret into Supabase → Authentication → Providers → Google → enable.
3. **URL configuration** → Authentication → URL Configuration: Site URL = your Netlify URL; add `https://<your-site>/auth/callback` and `http://localhost:3000/auth/callback` to Redirect URLs.
4. **Turn the Email provider OFF** (Authentication → Sign In / Providers → Email) once Google sign-in works, otherwise anyone can bypass "Google only" and multiply AI usage (SECURITY.md #1). This also disables the local `/dev-login`. Optional: CAPTCHA.
5. **Edge Functions**: the dev project (`kqqkowftmlysomzlzzta`) already runs version 2 of `start-interview`, `run-code` and `evaluate-interview` (= this repo). For any **other** Supabase project deploy them yourself: `supabase functions deploy start-interview run-code evaluate-interview delete-account`.
6. **Set `ALLOWED_ORIGINS`** secret to your site origin.
7. **Netlify**: connect the repo; env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`; deploy.

**B. Before real students use it**
8. **Legal**: get the Terms/Privacy reviewed (drafts from the design plus a new "Services we use" section: NVIDIA, public code sandboxes, Chrome speech→Google). Set the contact email. When the text is final bump `TERMS_VERSION` (`supabase/functions/_shared/config.ts`) and redeploy `start-interview`.
9. **Test with real people**: a real Google account, a real microphone in Chrome (dictation + interviewer voice are the unverified parts), a phone.
10. **Check the NVIDIA models are still alive** (`GET https://integrate.api.nvidia.com/v1/models`; fix via `NVIDIA_MODEL` / `NVIDIA_FALLBACK_MODEL`, no redeploy). Free tiers rate-limit; watch for 429s on launch day.
11. **Code runner capacity**: public Judge0 CE has no SLA. If many students run code at once, self-host Judge0 (free VM) and set `JUDGE0_URL`.
12. **Remove test data** from the Supabase project:
    `delete from auth.users where email like '%@skillora-test.invalid' or email like '%@skillora-dbtest.invalid';` (cascades). Also delete the `e2e-*` fixtures if any remain.
13. **Rotate** any key that was ever pasted into chat or a file; look at why a service-role key for a *different* Supabase project (`ixgxtngx…`) was in the build environment.
14. Re-run `tests/db/rls_authorization.sql` once in the SQL editor (66 checks) and `npm run test:e2e` after setting up fixtures (TEST_REPORT.md "Not re-run").

**C. Nice-to-have later**: 3D/animated avatar (open question in the design handoff), more companies (design has 7, target 8–10), pixel-diff visual regression, per-college sign-up restriction, usage dashboard.

## 3. What was built
Landing · Google sign-in · Terms/Privacy (versioned re-acceptance, decline signs out) · basic profile · round/level/duration selection · camera & mic check (self-view only, level meter) · tips · **AI interview room** (question read aloud, live transcript or typed answer, timer, 2-min soft limit, skip/quit/done, time-up rule) · **coding questions** with a real editor (Python, Java, C++, C, JavaScript), Compile and Run against AI-written problems whose expected outputs are computed by executing a reference solution · AI feedback (per-question + sub-scores; compiled score computed in code) · rating after 1st then every 5th · history with trend · settings with real account deletion · resume banner · 3-per-day limit.

## 4. Architecture and decisions (details: ARCHITECTURE.md, DECISIONS.md)
Next.js 16 (RSC + client islands) → Supabase only. AI and code execution are in Edge Functions (keys never reach the browser). Code runs in Judge0 CE (free public) with Wandbox failover because Supabase Edge Functions cannot run compilers; self-hosting is a config change. No storage buckets (nothing is uploaded; audio/video are never kept). Voice uses the browser's free Web Speech API.

## 5. Database / migrations (DATABASE.md)
3 migrations applied to the project: schema+RLS, state-machine functions, service-role grants. Clients are SELECT-only on interview data; all transitions are server-side.

## 6. Security (SECURITY.md)
RLS fail-closed on 6 tables; hidden tests unreachable from clients; JWT checked twice on every Edge Function; per-user limits; prompt-injection hardening; CSP and security headers; 0 npm vulnerabilities; no secrets in the client bundle. Open items are listed there (email sign-ups, third-party data flows, public sandbox SLA).

## 7. Local run
```bash
npm install && cp .env.example .env.local   # add the two public Supabase values
npm run dev                                  # http://localhost:3000
```
Google sign-in needs step A2/A3; AI needs A1.

## 8. Files
README · PROJECT_SPEC · FEATURE_MATRIX · ARCHITECTURE · DATABASE · SECURITY · TEST_REPORT · DEPLOYMENT · DECISIONS · IMPLEMENTATION_PLAN · PROJECT_STATE · `.env.example` · `netlify.toml` · `.github/workflows/ci.yml`
