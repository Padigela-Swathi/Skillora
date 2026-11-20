-- Creates (or resets) two e2e test users in YOUR Supabase project. Replace :'pw' with the password you will export as E2E_PASSWORD.
-- Users are marked @skillora-test.invalid so they can be removed with:  delete from auth.users where email like '%@skillora-test.invalid';
delete from auth.users where email like '%@skillora-test.invalid';
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token, phone_change, phone_change_token)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', e,
       extensions.crypt(:'pw', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', n),
       now(), now(), '', '', '', '', '', '', '', ''
from (values ('e2e-a@skillora-test.invalid','Aarav Reddy'), ('e2e-b@skillora-test.invalid','Bhavya Rao')) v(e, n);
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', u.id::text, now(), now(), now()
from auth.users u where u.email like '%@skillora-test.invalid';
