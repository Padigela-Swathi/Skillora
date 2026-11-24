-- Skillora DB authorisation test-suite. Run against the real project (Supabase execute_sql / psql).
-- Creates two throw-away users, exercises anon / owner / non-owner / escalation paths under the REAL roles
-- (set local role + JWT claims), then deletes the users. Output: one row per assertion; any ok=false is a failure.
delete from auth.users where email like '%@skillora-dbtest.invalid';

create or replace function pg_temp.try(p_sql text, p_role text, p_uid uuid default null) returns text
language plpgsql as $f$
declare n bigint; res text;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then json_build_object('role', p_role)::text
         else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql; get diagnostics n = row_count; res := 'OK:' || n;
  exception when others then res := 'ERR:' || sqlstate || ':' || sqlerrm; end;
  reset role;
  return res;
end $f$;

create or replace function pg_temp.q(p_sql text, p_role text, p_uid uuid default null) returns text
language plpgsql as $f$
declare res text;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then json_build_object('role', p_role)::text
         else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
  begin execute p_sql into res; exception when others then res := 'ERR:' || sqlstate || ':' || sqlerrm; end;
  reset role;
  return res;
end $f$;

create temp table r(n serial, name text, ok boolean, detail text);
create or replace function pg_temp.chk(p_name text, p_ok boolean, p_detail text default '') returns void
language sql as $f$ insert into r(name, ok, detail) values (p_name, coalesce(p_ok,false), p_detail) $f$;

do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  ia uuid; ib uuid; qa1 uuid; qa2 uuid; qa3 uuid; qb1 uuid; ia2 uuid; v text;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@skillora-dbtest.invalid','{"full_name":"User A"}',now(),now()),
         (b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@skillora-dbtest.invalid','{"full_name":"User B"}',now(),now());

  perform pg_temp.chk('trigger created both profiles', (select count(*) from public.profiles where id in (a,b)) = 2);
  perform pg_temp.chk('profile name copied from Google metadata', (select full_name from public.profiles where id = a) = 'User A');

  -- ── anon ──
  -- privilege matrix: Edge Functions (service_role) must work; clients must not have more than intended
  perform pg_temp.chk('service_role can read/write every table the Edge Functions use',
    (select bool_and(has_table_privilege('service_role', 'public.' || t, 'select') and has_table_privilege('service_role', 'public.' || t, 'insert') and has_table_privilege('service_role', 'public.' || t, 'update'))
       from unnest(array['profiles','interviews','interview_questions','question_private','code_runs','feedback_ratings']) t));
  perform pg_temp.chk('anon has NO privilege on any app table',
    (select bool_and(not has_any_column_privilege('anon', 'public.' || t, 'select,insert,update,references'))
       from unnest(array['profiles','interviews','interview_questions','question_private','code_runs','feedback_ratings']) t));
  perform pg_temp.chk('authenticated has no insert/delete on interview data tables',
    (select bool_and(not has_table_privilege('authenticated', 'public.' || t, 'insert') and not has_table_privilege('authenticated', 'public.' || t, 'delete'))
       from unnest(array['profiles','interviews','interview_questions','question_private','code_runs']) t));

  perform pg_temp.chk('anon cannot select profiles',   pg_temp.try('select * from public.profiles','anon') like 'ERR:42501%');
  perform pg_temp.chk('anon cannot select interviews', pg_temp.try('select * from public.interviews','anon') like 'ERR:42501%');
  perform pg_temp.chk('anon cannot select questions',  pg_temp.try('select * from public.interview_questions','anon') like 'ERR:42501%');
  perform pg_temp.chk('anon cannot select question_private', pg_temp.try('select * from public.question_private','anon') like 'ERR:42501%');
  perform pg_temp.chk('anon cannot call submit_answer', pg_temp.try('select public.submit_answer(gen_random_uuid(),''skip'')','anon') like 'ERR:42501%');
  perform pg_temp.chk('anon cannot call accept_terms', pg_temp.try('select public.accept_terms(''2026-11-20'')','anon') like 'ERR:42501%');
  perform pg_temp.chk('anon cannot call reserve_interview', pg_temp.try(format('select public.reserve_interview(%L,''hr'',''Easy'',5::smallint,3::smallint)',a),'anon') like 'ERR:42501%');

  -- ── profiles ──
  perform pg_temp.chk('A sees only own profile', pg_temp.q('select count(*)::text from public.profiles','authenticated',a) = '1');
  perform pg_temp.chk('A cannot update B profile (0 rows)', pg_temp.try(format('update public.profiles set full_name=''hacked'' where id=%L',b),'authenticated',a) = 'OK:0');
  perform pg_temp.chk('B profile unchanged', (select full_name from public.profiles where id=b) = 'User B');
  perform pg_temp.chk('A can update own profile', pg_temp.try(format('update public.profiles set full_name=''Alice'', college=''MVSR'', branch=''CSE'', year_of_study=''4th year'', age=21 where id=%L',a),'authenticated',a) = 'OK:1');
  perform pg_temp.chk('A cannot write terms_version directly', pg_temp.try(format('update public.profiles set terms_version=''2026-11-20'' where id=%L',a),'authenticated',a) like 'ERR:42501%');
  perform pg_temp.chk('A cannot change profile id (escalation)', pg_temp.try(format('update public.profiles set id=%L where id=%L',b,a),'authenticated',a) like 'ERR:42501%');
  perform pg_temp.chk('invalid branch rejected by constraint', pg_temp.try(format('update public.profiles set branch=''MECH'' where id=%L',a),'authenticated',a) like 'ERR:23514%');
  perform pg_temp.chk('age out of range rejected', pg_temp.try(format('update public.profiles set age=5 where id=%L',a),'authenticated',a) like 'ERR:23514%');
  perform pg_temp.chk('A cannot insert a profile', pg_temp.try(format('insert into public.profiles(id) values (%L)',gen_random_uuid()),'authenticated',a) like 'ERR:42501%');
  perform pg_temp.chk('A cannot delete a profile', pg_temp.try(format('delete from public.profiles where id=%L',a),'authenticated',a) like 'ERR:42501%');
  v := pg_temp.try('select public.accept_terms(''2026-11-20'')','authenticated',a);   -- run first: sub-selects in one expression are evaluated before the call
  perform pg_temp.chk('accept_terms works for self only',
    v = 'OK:1' and (select terms_version from public.profiles where id=a) = '2026-11-20'
    and (select terms_version from public.profiles where id=b) is null);
  perform pg_temp.chk('accept_terms rejects malformed version', pg_temp.try('select public.accept_terms(''latest'')','authenticated',a) like 'ERR:23514%');

  -- ── slot reservation + daily limit ──
  perform pg_temp.chk('authenticated cannot call reserve_interview', pg_temp.try(format('select public.reserve_interview(%L,''hr'',''Easy'',5::smallint,3::smallint)',a),'authenticated',a) like 'ERR:42501%');
  perform pg_temp.chk('authenticated cannot insert interview directly', pg_temp.try(format('insert into public.interviews(user_id,round,level,duration_min,question_count) values (%L,''hr'',''Easy'',5,3)',a),'authenticated',a) like 'ERR:42501%');
  ia2 := public.reserve_interview(a,'hr','Easy',5::smallint,3::smallint);
  perform pg_temp.chk('second reserve blocked while generation in progress', pg_temp.try(format('select public.reserve_interview(%L,''hr'',''Easy'',5::smallint,3::smallint)',a),'service_role') like 'ERR:P0001:GENERATION_IN_PROGRESS%');
  update public.interviews set status='failed' where id=ia2;
  perform pg_temp.chk('failed interview is not counted', (pg_temp.q('select public.daily_usage()->>''used''','authenticated',a)) = '0');
  ia := public.reserve_interview(a,'hr','Easy',5::smallint,3::smallint);
  update public.interviews set status='in_progress', started_at=now() where id=ia;
  ib := public.reserve_interview(b,'tech','Medium',10::smallint,6::smallint);
  update public.interviews set status='in_progress', started_at=now() where id=ib;
  insert into public.interview_questions(interview_id,user_id,position,kind,question_text) values
    (ia,a,1,'spoken','Tell me about yourself.'),(ia,a,2,'spoken','Why do you want this job?'),(ia,a,3,'spoken','Where do you see yourself?'),
    (ib,b,1,'spoken','B question one');
  select id into qa1 from public.interview_questions where interview_id=ia and position=1;
  select id into qa2 from public.interview_questions where interview_id=ia and position=2;
  select id into qa3 from public.interview_questions where interview_id=ia and position=3;
  select id into qb1 from public.interview_questions where interview_id=ib and position=1;
  insert into public.question_private(question_id,user_id,tests) values (qa1,a,'[{"input":"1","expected":"2"}]');
  -- fill the day up to the limit with two more counted interviews
  insert into public.interviews(user_id,round,level,duration_min,question_count,status,created_at) select a,'hr','Easy',5,3,'completed', now() + interval '1 second' from generate_series(1,2);
  perform pg_temp.chk('daily_usage counts 3 for A', pg_temp.q('select public.daily_usage()->>''used''','authenticated',a) = '3');
  perform pg_temp.chk('4th interview rejected with DAILY_LIMIT', pg_temp.try(format('select public.reserve_interview(%L,''hr'',''Easy'',5::smallint,3::smallint)',a),'service_role') like 'ERR:P0001:DAILY_LIMIT%');
  perform pg_temp.chk('B unaffected by A limit', pg_temp.q('select public.daily_usage()->>''used''','authenticated',b) = '1');

  -- ── interviews / questions isolation ──
  perform pg_temp.chk('A sees only own interviews', pg_temp.q('select count(*)::text from public.interviews where user_id <> auth.uid()','authenticated',a) = '0');
  perform pg_temp.chk('A cannot see B questions', pg_temp.q(format('select count(*)::text from public.interview_questions where id=%L',qb1),'authenticated',a) = '0');
  perform pg_temp.chk('A cannot read question_private', pg_temp.try('select * from public.question_private','authenticated',a) like 'ERR:42501%');
  perform pg_temp.chk('A cannot update own score', pg_temp.try(format('update public.interviews set score=100 where id=%L',ia),'authenticated',a) like 'ERR:42501%');
  perform pg_temp.chk('A cannot update question score/transcript', pg_temp.try(format('update public.interview_questions set score=100 where id=%L',qa1),'authenticated',a) like 'ERR:42501%');
  perform pg_temp.chk('A cannot delete interview', pg_temp.try(format('delete from public.interviews where id=%L',ia),'authenticated',a) like 'ERR:42501%');

  -- ── submit_answer ──
  perform pg_temp.chk('A cannot answer B question (NOT_FOUND)', pg_temp.try(format('select public.submit_answer(%L,''answer'',''hello'')',qb1),'authenticated',a) like 'ERR:P0001:NOT_FOUND%');
  perform pg_temp.chk('empty answer rejected', pg_temp.try(format('select public.submit_answer(%L,''answer'',''   '')',qa1),'authenticated',a) like 'ERR:P0001:EMPTY_ANSWER%');
  perform pg_temp.chk('invalid action rejected', pg_temp.try(format('select public.submit_answer(%L,''hack'',''x'')',qa1),'authenticated',a) like 'ERR:P0001:INVALID_ACTION%');
  perform pg_temp.chk('code on spoken question rejected', pg_temp.try(format('select public.submit_answer(%L,''answer'',''x'',''python'',''print(1)'')',qa1),'authenticated',a) like 'ERR:P0001:INVALID_CODE%');
  perform pg_temp.chk('A answers own question', pg_temp.q(format('select public.submit_answer(%L,''answer'',''I am Alice'')->>''answered''',qa1),'authenticated',a) = '1');
  perform pg_temp.chk('double submit rejected', pg_temp.try(format('select public.submit_answer(%L,''answer'',''again'')',qa1),'authenticated',a) like 'ERR:P0001:ALREADY_SUBMITTED%');
  perform pg_temp.chk('A skips own question', pg_temp.q(format('select public.submit_answer(%L,''skip'')->>''skipped''',qa2),'authenticated',a) = '1');
  perform pg_temp.chk('counters consistent', (select answered_count=1 and skipped_count=1 from public.interviews where id=ia));
  update public.interviews set started_at = now() - interval '40 minutes' where id=ia;
  perform pg_temp.chk('answer after time limit rejected (TIME_UP)', pg_temp.try(format('select public.submit_answer(%L,''answer'',''late'')',qa3),'authenticated',a) like 'ERR:P0001:TIME_UP%');
  update public.interviews set started_at = now() where id=ia;

  -- ── finish_interview ──
  perform pg_temp.chk('B cannot finish A interview', pg_temp.try(format('select public.finish_interview(%L,true)',ia),'authenticated',b) like 'ERR:P0001:NOT_FOUND%');
  perform pg_temp.chk('B with 0 answers => abandoned', pg_temp.q(format('select public.finish_interview(%L,true)->>''status''',ib),'authenticated',b) = 'abandoned');
  perform pg_temp.chk('abandoned frees the daily allowance', pg_temp.q('select public.daily_usage()->>''used''','authenticated',b) = '0');
  v := pg_temp.q(format('select public.finish_interview(%L,true)->>''status''',ia),'authenticated',a);
  perform pg_temp.chk('A quit => processing + ended_early', v = 'processing' and (select ended_early from public.interviews where id=ia));
  perform pg_temp.chk('finish is idempotent', pg_temp.q(format('select public.finish_interview(%L,true)->>''status''',ia),'authenticated',a) = 'processing');
  perform pg_temp.chk('answer after finish rejected', pg_temp.try(format('select public.submit_answer(%L,''answer'',''x'')',qa3),'authenticated',a) like 'ERR:P0001:INTERVIEW_NOT_ACTIVE%');

  -- ── ratings ──
  perform pg_temp.chk('rating on non-completed interview rejected by RLS', pg_temp.try(format('insert into public.feedback_ratings(interview_id,user_id,stars) values (%L,%L,5)',ia,a),'authenticated',a) like 'ERR:42501%');
  update public.interviews set status='completed', score=70 where id=ia;
  perform pg_temp.chk('rating_due true for 1st completed', pg_temp.q(format('select public.rating_due(%L)::text',ia),'authenticated',a) = 'true');
  perform pg_temp.chk('B cannot rate A interview', pg_temp.try(format('insert into public.feedback_ratings(interview_id,user_id,stars) values (%L,%L,5)',ia,b),'authenticated',b) like 'ERR:42501%');
  perform pg_temp.chk('A cannot impersonate B in rating', pg_temp.try(format('insert into public.feedback_ratings(interview_id,user_id,stars) values (%L,%L,5)',ia,b),'authenticated',a) like 'ERR:42501%');
  perform pg_temp.chk('stars=6 rejected', pg_temp.try(format('insert into public.feedback_ratings(interview_id,user_id,stars) values (%L,%L,6)',ia,a),'authenticated',a) like 'ERR:23514%');
  perform pg_temp.chk('A rates own completed interview', pg_temp.try(format('insert into public.feedback_ratings(interview_id,user_id,stars,comment) values (%L,%L,4,''ok'')',ia,a),'authenticated',a) = 'OK:1');
  perform pg_temp.chk('duplicate rating rejected', pg_temp.try(format('insert into public.feedback_ratings(interview_id,user_id,stars) values (%L,%L,3)',ia,a),'authenticated',a) like 'ERR:23505%');
  perform pg_temp.chk('rating cannot be updated', pg_temp.try(format('update public.feedback_ratings set stars=1 where interview_id=%L',ia),'authenticated',a) like 'ERR:42501%');
  perform pg_temp.chk('rating cannot be deleted', pg_temp.try(format('delete from public.feedback_ratings where interview_id=%L',ia),'authenticated',a) like 'ERR:42501%');
  perform pg_temp.chk('B cannot see A rating', pg_temp.q('select count(*)::text from public.feedback_ratings','authenticated',b) = '0');
  perform pg_temp.chk('rating_due false once rated', pg_temp.q(format('select public.rating_due(%L)::text',ia),'authenticated',a) = 'false');

  -- ── code_runs ──
  insert into public.code_runs(user_id,interview_id,question_id,language,mode) values (a,ia,qa1,'python','run');
  perform pg_temp.chk('A cannot insert code_runs', pg_temp.try(format('insert into public.code_runs(user_id,interview_id,question_id,language,mode) values (%L,%L,%L,''c'',''run'')',a,ia,qa1),'authenticated',a) like 'ERR:42501%');
  perform pg_temp.chk('B cannot see A code_runs', pg_temp.q('select count(*)::text from public.code_runs','authenticated',b) = '0');

  -- ── start cap: quitting immediately is free, but start->quit loops are bounded (audit 2026-11-24) ──
  insert into public.interviews(user_id,round,level,duration_min,question_count,status,ended_at) select b,'hr','Easy',5,3,'abandoned',now() from generate_series(1,7);
  perform pg_temp.chk('abandoned interviews are not counted in daily_usage', pg_temp.q('select public.daily_usage()->>''used''','authenticated',b) = '1');
  perform pg_temp.chk('8 started interviews/day hard cap blocks start->quit loops', pg_temp.try(format('select public.reserve_interview(%L,''hr'',''Easy'',5::smallint,3::smallint)',b),'service_role') like 'ERR:P0001:DAILY_LIMIT%');
  perform pg_temp.chk('reserve_interview is still service-role only', pg_temp.try(format('select public.reserve_interview(%L,''hr'',''Easy'',5::smallint,3::smallint)',b),'authenticated',b) like 'ERR:42501%');

  -- ── cascade on account deletion ──
  delete from auth.users where id = a;
  perform pg_temp.chk('deleting auth user cascades everywhere', (select count(*) from public.profiles where id=a)
     + (select count(*) from public.interviews where user_id=a) + (select count(*) from public.interview_questions where user_id=a)
     + (select count(*) from public.question_private where user_id=a) + (select count(*) from public.code_runs where user_id=a)
     + (select count(*) from public.feedback_ratings where user_id=a) = 0);
  delete from auth.users where id = b;
end $t$;

select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed,
       coalesce(jsonb_agg(name order by n) filter (where not ok), '[]'::jsonb) as failures from r;
