alter table public.profiles
  add column if not exists preferred_learning_depth text
  default 'CORE';

update public.profiles
set preferred_learning_depth = 'CORE'
where preferred_learning_depth is null;

alter table public.profiles
  drop constraint if exists profiles_preferred_learning_depth_check;

alter table public.profiles
  add constraint profiles_preferred_learning_depth_check
  check (preferred_learning_depth in ('CORE', 'ADVANCED', 'POSTGRAD'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, medical_year, faculty, university, nationality, phone_no, preferred_learning_depth, role
  ) values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'medical_year', '')::integer, 1),
    nullif(new.raw_user_meta_data ->> 'faculty', ''),
    nullif(new.raw_user_meta_data ->> 'university', ''),
    nullif(new.raw_user_meta_data ->> 'nationality', ''),
    nullif(new.raw_user_meta_data ->> 'phone_no', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'preferred_learning_depth', ''), 'CORE'),
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
    preferred_learning_depth = coalesce(excluded.preferred_learning_depth, public.profiles.preferred_learning_depth),
    updated_at = now();
  return new;
end;
$$;
