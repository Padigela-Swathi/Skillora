-- Resets the four live-interview fixtures (desktop/mobile main + quit) so interview.spec.ts can run again.
-- Update-only (no deletes). Run before each E2E run: the interview timer starts at started_at.
update public.interview_questions
   set status='pending', transcript=null, code_language=null, code_source=null, last_run=null, answered_at=null,
       score=null, went_well=null, to_improve=null, stronger_answer=null
 where interview_id in ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000101','aaaaaaaa-0000-4000-8000-000000000201','aaaaaaaa-0000-4000-8000-000000000301');
update public.interviews
   set status='in_progress', started_at=now(), ended_at=null, ended_early=false, answered_count=0, skipped_count=0,
       score=null, sub_scores=null, strengths=null, weaknesses=null, tips=null, error_message=null, evaluated_at=null
 where id in ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000101','aaaaaaaa-0000-4000-8000-000000000201','aaaaaaaa-0000-4000-8000-000000000301');

-- Makes the "rating due" fixtures (…0010 desktop, …0015 mobile) rateable again.
delete from public.feedback_ratings where interview_id in ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000015');

-- Rewinds user C (onboarding spec). If a previous run deleted C, re-run seed.sql's insert for e2e-c instead.
update public.profiles set terms_version=null, terms_accepted_at=null, college='', branch=null, year_of_study=null, gender=null, age=null
 where id = (select id from auth.users where email='e2e-c@skillora-test.invalid');
