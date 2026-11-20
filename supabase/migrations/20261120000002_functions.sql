-- Server-side state machine. Clients never write interview rows directly.

-- Auto-create a profile row when a Google user signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 100))
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Terms acceptance (version is defined in application code).
create or replace function public.accept_terms(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  update public.profiles set terms_version = p_version, terms_accepted_at = now() where id = auth.uid();
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- Start of the current day in India.
create or replace function public.ist_day_start() returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
$$;

-- Daily usage for the signed-in user.
create or replace function public.daily_usage() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_used int;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select count(*) into v_used from public.interviews
   where user_id = auth.uid() and created_at >= public.ist_day_start() and status not in ('failed','abandoned');
  return jsonb_build_object('used', v_used, 'limit', 3, 'resets_at', public.ist_day_start() + interval '1 day');
end $$;

-- Atomically reserve an interview slot (limit 3/day). service_role only (called by Edge Function start-interview).
create or replace function public.reserve_interview(p_user uuid, p_round text, p_level text, p_duration smallint, p_count smallint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_used int; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  -- A generation that started in the last 3 minutes blocks double-clicks.
  if exists (select 1 from public.interviews where user_id = p_user and status = 'generating' and created_at > now() - interval '3 minutes') then
    raise exception 'GENERATION_IN_PROGRESS';
  end if;
  -- Stale rows left by crashed generations are closed so they do not count.
  update public.interviews set status = 'failed', error_message = 'Generation timed out'
   where user_id = p_user and status = 'generating' and created_at <= now() - interval '3 minutes';
  select count(*) into v_used from public.interviews
   where user_id = p_user and created_at >= public.ist_day_start() and status not in ('failed','abandoned');
  if v_used >= 3 then raise exception 'DAILY_LIMIT'; end if;
  insert into public.interviews (user_id, round, level, duration_min, question_count)
  values (p_user, p_round, p_level, p_duration, p_count) returning id into v_id;
  return v_id;
end $$;

-- Record an answer or a skip. Ownership, state and time are enforced here, not in the UI.
create or replace function public.submit_answer(
  p_question_id uuid, p_action text,
  p_transcript text default null, p_code_language text default null, p_code_source text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  q public.interview_questions;
  iv public.interviews;
  v_pending int;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_action not in ('answer','skip') then raise exception 'INVALID_ACTION'; end if;

  select * into q from public.interview_questions where id = p_question_id and user_id = v_uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into iv from public.interviews where id = q.interview_id and user_id = v_uid for update;
  if iv.status <> 'in_progress' then raise exception 'INTERVIEW_NOT_ACTIVE'; end if;
  if q.status <> 'pending' then raise exception 'ALREADY_SUBMITTED'; end if;
  if now() > iv.started_at + make_interval(mins => iv.duration_min + 5) then raise exception 'TIME_UP'; end if;

  if p_action = 'answer' then
    if btrim(coalesce(p_transcript, '')) = '' and btrim(coalesce(p_code_source, '')) = '' then
      raise exception 'EMPTY_ANSWER';
    end if;
    if p_code_source is not null and btrim(p_code_source) <> '' and (q.kind <> 'coding' or p_code_language is null) then
      raise exception 'INVALID_CODE';
    end if;
    update public.interview_questions
       set status = 'answered', transcript = nullif(btrim(coalesce(p_transcript, '')), ''),
           code_language = case when q.kind = 'coding' then p_code_language end,
           code_source = case when q.kind = 'coding' then nullif(p_code_source, '') end,
           answered_at = now()
     where id = q.id;
    update public.interviews set answered_count = answered_count + 1 where id = iv.id;
  else
    update public.interview_questions set status = 'skipped' where id = q.id;
    update public.interviews set skipped_count = skipped_count + 1 where id = iv.id;
  end if;

  select count(*) into v_pending from public.interview_questions where interview_id = iv.id and status = 'pending';
  select * into iv from public.interviews where id = iv.id;
  return jsonb_build_object('answered', iv.answered_count, 'skipped', iv.skipped_count, 'remaining', v_pending);
end $$;

-- Finish (done / time-up / quit). Idempotent. 0 answers => abandoned (not counted, no feedback).
create or replace function public.finish_interview(p_interview_id uuid, p_quit boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); iv public.interviews;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into iv from public.interviews where id = p_interview_id and user_id = v_uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if iv.status <> 'in_progress' then
    return jsonb_build_object('status', iv.status);      -- idempotent
  end if;
  if iv.answered_count = 0 then
    update public.interviews set status = 'abandoned', ended_at = now() where id = iv.id;
    return jsonb_build_object('status', 'abandoned');
  end if;
  update public.interviews
     set status = 'processing', ended_at = now(),
         ended_early = coalesce(p_quit, false) and (answered_count + skipped_count < question_count)
   where id = iv.id;
  return jsonb_build_object('status', 'processing');
end $$;

-- Should the 1-5 star rating card be shown? After the 1st completed interview, then every 5th.
create or replace function public.rating_due(p_interview_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); iv public.interviews; v_ord int;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into iv from public.interviews where id = p_interview_id and user_id = v_uid;
  if not found or iv.status <> 'completed' then return false; end if;
  if exists (select 1 from public.feedback_ratings where interview_id = iv.id) then return false; end if;
  select count(*) into v_ord from public.interviews
   where user_id = v_uid and status = 'completed' and created_at <= iv.created_at;
  return (v_ord - 1) % 5 = 0;
end $$;

-- ───────────── execute privileges ─────────────
revoke all on function public.accept_terms(text), public.daily_usage(), public.submit_answer(uuid,text,text,text,text),
  public.finish_interview(uuid,boolean), public.rating_due(uuid), public.ist_day_start(),
  public.reserve_interview(uuid,text,text,smallint,smallint), public.set_updated_at() from public, anon, authenticated;
grant execute on function public.accept_terms(text), public.daily_usage(), public.submit_answer(uuid,text,text,text,text),
  public.finish_interview(uuid,boolean), public.rating_due(uuid), public.ist_day_start() to authenticated;
grant execute on function public.reserve_interview(uuid,text,text,smallint,smallint), public.ist_day_start() to service_role;
