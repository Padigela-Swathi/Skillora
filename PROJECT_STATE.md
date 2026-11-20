# Project state (checkpoint)

Branch `buildtheory/sharp-darwin-enkg5v`. Supabase project `kqqkowftmlysomzlzzta`. Last commit pushed: 90fe5fc (Phase 0/1 backend). Everything since (frontend, E2E, migration 003) is UNCOMMITTED.

## Verified
- DB: migrations 001-003 applied; `tests/db/rls_authorization.sql` 63/63 (+3 privilege checks run ad hoc).
- Edge Functions deployed + exercised over real HTTP with real JWTs: run-code (5 languages, real Judge0), start-interview (terms/profile gating, validation, AI_NOT_CONFIGURED w/o consuming allowance), evaluate-interview (ownership, state, error recorded), delete-account.
- Unit 42/42; live NVIDIA + Judge0/Wandbox tests pass.
- Next.js app: tsc, eslint (0), `next build` pass (16 routes).
- Playwright desktop: 19/21 passed in the last full run; the 2 failures were fixture hygiene (rating already stored; onboarding test typed an age the input truncates) — test fixed, fixtures need reset.

## BLOCKED right now
`execute_sql` asked the user to confirm `delete from public.feedback_ratings where interview_id in (...0010, ...0015)` (test fixtures only) and timed out. Do not retry until the user replies. It is needed to make the rating E2E re-runnable.

## Next actions
1. After approval: delete the 1 stored test rating, re-run full Playwright on desktop, then mobile (reset live fixtures first: tests/e2e/reset-live.sql; user C already rewound).
2. Compare remaining screenshots with handoff PNGs (terms, details, practice, device, tips, feedback, history, settings, mobile set).
3. Phase 4 docs: FEATURE_MATRIX, DATABASE, SECURITY, TEST_REPORT, DEPLOYMENT (netlify.toml), HANDOFF, README. Update DECISIONS (fallback model chain, Google disabled, email provider enabled risk).
4. Request NVIDIA_API_KEY secret via create_edge_function_secret (user enters value in dashboard) at the very end and, if given, run live start-interview/evaluate E2E.
5. Cleanup test users/fixtures at the end (needs deletes -> user confirmation).

## Manual items for the founders
Enable Google provider + OAuth client + redirect URLs; set NVIDIA_API_KEY secret; disable Email signups in production (anyone with the anon key can otherwise create email accounts, bypassing "Google only" and multiplying AI usage); legal contact email + legal review; note Chrome's Web Speech API sends audio to Google (privacy text).

## Local tooling notes
Server: `<scratchpad>/restart.sh build` (kills stale next-server by PID; `pkill` does not match it). Tests need `NODE_USE_ENV_PROXY=1`; .env.local (gitignored) holds public Supabase URL/anon key, E2E_* vars.
