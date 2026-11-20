-- Edge Functions use the service role. This project does not auto-grant new tables to service_role, so grant explicitly.
grant select, insert, update, delete on public.profiles, public.interviews, public.interview_questions,
  public.question_private, public.code_runs, public.feedback_ratings to service_role;
