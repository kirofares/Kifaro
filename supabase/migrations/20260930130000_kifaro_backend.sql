-- KIFARO / AnatoMate initial Supabase backend
-- Safe student profiles, progress, admin controls, entitlements and protected lecture assets.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  medical_year integer check (medical_year between 1 and 7),
  faculty text,
  university text,
  nationality text,
  phone_no text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lecture_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_id text not null,
  progress integer not null default 0 check (progress between 0 and 100),
  completed boolean not null default false,
  favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, lecture_id)
);

create table if not exists public.lecture_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_id text not null,
  price_paid_egp numeric(10,2) not null default 0 check (price_paid_egp >= 0),
  source text not null default 'admin',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, lecture_id)
);

create table if not exists public.lecture_settings (
  lecture_id text primary key,
  title_override text,
  description_override text,
  price_egp integer check (price_egp in (0,40,50,60)),
  access_mode text check (access_mode in ('free','paid')),
  published boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- Paid/private URLs live separately so public catalog queries can never expose them.
create table if not exists public.lecture_assets (
  lecture_id text primary key,
  video_url text,
  pdf_url text,
  pptx_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, medical_year, faculty, university, nationality, phone_no, role
  ) values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'medical_year', '')::integer, 1),
    nullif(new.raw_user_meta_data ->> 'faculty', ''),
    nullif(new.raw_user_meta_data ->> 'university', ''),
    nullif(new.raw_user_meta_data ->> 'nationality', ''),
    nullif(new.raw_user_meta_data ->> 'phone_no', ''),
    'student'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    medical_year = coalesce(excluded.medical_year, public.profiles.medical_year),
    faculty = coalesce(excluded.faculty, public.profiles.faculty),
    university = coalesce(excluded.university, public.profiles.university),
    nationality = coalesce(excluded.nationality, public.profiles.nationality),
    phone_no = coalesce(excluded.phone_no, public.profiles.phone_no),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an administrator can change account roles';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
before update on public.profiles
for each row execute procedure public.protect_profile_role();

alter table public.profiles enable row level security;
alter table public.lecture_progress enable row level security;
alter table public.lecture_entitlements enable row level security;
alter table public.lecture_settings enable row level security;
alter table public.lecture_assets enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "progress_select_own_or_admin" on public.lecture_progress;
create policy "progress_select_own_or_admin"
on public.lecture_progress for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "progress_insert_own" on public.lecture_progress;
create policy "progress_insert_own"
on public.lecture_progress for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "progress_update_own_or_admin" on public.lecture_progress;
create policy "progress_update_own_or_admin"
on public.lecture_progress for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "entitlements_select_own_or_admin" on public.lecture_entitlements;
create policy "entitlements_select_own_or_admin"
on public.lecture_entitlements for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "entitlements_admin_insert" on public.lecture_entitlements;
create policy "entitlements_admin_insert"
on public.lecture_entitlements for insert
to authenticated
with check (public.is_admin());

drop policy if exists "entitlements_admin_update" on public.lecture_entitlements;
create policy "entitlements_admin_update"
on public.lecture_entitlements for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "settings_admin_all" on public.lecture_settings;
create policy "settings_admin_all"
on public.lecture_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assets_select_entitled_free_or_admin" on public.lecture_assets;
create policy "assets_select_entitled_free_or_admin"
on public.lecture_assets for select
to anon, authenticated
using (
  public.is_admin()
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
      and e.user_id = auth.uid()
      and e.revoked_at is null
  )
);

drop policy if exists "assets_admin_insert" on public.lecture_assets;
create policy "assets_admin_insert"
on public.lecture_assets for insert
to authenticated
with check (public.is_admin());

drop policy if exists "assets_admin_update" on public.lecture_assets;
create policy "assets_admin_update"
on public.lecture_assets for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop view if exists public.lecture_settings_public;
create view public.lecture_settings_public as
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

revoke all on public.lecture_settings_public from public;
grant select on public.lecture_settings_public to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.lecture_progress to authenticated;
grant select, insert, update on public.lecture_entitlements to authenticated;
grant select, insert, update on public.lecture_settings to authenticated;
grant select, insert, update on public.lecture_assets to anon, authenticated;

-- Backfill profiles for any users created before this migration.
insert into public.profiles (id, email, full_name, medical_year, faculty, university, nationality, phone_no, role)
select
  u.id,
  u.email,
  nullif(u.raw_user_meta_data ->> 'full_name', ''),
  coalesce(nullif(u.raw_user_meta_data ->> 'medical_year', '')::integer, 1),
  nullif(u.raw_user_meta_data ->> 'faculty', ''),
  nullif(u.raw_user_meta_data ->> 'university', ''),
  nullif(u.raw_user_meta_data ->> 'nationality', ''),
  nullif(u.raw_user_meta_data ->> 'phone_no', ''),
  'student'
from auth.users u
on conflict (id) do nothing;
