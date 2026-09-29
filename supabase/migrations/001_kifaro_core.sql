create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  medical_year smallint check (medical_year between 1 and 6),
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

alter table public.profiles enable row level security;
alter table public.lecture_progress enable row level security;

create policy "Users can view own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);

create policy "Users can read own progress"
on public.lecture_progress for select
using (auth.uid() = user_id);

create policy "Users can insert own progress"
on public.lecture_progress for insert
with check (auth.uid() = user_id);

create policy "Users can update own progress"
on public.lecture_progress for update
using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, medical_year)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    nullif(new.raw_user_meta_data ->> 'medical_year','')::smallint
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
