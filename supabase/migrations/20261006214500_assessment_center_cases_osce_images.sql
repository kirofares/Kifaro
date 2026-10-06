alter table public.mcq_questions
  add column if not exists image_url text,
  add column if not exists image_alt text;

create table if not exists public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_type text not null check (assessment_type in ('case','osce','ospe','spotter')),
  year smallint not null check (year between 1 and 6),
  module_code text not null,
  lecture_id text,
  title text not null,
  stem text not null default '',
  instructions text,
  media_url text,
  media_alt text,
  difficulty smallint not null default 2 check (difficulty between 1 and 3),
  time_limit_seconds integer,
  content jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessment_items_type_year_module_idx
  on public.assessment_items(assessment_type, year, module_code, published);
create index if not exists assessment_items_lecture_idx
  on public.assessment_items(lecture_id);

alter table public.assessment_items enable row level security;

drop policy if exists "assessment_items_read_published" on public.assessment_items;
create policy "assessment_items_read_published"
on public.assessment_items for select
to anon, authenticated
using (published = true or (select private.is_admin()));

drop policy if exists "assessment_items_admin_all" on public.assessment_items;
create policy "assessment_items_admin_all"
on public.assessment_items for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create table if not exists public.assessment_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_item_id uuid not null references public.assessment_items(id) on delete cascade,
  score numeric(8,2) not null default 0,
  max_score numeric(8,2) not null default 0,
  details jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

create index if not exists assessment_attempts_user_item_idx
  on public.assessment_attempts(user_id, assessment_item_id, completed_at desc);

alter table public.assessment_attempts enable row level security;
drop policy if exists "assessment_attempts_own_select" on public.assessment_attempts;
create policy "assessment_attempts_own_select" on public.assessment_attempts for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "assessment_attempts_own_insert" on public.assessment_attempts;
create policy "assessment_attempts_own_insert" on public.assessment_attempts for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "assessment_attempts_admin_select" on public.assessment_attempts;
create policy "assessment_attempts_admin_select" on public.assessment_attempts for select to authenticated using ((select private.is_admin()));
