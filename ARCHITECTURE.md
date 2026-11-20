# Architecture

```
Browser (Next.js on Netlify)
 ├─ SSR / RSC pages ──────────────► Supabase Auth (cookie session via @supabase/ssr) + PostgREST (RLS as the user)
 ├─ Client components ────────────► PostgREST (SELECT own rows, insert rating), RPC (submit_answer, finish_interview, accept_terms…)
 ├─ Web Speech API / MediaDevices   (all on-device: transcript, camera self-view, mic meter; nothing uploaded)
 └─ supabase.functions.invoke ────► Edge Functions (Deno, verify_jwt=true, user JWT forwarded)
        start-interview ──► NVIDIA API (question generation) ──► Judge0/Wandbox (verify reference solutions) ──► Postgres
        run-code        ──► Judge0 CE (primary) / Wandbox (fallback) ──► Postgres (code_runs, last_run)
        evaluate-interview ► NVIDIA API (scoring + feedback) ──► Postgres
        delete-account  ──► Auth admin deleteUser (cascades to all rows)
```

## Boundaries
- **Frontend**: Next.js App Router, strict TS, Tailwind v4 with the design tokens as CSS variables. Server components for data pages;
  client components only for interactive pieces (interview room, device check, forms). `proxy.ts` (Next 16 middleware) refreshes the
  session and redirects unauthenticated users; page-level checks re-verify with `supabase.auth.getUser()` (never trust the cookie alone).
- **Backend**: Supabase only. Authorisation is RLS + SECURITY DEFINER functions with explicit `auth.uid()` checks. Edge Functions are used
  only where server-side execution is necessary: holding the NVIDIA key, calling the code-execution provider, verifying tests, deleting the auth user.
- **Secrets**: `NVIDIA_API_KEY`, optional `JUDGE0_URL` / `JUDGE0_AUTH_TOKEN`, optional `ALLOWED_ORIGINS` are Edge Function secrets.
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected into functions by Supabase. The browser only ever gets the
  URL and publishable (anon) key.

## Data model (details in `DATABASE.md`)
`profiles` (1:1 auth.users) · `interviews` (user) · `interview_questions` (interview) · `question_private` (hidden tests; no client grants) ·
`code_runs` (audit + rate limit) · `feedback_ratings` (1:1 interview). Every row carries `user_id` and cascades from `auth.users`, so account deletion is one call.

## Interview lifecycle
`start-interview` → row `generating` (slot reserved atomically, daily limit) → questions saved → `in_progress` →
client calls `submit_answer` per question → `finish_interview` (quit/done/time-up) → `processing` →
`evaluate-interview` → `completed` (score, sub-scores, feedback) | `abandoned` (0 answers) | `failed` (generation failed, not counted).
Evaluation is idempotent and retryable (`processing` + `error_message`).

## Code execution flow
Client → `run-code {question_id, language, source, mode}` → verify JWT, ownership, interview `in_progress`, size/lang allow-list, rate limit
(`code_runs`) → provider (Judge0 CE → fallback Wandbox) → compare stdout to **hidden** tests (server only) → return per-test pass/fail
(expected output revealed only for the visible examples) → persist `code_runs` + `interview_questions.last_run`.

## Error handling / logging
Edge Functions return `{ error: { code, message } }` with stable codes (`AI_NOT_CONFIGURED`, `AI_UNAVAILABLE`, `DAILY_LIMIT`, `RUNNER_UNAVAILABLE`, …).
The UI maps codes to friendly, actionable messages with retry. Functions log structured lines without PII, code, or transcripts.

## Deployment
Netlify (Next.js runtime), env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`.
Supabase: migrations applied in order, Edge Functions deployed, Google provider + redirect URLs configured, secrets set. See `DEPLOYMENT.md`.

## Testing strategy
Vitest unit tests (scoring, validation, prompt/JSON parsing, runner comparison, legal-version sync); SQL RLS/authorisation tests executed against the
real Supabase project with `set role authenticated` + JWT claims (`tests/db`); live integration tests for NVIDIA + Judge0 (env-gated);
Playwright E2E (desktop + mobile) against the real Supabase project using seeded test sessions; screenshot comparison against the handoff PNGs.
