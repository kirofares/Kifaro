-- Recovered verbatim from the read-only Supabase migration ledger, 2026-11-01.
-- Evidence only: not automatically applied to existing databases.

create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles for update
to authenticated
using (id = (select auth.uid()) or (select private.is_admin()))
with check (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "progress_select_own_or_admin" on public.lecture_progress;
create policy "progress_select_own_or_admin"
on public.lecture_progress for select
to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "progress_insert_own" on public.lecture_progress;
create policy "progress_insert_own"
on public.lecture_progress for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "progress_update_own_or_admin" on public.lecture_progress;
create policy "progress_update_own_or_admin"
on public.lecture_progress for update
to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "entitlements_select_own_or_admin" on public.lecture_entitlements;
create policy "entitlements_select_own_or_admin"
on public.lecture_entitlements for select
to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "entitlements_admin_insert" on public.lecture_entitlements;
create policy "entitlements_admin_insert"
on public.lecture_entitlements for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists "entitlements_admin_update" on public.lecture_entitlements;
create policy "entitlements_admin_update"
on public.lecture_entitlements for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "settings_admin_all" on public.lecture_settings;
create policy "settings_admin_all"
on public.lecture_settings for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "settings_public_read_published" on public.lecture_settings;
create policy "settings_public_read_published"
on public.lecture_settings for select
to anon, authenticated
using (published = true or (select private.is_admin()));

drop policy if exists "assets_select_entitled_free_or_admin" on public.lecture_assets;
create policy "assets_select_entitled_free_or_admin"
on public.lecture_assets for select
to anon, authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.lecture_settings s
    where s.lecture_id = lecture_assets.lecture_id
      and s.published = true
      and s.access_mode = 'free'
  )
  or exists (
    select 1
    from public.lecture_entitlements e
    where e.lecture_id = lecture_assets.lecture_id
      and e.user_id = (select auth.uid())
      and e.revoked_at is null
  )
);

drop policy if exists "assets_admin_insert" on public.lecture_assets;
create policy "assets_admin_insert"
on public.lecture_assets for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists "assets_admin_update" on public.lecture_assets;
create policy "assets_admin_update"
on public.lecture_assets for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create or replace view public.lecture_settings_public
with (security_invoker = true)
as
select
  lecture_id,
  title_override,
  description_override,
  price_egp,
  access_mode,
  published,
  updated_at,
  updated_by
from public.lecture_settings;

grant select on public.lecture_settings_public to anon, authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_profile_role() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
drop function if exists public.is_admin();

