-- Admin "reach" dashboard: how far the app has reached users (sign-ups, activity, colleges).
-- Admins are listed in public.admins. The table has RLS on, no policies and no client grants, so it cannot be read or
-- written from the browser. Only the SECURITY DEFINER functions below (and service_role / the SQL editor) touch it.
-- Add an admin from the Supabase SQL editor:
--   insert into public.admins (user_id) select id from auth.users where email = '<admin email>';

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant select, insert, update, delete on public.admins to service_role;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;

-- Aggregate numbers only: no names, emails or any single user's data leave this function.
create or replace function public.admin_reach_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_today date := (public.ist_day_start() at time zone 'Asia/Kolkata')::date;   -- today's date in India
  v_since timestamptz := public.ist_day_start() - interval '29 days';            -- start of the 30-day chart window
  v_users jsonb; v_active jsonb; v_interviews jsonb; v_series jsonb; v_colleges jsonb; v_branches jsonb; v_years jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  select jsonb_build_object(
    'total', count(*),
    'onboarded', count(*) filter (where terms_version is not null and btrim(full_name) <> '' and btrim(college) <> ''
                                    and branch is not null and year_of_study is not null),
    'new_24h', count(*) filter (where created_at >= v_now - interval '24 hours'),
    'new_7d', count(*) filter (where created_at >= v_now - interval '7 days'),
    'new_30d', count(*) filter (where created_at >= v_now - interval '30 days'),
    'first_signup_at', min(created_at)
  ) into v_users from public.profiles;

  -- Practised = started an interview (failed generations excluded). Signed in = last Google sign-in.
  select jsonb_build_object(
    'practised_24h', count(distinct user_id) filter (where created_at >= v_now - interval '24 hours'),
    'practised_7d', count(distinct user_id) filter (where created_at >= v_now - interval '7 days'),
    'practised_30d', count(distinct user_id) filter (where created_at >= v_now - interval '30 days'),
    'practised_ever', count(distinct user_id),
    'signed_in_7d', (select count(*) from auth.users where last_sign_in_at >= v_now - interval '7 days'),
    'signed_in_30d', (select count(*) from auth.users where last_sign_in_at >= v_now - interval '30 days')
  ) into v_active from public.interviews where status <> 'failed';

  select jsonb_build_object(
    'started', count(*),
    'completed', count(*) filter (where status = 'completed'),
    'avg_score', round(avg(score) filter (where status = 'completed'))::int,
    'by_round', coalesce((select jsonb_object_agg(round, n) from
                            (select round, count(*) n from public.interviews where status <> 'failed' group by round) r), '{}'),
    'rating_count', (select count(*) from public.feedback_ratings),
    'rating_avg', (select round(avg(stars), 1) from public.feedback_ratings)
  ) into v_interviews from public.interviews where status <> 'failed';

  -- One row per Indian calendar day for the last 30 days (days with no activity are 0, not missing).
  select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'signups', coalesce(s.n, 0), 'practised', coalesce(p.n, 0)) order by d.day), '[]')
    into v_series
    from (select v_today - g as day from generate_series(0, 29) g) d
    left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*) n
                 from public.profiles where created_at >= v_since group by 1) s on s.day = d.day
    left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(distinct user_id) n
                 from public.interviews where status <> 'failed' and created_at >= v_since group by 1) p on p.day = d.day;

  -- College is free text, so spelling variants are folded by lower-casing and trimming.
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'users', n) order by n desc, name), '[]') into v_colleges
    from (select min(btrim(college)) as name, count(*) n from public.profiles where btrim(college) <> ''
          group by lower(btrim(college)) order by n desc, 1 limit 10) c;
  v_users := v_users || jsonb_build_object('colleges', (select count(distinct lower(btrim(college))) from public.profiles where btrim(college) <> ''));

  select coalesce(jsonb_object_agg(branch, n), '{}') into v_branches
    from (select branch, count(*) n from public.profiles where branch is not null group by branch) b;
  select coalesce(jsonb_object_agg(year_of_study, n), '{}') into v_years
    from (select year_of_study, count(*) n from public.profiles where year_of_study is not null group by year_of_study) y;

  return jsonb_build_object('generated_at', v_now, 'users', v_users, 'activity', v_active, 'interviews', v_interviews,
                            'daily', v_series, 'top_colleges', v_colleges, 'branches', v_branches, 'years', v_years);
end $$;

revoke all on function public.is_admin(), public.admin_reach_stats() from public, anon, authenticated;
grant execute on function public.is_admin(), public.admin_reach_stats() to authenticated;
