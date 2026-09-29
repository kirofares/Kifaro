# KIFARO production backend setup

KIFARO now supports Supabase authentication and cloud-synced student progress.

## Required GitHub secrets

Add these repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

GitHub path:

`Settings → Secrets and variables → Actions → New repository secret`

## Supabase database

Run:

`supabase/migrations/001_kifaro_core.sql`

The migration creates:

- `profiles`
- `lecture_progress`
- Row Level Security policies
- automatic profile creation after sign-up

## Authentication

Enable Email authentication in Supabase.

Recommended first-launch settings:

- Email/password enabled
- Email confirmation enabled
- Site URL set to the production KIFARO URL
- Redirect URL includes the GitHub Pages preview while testing

## Behavior

When Supabase keys are present:

- students can create accounts
- students can log in/out
- progress and favorites sync to their account

When Supabase keys are absent:

- KIFARO remains available in demo mode
- progress stays in localStorage
