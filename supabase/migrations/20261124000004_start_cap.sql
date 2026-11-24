-- Security fix (audit 2026-11-24): the 3/day limit ignored 'abandoned' interviews, and finish_interview with 0 answers marks an
-- interview 'abandoned'. start -> quit -> start could therefore be looped without limit by one account, each loop spending
-- AI (NVIDIA) and code-sandbox quota. Quitting right away still does not cost one of the 3 slots, but the number of
-- interviews a user can START per day is now hard-capped, and so are all rows (failed ones included) to stop failure loops.
create or replace function public.reserve_interview(p_user uuid, p_round text, p_level text, p_duration smallint, p_count smallint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_used int; v_started int; v_all int; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  -- A generation that started in the last 3 minutes blocks double-clicks.
  if exists (select 1 from public.interviews where user_id = p_user and status = 'generating' and created_at > now() - interval '3 minutes') then
    raise exception 'GENERATION_IN_PROGRESS';
  end if;
  -- Stale rows left by crashed generations are closed so they do not count.
  update public.interviews set status = 'failed', error_message = 'Generation timed out'
   where user_id = p_user and status = 'generating' and created_at <= now() - interval '3 minutes';
  select count(*) filter (where status not in ('failed','abandoned')),   -- the user-visible daily allowance (3)
         count(*) filter (where status <> 'failed'),                      -- hard cap on interviews actually started (8)
         count(*)                                                         -- hard cap on all attempts incl. failed (15)
    into v_used, v_started, v_all
    from public.interviews where user_id = p_user and created_at >= public.ist_day_start();
  if v_used >= 3 or v_started >= 8 or v_all >= 15 then raise exception 'DAILY_LIMIT'; end if;
  insert into public.interviews (user_id, round, level, duration_min, question_count)
  values (p_user, p_round, p_level, p_duration, p_count) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.reserve_interview(uuid,text,text,smallint,smallint) from public, anon, authenticated;
grant execute on function public.reserve_interview(uuid,text,text,smallint,smallint) to service_role;
