alter table public.mcq_questions
  add column if not exists distractor_explanations jsonb not null default '{}'::jsonb;

create table if not exists public.mcq_levels (
  level_no smallint primary key check (level_no between 1 and 4),
  label_en text not null,
  label_ar text not null,
  short_en text not null,
  short_ar text not null,
  description_en text not null,
  description_ar text not null,
  pass_threshold numeric(5,2) not null default 70 check (pass_threshold between 0 and 100)
);

insert into public.mcq_levels(level_no,label_en,label_ar,short_en,short_ar,description_en,description_ar,pass_threshold)
values
  (1,'Level 1 — Know','المستوى 1 — معرفة','Know','معرفة','Recall core anatomical facts, names and definitions.','استدعاء المعلومات الأساسية والأسماء والتعريفات التشريحية.',70),
  (2,'Level 2 — Understand','المستوى 2 — فهم','Understand','فهم','Explain relationships, meaning and anatomical organization.','فهم العلاقات والمعنى والتنظيم التشريحي.',70),
  (3,'Level 3 — Apply','المستوى 3 — تطبيق','Apply','تطبيق','Use anatomy to solve applied and exam-style problems.','استخدام المعلومات التشريحية في أسئلة تطبيقية ونمط الامتحان.',70),
  (4,'Level 4 — Integrate / Clinical','المستوى 4 — تكامل / إكلينيكي','Integrate / Clinical','تكامل / إكلينيكي','Integrate anatomy with clinical localization and multi-step reasoning.','دمج التشريح مع التفكير الإكلينيكي وتحديد موضع الإصابة.',70)
on conflict(level_no) do update set
  label_en=excluded.label_en,
  label_ar=excluded.label_ar,
  short_en=excluded.short_en,
  short_ar=excluded.short_ar,
  description_en=excluded.description_en,
  description_ar=excluded.description_ar,
  pass_threshold=excluded.pass_threshold;

alter table public.mcq_levels enable row level security;
drop policy if exists "mcq_levels_public_read" on public.mcq_levels;
create policy "mcq_levels_public_read" on public.mcq_levels for select to anon, authenticated using (true);
drop policy if exists "mcq_levels_admin_all" on public.mcq_levels;
create policy "mcq_levels_admin_all" on public.mcq_levels for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create or replace function public.get_my_mcq_level_performance()
returns table(difficulty integer, attempts bigint, correct bigint, score numeric, last_answered_at timestamptz)
language sql security invoker set search_path=public
as $$
  select q.difficulty,
         count(*)::bigint,
         count(*) filter (where a.is_correct)::bigint,
         round(100.0 * count(*) filter (where a.is_correct) / nullif(count(*),0), 2),
         max(a.answered_at)
  from public.mcq_attempts a
  join public.mcq_questions q on q.id=a.question_id
  where a.user_id=auth.uid()
  group by q.difficulty
  order by q.difficulty;
$$;
grant execute on function public.get_my_mcq_level_performance() to authenticated;

create or replace function public.get_my_mcq_review_targets()
returns table(
  lecture_id text, topic text, subtopic text, learning_objective text,
  difficulty integer, attempts bigint, correct bigint, score numeric, last_answered_at timestamptz
)
language sql security invoker set search_path=public
as $$
  select a.lecture_id,
         coalesce(nullif(q.topic,''), a.lecture_id),
         nullif(q.subtopic,''),
         nullif(q.learning_objective,''),
         q.difficulty,
         count(*)::bigint,
         count(*) filter (where a.is_correct)::bigint,
         round(100.0 * count(*) filter (where a.is_correct) / nullif(count(*),0), 2),
         max(a.answered_at)
  from public.mcq_attempts a
  join public.mcq_questions q on q.id=a.question_id
  where a.user_id=auth.uid()
  group by a.lecture_id, coalesce(nullif(q.topic,''), a.lecture_id), nullif(q.subtopic,''), nullif(q.learning_objective,''), q.difficulty
  having count(*) >= 1
  order by 8 asc, 6 desc;
$$;
grant execute on function public.get_my_mcq_review_targets() to authenticated;
