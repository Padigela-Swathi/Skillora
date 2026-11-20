# Implementation plan

Status legend: ☐ not started · ◐ in progress · ☑ done (verified) · ⚠ done, verification limited (see TEST_REPORT)

## Phase gates
| Phase | Exit gate |
|---|---|
| 0 | Inputs inspected; spec/matrix/architecture/plan/decisions written; no ambiguity blocking safe work. |
| 1 | Migrations applied to the real Supabase project; RLS enabled on every public table; DB authorisation tests (anon / owner / non-owner / escalation) executed and passing; Edge Functions deployed; Supabase security advisors clean; `.env.example` written. |
| 2 | All 15 screens + states implemented in Next.js; `tsc --noEmit`, `eslint`, `next build` pass; responsive + a11y basics checked in a browser. |
| 3 | Every screen backed by real Supabase/Edge calls; journeys exercised in a real browser against the real project; no mocks/dead buttons. |
| 4 | Unit + DB + live integration + E2E suites run; screenshots compared with handoff PNGs; security audit; bugs fixed with regression tests; docs/handoff final; truthful status. |

## Tasks
| ID | Task | REQ | Depends | Verification | Status |
|---|---|---|---|---|---|
| T0.1 | Inspect repo, ZIP, MVP; probe NVIDIA, Judge0, Wandbox, Supabase | all | – | probes recorded in DECISIONS | ☑ |
| T0.2 | Write spec/matrix/architecture/plan/decisions/state | all | T0.1 | files exist | ☑ |
| T1.1 | Migration 001 core schema + RLS + grants | 003,004,017,019 | T0 | list_tables, advisors | ☑ |
| T1.2 | Migration 002 auth trigger, RPCs (accept_terms, submit_answer, finish_interview, daily_usage, rating_due, reserve_interview) | 003,009,017,018 | T1.1 | SQL tests | ☑ |
| T1.3 | DB authorisation test suite (`tests/db`) | 019 | T1.2 | run against project | ☑ |
| T1.4 | Shared Edge libs: nvidia, prompts, runner(Judge0/Wandbox), scoring, cors/auth | 008,011,012 | T1.2 | Vitest + live probes | ☑ |
| T1.5 | Edge Functions deploy: start-interview, run-code, evaluate-interview, delete-account | 008,011,012,016 | T1.4 | invoke with test JWT | ⚠ (needs NVIDIA secret) |
| T1.6 | `.env.example`, `supabase/config.toml`, DB types | – | T1.1 | tsc | ☑ |
| T2.1 | Scaffold Next.js, tokens, fonts, assets, base components | 020 | T0 | build | ☑ |
| T2.2 | Public screens: landing, signin, terms, declined, details | 001–004 | T2.1 | browser | ☑ |
| T2.3 | App shell + practice, device check, tips | 005–007 | T2.1 | browser | ☑ |
| T2.4 | Interview room (spoken + coding), generating | 009–011,013 | T2.1 | browser | ☑ |
| T2.5 | Feedback, history, settings | 013–016,018 | T2.1 | browser | ☑ |
| T3.1 | Auth flow (Google PKCE, callback, proxy, guards, terms/profile gating) | 002,003 | T1,T2 | E2E | ⚠ (Google needs dashboard config) |
| T3.2 | Wire profile, practice, interview, run-code, evaluate, history, rating, settings, delete | 004–018 | T3.1 | E2E | ⚠ |
| T4.1 | Unit + DB + live + E2E + screenshots | all | T3 | TEST_REPORT | ☑/⚠ |
| T4.2 | Security audit + fixes | 019 | T4.1 | SECURITY.md | ☑ |
| T4.3 | Docs + handoff + truthful status | all | T4.2 | HANDOFF.md | ☑ |
