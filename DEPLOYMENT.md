# Deployment (Netlify + Supabase). Nothing here has been deployed by the build.

## 0. Compatibility
Next.js 16 (App Router, server components, `proxy.ts`) deploys on Netlify with its Next.js runtime (auto-detected; `netlify.toml` pins Node 22). All app server code uses only the public Supabase URL/key, so no server secrets are needed on Netlify. `next build` was run successfully for this repo (16 routes, no Edge-runtime-only APIs used).

## 1. Supabase (one-time)
1. **Migrations** – apply `supabase/migrations/*.sql` in order (`supabase link --project-ref <ref>` then `supabase db push`, or paste into the SQL editor). The dev project already has them.
2. **Edge Functions** – deploy all four (each folder contains its `deno.json`; they share `supabase/functions/_shared`):
   `supabase functions deploy start-interview run-code evaluate-interview delete-account` (JWT verification stays **on**).
3. **Secrets** (Dashboard → Edge Functions → Secrets):
   - `NVIDIA_API_KEY` *(required)* – key from build.nvidia.com. Free-tier rate limits apply.
   - `NVIDIA_MODEL` / `NVIDIA_FALLBACK_MODEL` *(optional)* – defaults `nvidia/nemotron-3.5-bolt-e4b` and `poolside/laguna-xs-2.1,google/gemma-4-31b-it` (fast models first). NVIDIA retires models without notice: if AI calls start failing, list models (`GET https://integrate.api.nvidia.com/v1/models`) and update these two values; no redeploy is needed.
   - `JUDGE0_URL`, `JUDGE0_AUTH_TOKEN` *(optional)* – your own Judge0 for higher limits/privacy.
   - `ALLOWED_ORIGINS` *(required before launch; CORS is `*` without it)* – e.g. `https://skillora.netlify.app`.
4. **Google sign-in** – Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web). Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. Put the client ID/secret into Supabase → Authentication → Providers → Google, enable it.
5. **URL configuration** (Authentication → URL Configuration): Site URL = your Netlify URL; Redirect URLs: `https://<site>/auth/callback` and `http://localhost:3000/auth/callback`.
6. **Hardening** – turn the **Email provider off** (Authentication → Sign In / Providers → Email; see SECURITY.md #1). `/dev-login` and password test users stop working, which is intended for production. Optionally enable CAPTCHA.
7. **Legal** – set `NEXT_PUBLIC_CONTACT_EMAIL`, have the Terms/Privacy copy reviewed; when it changes, bump `TERMS_VERSION` in `supabase/functions/_shared/config.ts` **and redeploy `start-interview`** (it also checks the version) so users re-accept.

## 2. Netlify
Site settings → Environment variables:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`. Build command `npm run build` (from `netlify.toml`). Connect the repo and deploy from `main`.

**Secrets scanning.** Netlify scans the repo and build output for the values of variables marked "Contains secret values" (and, on supported plans, for secret-looking strings). Do **not** mark the four `NEXT_PUBLIC_*` variables as secret: they are bundled into the browser on purpose and the build would fail. No real secret belongs in Netlify (`NVIDIA_API_KEY`, the service-role key and `JUDGE0_AUTH_TOKEN` live only in Supabase). If smart detection flags the publishable Supabase key, add that value to the site variable `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` in the Netlify UI rather than turning scanning off; never set `SECRETS_SCAN_ENABLED=false`. (Based on Netlify's documentation; not yet exercised on a real deploy.)

## 3. Pre-flight checklist
- [ ] `npm run check` (types, lint, unit) and `npm run build` pass
- [ ] Sign in with a real Google account → terms → details → practice
- [ ] Start a 5-minute HR interview → questions appear (proves `NVIDIA_API_KEY`)
- [ ] Coding round: Compile and Run work (proves the sandbox path from your Supabase region)
- [ ] Finish → feedback report arrives; rate it; History lists it
- [ ] Settings → delete a test account removes it
- [ ] Supabase Advisors show no new warnings; Email provider turned off; `ALLOWED_ORIGINS` set (preflight from another origin must not return `*`)
- [ ] Supabase → Authentication → URL Configuration: Site URL is the production URL and Redirect URLs are exact (no wildcards)
- [ ] Remove test data: `delete from auth.users where email like '%@skillora-test.invalid';` (and `%@skillora-dbtest.invalid`)

## 4. Rollback
- **Frontend**: Netlify → Deploys → "Publish deploy" on the previous build.
- **Edge Functions**: redeploy the previous commit's function folders (the Dashboard keeps versions).
- **Database**: migrations are additive; to undo a change write a new forward migration. Never reset a production database. Take a backup (Dashboard → Database → Backups) before applying schema changes.
