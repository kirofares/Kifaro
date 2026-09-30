# Supabase setup for KIFARO

The frontend already uses Supabase Auth and the KIFARO tables.

## 1. Apply the migration

In Supabase Dashboard open **SQL Editor**, paste the contents of:

`supabase/migrations/20260930130000_kifaro_backend.sql`

and run it once.

If you use the Supabase CLI/GitHub integration, apply the migration through your normal deployment flow instead.

## 2. Add frontend environment variables

Set these in the deployment environment (never commit real keys):

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

The anon key is intended for browser use; security is enforced by Row Level Security. Never put a service-role key in the frontend.

## 3. Create the first administrator

Create/sign up your own KIFARO account first. Then in the Supabase SQL Editor run:

```sql
update public.profiles
set role = 'admin', updated_at = now()
where email = 'YOUR_ADMIN_EMAIL';
```

Log out and back in. The **Admin Dashboard** will then be available to that account.

## Security model

- Students can read/update only their own profile.
- Students can read/write only their own progress.
- Students can read only their own active lecture entitlements.
- Only admins can grant/revoke lecture access or edit lecture settings.
- Public lecture metadata is exposed through `lecture_settings_public`.
- Video/PDF/PPTX URLs are stored in `lecture_assets` and are returned only to admins, entitled students, or for lectures explicitly marked free.
