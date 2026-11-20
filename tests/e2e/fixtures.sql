-- E2E fixtures for the two test users created by seed.sql. Re-run before each E2E run (it resets fixture rows).
-- Fixed ids let the Playwright specs open the screens directly.
--   in-progress interview (spoken, spoken, coding)  : aaaaaaaa-0000-4000-8000-000000000001   (user B)
--   completed interviews (history + feedback)        : ...0002 (tech, 78), ...0003 (hr, 52), ...0004 (code, 41)   (user B)
do $$
declare a uuid; b uuid;
begin
  select id into a from auth.users where email = 'e2e-a@skillora-test.invalid';
  select id into b from auth.users where email = 'e2e-b@skillora-test.invalid';
  delete from public.interviews where user_id in (a, b);
  update public.profiles set full_name='Aarav Reddy', college='MVSR Engineering College', branch='CSE', year_of_study='4th year', age=21, terms_version='2026-11-20', terms_accepted_at=now() where id = a;
  update public.profiles set full_name='Bhavya Rao',  college='CBIT',                     branch='IT',  year_of_study='3rd year', age=20, terms_version='2026-11-20', terms_accepted_at=now() where id = b;

  -- live interview for B (counts as 1 of today's 3)
  insert into public.interviews(id,user_id,round,level,duration_min,question_count,status,started_at)
    values ('aaaaaaaa-0000-4000-8000-000000000001', b, 'tech', 'Easy', 10, 3, 'in_progress', now());
  insert into public.interview_questions(id,interview_id,user_id,position,kind,question_text,topic,coding) values
    ('aaaaaaaa-0000-4000-8000-000000000011','aaaaaaaa-0000-4000-8000-000000000001', b, 1,'spoken','What is the difference between a process and a thread?','OS',null),
    ('aaaaaaaa-0000-4000-8000-000000000012','aaaaaaaa-0000-4000-8000-000000000001', b, 2,'spoken','Explain primary keys and foreign keys in a database.','DBMS',null),
    ('aaaaaaaa-0000-4000-8000-000000000013','aaaaaaaa-0000-4000-8000-000000000001', b, 3,'coding','Add two numbers. Read two integers and print their sum.','Math',
     '{"title":"Add two numbers","statement":"Read two integers on one line and print their sum.","input_format":"a b","output_format":"one integer","constraints":"|a|,|b| <= 10^9","examples":[{"input":"1 2\n","output":"3"},{"input":"10 20\n","output":"30"}],"starters":{"python":"import sys\n\n\ndef main():\n    data = sys.stdin.read().split()\n    # Read the input from data, then print your answer.\n\n\nmain()\n","javascript":"const lines = require(\"fs\").readFileSync(0, \"utf8\").split(\"\\n\");\n\nfunction main() {\n  // Read the input from lines, then console.log your answer.\n}\n\nmain();\n","java":"import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n    }\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n","c":"#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n"}}'::jsonb);
  insert into public.question_private(question_id,user_id,tests) values
    ('aaaaaaaa-0000-4000-8000-000000000013', b, '[{"input":"1 2\n","expected":"3","visible":true},{"input":"10 20\n","expected":"30","visible":true},{"input":"-5 5\n","expected":"0","visible":false},{"input":"100000 99999\n","expected":"199999","visible":false}]'::jsonb);

  -- completed interviews for B (older days so they do not count against today's limit)
  insert into public.interviews(id,user_id,round,level,duration_min,question_count,status,answered_count,skipped_count,score,sub_scores,strengths,weaknesses,tips,created_at,started_at,ended_at,evaluated_at) values
   ('aaaaaaaa-0000-4000-8000-000000000002', b,'tech','Easy',10,6,'completed',3,1,78,'{"Technical accuracy":82,"Depth":70,"Communication":84,"Clarity":76}','["Correct core definitions","Calm pace and clear voice"]','["Few real world examples","Answers on networks stayed shallow"]','["Add one example to every definition","Revise the OSI layers and DNS lookup"]', now()-interval '3 days', now()-interval '3 days', now()-interval '3 days', now()-interval '3 days'),
   ('aaaaaaaa-0000-4000-8000-000000000003', b,'hr','Easy',5,3,'completed',3,0,52,'{"Communication":60,"Clarity":55,"Relevance":50,"Answer structure":40,"Fluency":55}','["Warm introduction"]','["Answers ran long"]','["Try the STAR method"]', now()-interval '5 days', now()-interval '5 days', now()-interval '5 days', now()-interval '5 days'),
   ('aaaaaaaa-0000-4000-8000-000000000004', b,'code','Medium',15,9,'completed',2,0,41,'{"Correctness":40,"Approach":45,"Code quality":38,"Explanation":41}','["Attempted every problem"]','["Edge cases were missed"]','["Ask what if the input is empty"]', now()-interval '6 days', now()-interval '6 days', now()-interval '6 days', now()-interval '6 days');
  update public.interviews set ended_early = true where id='aaaaaaaa-0000-4000-8000-000000000004';
  insert into public.interview_questions(id,interview_id,user_id,position,kind,question_text,status,transcript,score,went_well,to_improve,stronger_answer,answered_at) values
   ('aaaaaaaa-0000-4000-8000-000000000021','aaaaaaaa-0000-4000-8000-000000000002', b,1,'spoken','What is the difference between a process and a thread?','answered','A process is a program running, and threads are inside it. Threads share memory so they are faster.',68,'You named shared memory, the key difference.','Give one real example, like a browser using a thread per tab.','A process has its own memory space; threads run inside a process and share its memory. Threads are lighter to create and switch.',now()),
   ('aaaaaaaa-0000-4000-8000-000000000022','aaaaaaaa-0000-4000-8000-000000000002', b,2,'spoken','Explain primary keys and foreign keys in a database.','answered','A primary key uniquely identifies each row, like a student ID. A foreign key points to that primary key.',86,'Accurate, with a clear example.','Mention that foreign keys enforce referential integrity.','A primary key uniquely identifies each row. A foreign key references it and keeps the data consistent.',now()),
   ('aaaaaaaa-0000-4000-8000-000000000023','aaaaaaaa-0000-4000-8000-000000000002', b,3,'spoken','What happens when you type a URL into a browser?','skipped',null,null,null,null,null,null),
   ('aaaaaaaa-0000-4000-8000-000000000024','aaaaaaaa-0000-4000-8000-000000000002', b,4,'coding','Reverse a string. Read a line and print it reversed.','answered','I reverse the string and print it.',80,'Correct and concise solution.','Mention the O(n) time cost.','Use slicing or a two pointer swap. O(n) time.',now());
  update public.interview_questions set code_language='python', code_source=E'print(input()[::-1])' where id='aaaaaaaa-0000-4000-8000-000000000024';
end $$;
select (select count(*) from public.interviews i join auth.users u on u.id=i.user_id where u.email like '%@skillora-test.invalid') as interviews_seeded;
