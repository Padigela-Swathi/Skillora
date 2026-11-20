-- Skillora core schema. Fail-closed: RLS on, no anon access, clients are SELECT-only on interview data.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────── profiles ─────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  college text not null default '' check (char_length(college) <= 150),
  branch text check (branch in ('CSE','IT')),
  year_of_study text check (year_of_study in ('3rd year','4th year')),
  gender text check (gender in ('Prefer not to say','Female','Male','Non-binary')),
  age smallint check (age between 15 and 60),
  terms_version text check (terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- ───────────── interviews ─────────────
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round text not null check (round in ('hr','tech','code','mgr')),
  level text not null check (level in ('Easy','Medium','Hard')),
  duration_min smallint not null check (duration_min in (5,10,15)),
  question_count smallint not null check (question_count between 1 and 9),
  status text not null default 'generating'
    check (status in ('generating','in_progress','processing','completed','failed','abandoned')),
  ended_early boolean not null default false,
  answered_count smallint not null default 0 check (answered_count >= 0),
  skipped_count smallint not null default 0 check (skipped_count >= 0),
  score smallint check (score between 0 and 100),
  sub_scores jsonb,
  strengths jsonb,
  weaknesses jsonb,
  tips jsonb,
  error_message text check (char_length(error_message) <= 500),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  evaluated_at timestamptz,
  check (answered_count + skipped_count <= question_count)
);
create index interviews_user_created_idx on public.interviews (user_id, created_at desc);
create index interviews_user_status_idx on public.interviews (user_id, status);

-- ───────────── interview_questions ─────────────
create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position smallint not null check (position between 1 and 9),
  kind text not null check (kind in ('spoken','coding')),
  question_text text not null check (char_length(question_text) between 5 and 2000),
  topic text check (char_length(topic) <= 100),
  coding jsonb,                                  -- public part only: statement, formats, visible examples
  status text not null default 'pending' check (status in ('pending','answered','skipped')),
  transcript text check (char_length(transcript) <= 8000),
  code_language text check (code_language in ('python','java','cpp','c','javascript')),
  code_source text check (char_length(code_source) <= 20000),
  last_run jsonb,
  score smallint check (score between 0 and 100),
  went_well text check (char_length(went_well) <= 1500),
  to_improve text check (char_length(to_improve) <= 1500),
  stronger_answer text check (char_length(stronger_answer) <= 3000),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (interview_id, position),
  check (kind = 'coding' or coding is null)
);
create index interview_questions_user_idx on public.interview_questions (user_id);

-- Hidden test cases + nothing else. No client grants, no policies: only service_role / SECURITY DEFINER code can read it.
create table public.question_private (
  question_id uuid primary key references public.interview_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tests jsonb not null,
  created_at timestamptz not null default now()
);
create index question_private_user_idx on public.question_private (user_id);

-- ───────────── code_runs (audit + rate limit) ─────────────
create table public.code_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  interview_id uuid not null references public.interviews(id) on delete cascade,
  question_id uuid not null references public.interview_questions(id) on delete cascade,
  language text not null check (language in ('python','java','cpp','c','javascript')),
  mode text not null check (mode in ('compile','run')),
  compile_ok boolean,
  passed smallint,
  total smallint,
  provider text,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index code_runs_user_time_idx on public.code_runs (user_id, created_at desc);
create index code_runs_interview_idx on public.code_runs (interview_id);
create index code_runs_question_idx on public.code_runs (question_id);

-- ───────────── feedback_ratings ─────────────
create table public.feedback_ratings (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references public.interviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);
create index feedback_ratings_user_idx on public.feedback_ratings (user_id);

-- ───────────── RLS ─────────────
alter table public.profiles enable row level security;
alter table public.interviews enable row level security;
alter table public.interview_questions enable row level security;
alter table public.question_private enable row level security;
alter table public.code_runs enable row level security;
alter table public.feedback_ratings enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy interviews_select_own on public.interviews for select to authenticated using (user_id = (select auth.uid()));
create policy questions_select_own on public.interview_questions for select to authenticated using (user_id = (select auth.uid()));
create policy code_runs_select_own on public.code_runs for select to authenticated using (user_id = (select auth.uid()));
create policy ratings_select_own on public.feedback_ratings for select to authenticated using (user_id = (select auth.uid()));
create policy ratings_insert_own on public.feedback_ratings for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.interviews i
                where i.id = interview_id and i.user_id = (select auth.uid()) and i.status = 'completed')
  );
-- question_private: RLS enabled, deliberately NO policy.

-- ───────────── privileges (defence in depth beside RLS) ─────────────
revoke all on public.profiles, public.interviews, public.interview_questions, public.question_private,
              public.code_runs, public.feedback_ratings from anon, authenticated;
grant select on public.profiles, public.interviews, public.interview_questions, public.code_runs, public.feedback_ratings to authenticated;
grant update (full_name, college, branch, year_of_study, gender, age) on public.profiles to authenticated;
grant insert (interview_id, user_id, stars, comment) on public.feedback_ratings to authenticated;
-- (service_role keeps its default full privileges for Edge Functions)
