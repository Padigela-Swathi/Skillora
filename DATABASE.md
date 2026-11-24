# Database

PostgreSQL 17 on Supabase (project `kqqkowftmlysomzlzzta`, ap-south-1). Migrations live in `supabase/migrations` and are applied in order:

| Migration | Purpose |
|---|---|
| `20261120000001_core_schema.sql` | Tables, constraints, indexes, RLS policies, column-level grants |
| `20261120000002_functions.sql` | Auth trigger and the server-side interview state machine (RPCs) |
| `20261120000003_grant_service_role.sql` | Explicit table grants for `service_role` (this project does not auto-grant) |

## Tables (all in `public`, all RLS-enabled, no `anon` privileges)
| Table | Purpose | Client access (authenticated) |
|---|---|---|
| `profiles` (PK = `auth.users.id`) | name, college, branch (CSE/IT), year (3rd/4th), gender?, age? (15–60), `terms_version`, `terms_accepted_at` | SELECT own; UPDATE only `full_name, college, branch, year_of_study, gender, age` of own row |
| `interviews` | round, level, duration (5/10/15), question_count, `status`, counts, `score`, `sub_scores`, `strengths/weaknesses/tips` (jsonb), timestamps | SELECT own only |
| `interview_questions` | position, kind (spoken/coding), text, public `coding` json (statement, formats, **visible** examples, starter code), answer fields, per-question feedback | SELECT own only |
| `question_private` | **hidden test cases** (input/expected) | none: RLS on, no policy, no grants |
| `code_runs` | audit + rate-limit log of compile/run calls | SELECT own only |
| `feedback_ratings` | 1–5 stars + comment, unique per interview | SELECT own; INSERT own for own **completed** interview; no update/delete |

Every row carries `user_id` → `auth.users(id) ON DELETE CASCADE`, so deleting the auth user removes all data (verified by test).
CHECK constraints enforce enumerations and ranges; `interviews` also enforces `answered + skipped <= question_count`.

## Interview status machine
`generating` → `in_progress` → `processing` → `completed`  ·  `in_progress` → `abandoned` (0 answers)  ·  `generating` → `failed` (AI/DB error; not counted)
Clients cannot write these tables; transitions happen in SECURITY DEFINER functions or Edge Functions (service role).

## Functions
| Function | Caller | What it enforces |
|---|---|---|
| `handle_new_user()` trigger | Auth | creates the profile row (name from Google metadata) |
| `accept_terms(version)` | authenticated | own row only; version must match `YYYY-MM-DD` |
| `daily_usage()` | authenticated | used/limit/reset (IST day) for `auth.uid()` |
| `reserve_interview(...)` | **service_role only** | advisory lock per user, blocks double-click generation, enforces 3 counted/day (failed/abandoned excluded) **and** a hard cap of 8 started (non-failed) and 15 total attempts per IST day, so start→quit loops cannot be used to spend AI quota |
| `submit_answer(question, action, transcript?, lang?, code?)` | authenticated | ownership, interview `in_progress`, question `pending`, not past `duration+5 min`, non-empty answer, code only on coding questions |
| `finish_interview(id, quit)` | authenticated | ownership; idempotent; 0 answers → `abandoned`; else `processing` (+ `ended_early`) |
| `rating_due(id)` | authenticated | completed, unrated, and ordinal 1, 6, 11… |

All functions use `SET search_path = ''` and fully-qualified names; `EXECUTE` is revoked from `PUBLIC`/`anon` and granted explicitly.

## Regenerating types
`src/lib/database.types.ts` is a compact mirror of the generated types. Regenerate with `supabase gen types typescript --project-id <ref>` after schema changes.
