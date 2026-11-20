# Project state (checkpoint)

Branch `buildtheory/sharp-darwin-enkg5v`, Supabase project `kqqkowftmlysomzlzzta`.
Phases 0-4 complete; status = IMPLEMENTED WITH DOCUMENTED LIMITATIONS (see HANDOFF.md, TEST_REPORT.md).

## Remaining (needs the user or a Supabase confirmation prompt)
- Supabase `execute_sql` was waiting on a confirmation (it flags statements containing `delete`); until answered: re-run the 66-check DB suite, reset E2E fixtures (tests/e2e/reset-live.sql), re-run mobile a11y interview-room + both interview specs.
- NVIDIA_API_KEY secret, Google OAuth, disable Email signups, redeploy Edge Functions from repo, Netlify env (HANDOFF.md checklist).
- After the secret exists: run the deployed start-interview/evaluate-interview success path (open an interview, finish it, see the report) - the only unverified product path.

## Tooling notes
Production server on :3100 via `<scratchpad>/restart.sh build` (kill by PID; `pkill` misses next-server). Playwright needs `NODE_USE_ENV_PROXY=1` and .env.local (gitignored). Test users: e2e-a/b/c@skillora-test.invalid; C is deleted by the mobile onboarding run (recreate with tests/e2e/seed.sql).
