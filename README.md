# Skillora

AI-powered mock-interview practice for 3rd/4th-year CSE and IT students: HR, Technical, Coding and Managerial rounds, spoken answers with a live transcript, a real code editor that compiles and runs in 5 languages, and an AI score with strengths, weaknesses and a stronger answer for every question.

**Stack:** Next.js 16 (App Router) · React 19 · strict TypeScript · Tailwind CSS 4 · Supabase (Postgres + RLS, Auth/Google, Edge Functions) · NVIDIA API for AI · Judge0 CE / Wandbox (free) for code execution · Netlify (prepared, not deployed).

## Quick start
```bash
npm install
cp .env.example .env.local        # fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                        # http://localhost:3000
```
Backend setup (migrations, Edge Functions, secrets, Google OAuth): **DEPLOYMENT.md**.

## Commands
| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` · `npm run lint` | strict TS · ESLint (0 problems expected) |
| `npm test` | unit tests (Vitest) |
| `npm run test:live` | real NVIDIA + Judge0/Wandbox calls (`NVIDIA_API_KEY` or an injected key; network required) |
| `npm run test:e2e` | Playwright, desktop 1440×900 + mobile 390×844 (needs a built app, a Supabase project and the fixtures in `tests/e2e`) |
| `E2E_DEV=1 E2E_PORT=3200 npx playwright test room-dev.spec.ts` | regression tests against a running `npm run dev` |
| `tests/db/rls_authorization.sql` | authorisation suite: run in the Supabase SQL editor |

## Repository map
- `src/app` routes · `src/components` UI · `src/lib` Supabase clients, helpers, speech, API wrapper
- `supabase/migrations` schema · `supabase/functions/{start-interview,run-code,evaluate-interview,delete-account}` + `_shared` (NVIDIA client, prompts, runner, scoring)
- `tests/{unit,live,db,e2e}`

## Documents
PROJECT_SPEC · FEATURE_MATRIX · ARCHITECTURE · DATABASE · SECURITY · TEST_REPORT · DEPLOYMENT · HANDOFF · DECISIONS · IMPLEMENTATION_PLAN · PROJECT_STATE
