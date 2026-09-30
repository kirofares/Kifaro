alter table public.profiles
  add column if not exists faculty text,
  add column if not exists university text,
  add column if not exists nationality text,
  add column if not exists phone_no text,
  add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    medical_year,
    faculty,
    university,
    nationality,
    phone_no,
    email
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    nullif(new.raw_user_meta_data ->> 'medical_year','')::smallint,
    new.raw_user_meta_data ->> 'faculty',
    new.raw_user_meta_data ->> 'university',
    new.raw_user_meta_data ->> 'nationality',
    new.raw_user_meta_data ->> 'phone_no',
    new.email
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    medical_year = excluded.medical_year,
    faculty = excluded.faculty,
    university = excluded.university,
    nationality = excluded.nationality,
    phone_no = excluded.phone_no,
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;
