create table if not exists public.lecture_draft_visuals (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.lecture_drafts(id) on delete cascade,
  lecture_id text not null,
  slide_number integer not null check (slide_number >= 1),
  status text not null default 'pending'
    check (status in ('pending','generating','needs_review','approved','failed')),
  prompt text not null,
  storage_path text,
  model text,
  quality text,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  generated_at timestamptz,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (draft_id, slide_number)
);

alter table public.lecture_draft_visuals enable row level security;

revoke all on table public.lecture_draft_visuals from anon;
grant select, insert, update, delete on table public.lecture_draft_visuals to authenticated;

drop policy if exists "lecture_draft_visuals_admin_all" on public.lecture_draft_visuals;
create policy "lecture_draft_visuals_admin_all"
on public.lecture_draft_visuals
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create index if not exists lecture_draft_visuals_draft_status_idx
  on public.lecture_draft_visuals (draft_id, status, slide_number);
