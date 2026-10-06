alter table public.mcq_questions
  add column if not exists learning_objective text;

drop policy if exists "mcq_questions_admin_all" on public.mcq_questions;
create policy "mcq_questions_admin_all"
on public.mcq_questions for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create table if not exists public.mcq_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.mcq_questions(id) on delete cascade,
  lecture_id text not null,
  selected_option text not null check (selected_option in ('A','B','C','D')),
  is_correct boolean not null,
  response_ms integer,
  answered_at timestamptz not null default now()
);

create index if not exists mcq_attempts_user_lecture_idx on public.mcq_attempts(user_id, lecture_id, answered_at desc);
create index if not exists mcq_attempts_user_question_idx on public.mcq_attempts(user_id, question_id, answered_at desc);

alter table public.mcq_attempts enable row level security;

drop policy if exists "mcq_attempts_own_select" on public.mcq_attempts;
create policy "mcq_attempts_own_select" on public.mcq_attempts for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "mcq_attempts_own_insert" on public.mcq_attempts;
create policy "mcq_attempts_own_insert" on public.mcq_attempts for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "mcq_attempts_admin_select" on public.mcq_attempts;
create policy "mcq_attempts_admin_select" on public.mcq_attempts for select to authenticated using ((select private.is_admin()));

create table if not exists public.mcq_stages (
  stage_no smallint primary key,
  label_en text not null,
  label_ar text not null,
  min_score numeric(5,2) not null,
  max_score numeric(5,2) not null,
  description_en text not null default '',
  description_ar text not null default '',
  check (stage_no between 1 and 10),
  check (min_score >= 0 and max_score <= 100 and min_score <= max_score)
);

insert into public.mcq_stages(stage_no,label_en,label_ar,min_score,max_score,description_en,description_ar)
values
  (1,'Starting','البداية',0,39.99,'Build the core facts first.','ابدأ بتثبيت المعلومات الأساسية.'),
  (2,'Building','مرحلة البناء',40,59.99,'Core understanding is forming.','الفهم الأساسي بدأ يتكوّن.'),
  (3,'Developing','مرحلة التطور',60,74.99,'Good base; target weak topics.','قاعدة جيدة مع ضرورة مراجعة نقاط الضعف.'),
  (4,'Strong','مرحلة قوية',75,89.99,'Strong performance with focused gaps.','مستوى قوي مع فجوات محددة تحتاج مراجعة.'),
  (5,'Mastery','الإتقان',90,100,'High mastery; maintain with spaced revision.','إتقان مرتفع مع مراجعة متباعدة للحفاظ على المستوى.')
on conflict(stage_no) do nothing;

alter table public.mcq_stages enable row level security;
drop policy if exists "mcq_stages_public_read" on public.mcq_stages;
create policy "mcq_stages_public_read" on public.mcq_stages for select to anon, authenticated using (true);
drop policy if exists "mcq_stages_admin_all" on public.mcq_stages;
create policy "mcq_stages_admin_all" on public.mcq_stages for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create or replace function public.get_my_mcq_mastery()
returns table(lecture_id text, topic text, attempts bigint, correct bigint, score numeric, last_answered_at timestamptz)
language sql security invoker set search_path=public
as $$
  select
    a.lecture_id,
    coalesce(nullif(q.topic,''), a.lecture_id) as topic,
    count(*)::bigint,
    count(*) filter (where a.is_correct)::bigint,
    round(100.0 * count(*) filter (where a.is_correct) / nullif(count(*),0), 2),
    max(a.answered_at)
  from public.mcq_attempts a
  join public.mcq_questions q on q.id = a.question_id
  where a.user_id = auth.uid()
  group by a.lecture_id, coalesce(nullif(q.topic,''), a.lecture_id);
$$;

grant execute on function public.get_my_mcq_mastery() to authenticated;
