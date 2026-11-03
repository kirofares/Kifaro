-- Recovered verbatim from the read-only Supabase migration ledger, 2026-11-01.
-- Evidence only: not automatically applied to existing databases.

create table if not exists public.mcq_questions (
  id uuid primary key default gen_random_uuid(),
  lecture_id text not null,
  topic text not null,
  subtopic text,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  explanation text,
  question_type text not null,
  difficulty integer not null check (difficulty between 1 and 4),
  source_scope text not null default 'lecture',
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists mcq_questions_lecture_idx on public.mcq_questions(lecture_id);
alter table public.mcq_questions enable row level security;
create policy "published_mcqs_readable" on public.mcq_questions for select using (published = true);

