# Project state (checkpoint)

Branch `buildtheory/sharp-darwin-enkg5v` (nothing committed yet — commits need the user's go-ahead). Supabase project `kqqkowftmlysomzlzzta`.

## Done & verified
- Phase 0 docs: PROJECT_SPEC, ARCHITECTURE, DECISIONS, IMPLEMENTATION_PLAN (FEATURE_MATRIX still to write).
- Phase 1 DB: migrations `20261120000001_core_schema.sql`, `…0002_functions.sql` applied to the project. `tests/db/rls_authorization.sql` = 63/63 pass against the real DB. Advisors: only intended INFO/WARN (question_private has no policy by design; SECURITY DEFINER RPCs are intentionally executable by `authenticated`).
- Shared Edge libs in `supabase/functions/_shared` (config, nvidia, prompts, runner, interview_gen, evaluate, http, auth, scoring, starters, hash). Unit tests 42/42 (`npx vitest run tests/unit`). Live tests (`NODE_USE_ENV_PROXY=1 LIVE_TESTS=1 npx vitest run tests/live`): Judge0 + Wandbox all 5 languages run/compile/timeout OK; NVIDIA live generation (incl. verified hidden tests), evaluation, injection resistance, model fallback chain OK.
- Edge Functions deployed: `delete-account`, `run-code` (smoke-tested: 401 without token / non-user JWT).

## Findings to remember
- `google/gemma-3-*` 404 on NVIDIA chat; `meta/llama-3.3-70b` EOL (410). Default `google/gemma-4-31b-it`, fallbacks `poolside/laguna-xs-2.1,minimaxai/minimax-m3.1-flash`.
- A SUPABASE_SERVICE_ROLE_KEY in the sandbox env belongs to ANOTHER project (ixgxtngx…) — never use.

## BLOCKED right now
- Supabase MCP `execute_sql` asked the user to confirm a statement containing `delete from auth.users` (seed of e2e test users, `tests/e2e/seed.sql`) and timed out unanswered. Do not retry until the user replies.

## Not yet done
- Deploy `start-interview`, `evaluate-interview` (code written in supabase/functions; needs NVIDIA_API_KEY secret to run end-to-end).
- Seed e2e users, E2E-test `run-code` with a real JWT.
- Phase 2/3: Next.js app (src/ is empty), assets copy, all screens, integration.
- Phase 4: Playwright, screenshots vs handoff, security docs, DATABASE/SECURITY/TEST_REPORT/DEPLOYMENT/HANDOFF/README, `.env.example`, FEATURE_MATRIX.
- Manual items for the founders: Google OAuth provider + redirect URLs, `NVIDIA_API_KEY` secret, legal contact email.
