create table if not exists public.lecture_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  lecture_id text not null,
  action text not null check (action in ('generate','revise')),
  status text not null default 'queued'
    check (status in ('queued','running','completed','failed','cancelled')),
  response_id text,
  model text,
  instructions text,
  source_draft_id uuid,
  result_draft_id uuid,
  error_message text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.lecture_drafts (
  id uuid primary key default gen_random_uuid(),
  lecture_id text not null,
  revision integer not null check (revision >= 1),
  status text not null default 'draft'
    check (status in ('draft','needs_changes','approved','superseded','rejected')),
  model text,
  content jsonb not null default '{}'::jsonb,
  feedback text,
  generation_job_id uuid references public.lecture_generation_jobs(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (lecture_id, revision)
);

alter table public.lecture_generation_jobs
  drop constraint if exists lecture_generation_jobs_source_draft_id_fkey;
alter table public.lecture_generation_jobs
  add constraint lecture_generation_jobs_source_draft_id_fkey
  foreign key (source_draft_id) references public.lecture_drafts(id) on delete set null;

alter table public.lecture_generation_jobs
  drop constraint if exists lecture_generation_jobs_result_draft_id_fkey;
alter table public.lecture_generation_jobs
  add constraint lecture_generation_jobs_result_draft_id_fkey
  foreign key (result_draft_id) references public.lecture_drafts(id) on delete set null;

alter table public.content_production
  add column if not exists approved_draft_id uuid references public.lecture_drafts(id) on delete set null;

alter table public.content_production
  add column if not exists review_state text not null default 'not_generated'
    check (review_state in ('not_generated','generating','awaiting_review','changes_requested','approved'));

alter table public.content_production
  add column if not exists review_feedback text;

alter table public.lecture_generation_jobs enable row level security;
alter table public.lecture_drafts enable row level security;

revoke all on table public.lecture_generation_jobs from anon;
revoke all on table public.lecture_drafts from anon;
grant select, insert, update, delete on table public.lecture_generation_jobs to authenticated;
grant select, insert, update, delete on table public.lecture_drafts to authenticated;

drop policy if exists "lecture_generation_jobs_admin_all" on public.lecture_generation_jobs;
create policy "lecture_generation_jobs_admin_all"
on public.lecture_generation_jobs
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "lecture_drafts_admin_all" on public.lecture_drafts;
create policy "lecture_drafts_admin_all"
on public.lecture_drafts
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create index if not exists lecture_generation_jobs_lecture_status_idx
  on public.lecture_generation_jobs (lecture_id, status, created_at desc);

create index if not exists lecture_drafts_lecture_revision_idx
  on public.lecture_drafts (lecture_id, revision desc);
