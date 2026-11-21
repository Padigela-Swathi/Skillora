# Project state (checkpoint)

Branch `buildtheory/sharp-darwin-enkg5v`, Supabase project `kqqkowftmlysomzlzzta`.
Phases 0-4 complete; status = IMPLEMENTED WITH DOCUMENTED LIMITATIONS (see HANDOFF.md, TEST_REPORT.md).

## Remaining (needs the user or a Supabase confirmation prompt)
- Re-run the 66-check DB suite in the SQL editor (the Supabase tool prompts on `delete`). E2E fixtures/specs were re-run: desktop 26/26, mobile 26/26. Edge Functions are redeployed (v2).
- NVIDIA_API_KEY secret, Google OAuth, disable Email signups, redeploy Edge Functions from repo, Netlify env (HANDOFF.md checklist).
- NVIDIA secret is set and the deployed AI path is verified (HR 82, Coding 93). Remaining unverified: Google OAuth round trip (user is creating the OAuth client), voice with a real mic.

## Tooling notes
Production server on :3100 via `<scratchpad>/restart.sh build` (kill by PID; `pkill` misses next-server). Playwright needs `NODE_USE_ENV_PROXY=1` and .env.local (gitignored). Test users: e2e-a/b/c@skillora-test.invalid; C is deleted by the mobile onboarding run (recreate with tests/e2e/seed.sql).
