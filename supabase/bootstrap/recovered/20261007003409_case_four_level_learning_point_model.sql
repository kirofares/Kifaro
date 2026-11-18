-- Evidence only; original Supabase migration ledger, read-only retrieval 2026-11-01.
-- Not a forward migration. Review dependencies/data rewrites before activation.

alter table public.assessment_items
  add column if not exists learning_point_id uuid references public.mcq_learning_points(id) on delete set null;

create index if not exists assessment_items_case_learning_point_idx
  on public.assessment_items(assessment_type,learning_point_id,difficulty,published);

create table if not exists public.case_levels (
  level_no smallint primary key check (level_no between 1 and 4),
  label_en text not null,
  label_ar text not null,
  short_en text not null,
  short_ar text not null,
  description_en text not null,
  description_ar text not null,
  pass_threshold numeric(5,2) not null default 70 check (pass_threshold between 0 and 100)
);

insert into public.case_levels(level_no,label_en,label_ar,short_en,short_ar,description_en,description_ar,pass_threshold)
values
(1,'Level 1 — Identify','المستوى 1 — تحديد','Identify','تحديد','Recognize the key structure, lesion, or anatomical problem.','حدد التركيب أو الإصابة أو المشكلة التشريحية الأساسية.',70),
(2,'Level 2 — Explain','المستوى 2 — تفسير','Explain','تفسير','Explain the anatomical relationship or mechanism behind the finding.','فسّر العلاقة التشريحية أو الآلية وراء الحالة.',70),
(3,'Level 3 — Apply','المستوى 3 — تطبيق','Apply','تطبيق','Apply anatomy to symptoms, examination findings, or imaging.','طبّق التشريح على الأعراض والفحص أو الصور.',70),
(4,'Level 4 — Integrate / Clinical Reasoning','المستوى 4 — تكامل / تفكير سريري','Integrate / Clinical','تكامل / سريري','Integrate anatomy, localization, differential reasoning, and the next clinical step.','ادمج التشريح مع تحديد موضع الإصابة والتفكير التفريقي والخطوة التالية.',70)
on conflict(level_no) do update set
 label_en=excluded.label_en,label_ar=excluded.label_ar,short_en=excluded.short_en,short_ar=excluded.short_ar,
 description_en=excluded.description_en,description_ar=excluded.description_ar,pass_threshold=excluded.pass_threshold;

alter table public.case_levels enable row level security;
drop policy if exists "case_levels_public_read" on public.case_levels;
create policy "case_levels_public_read" on public.case_levels for select to anon,authenticated using (true);
drop policy if exists "case_levels_admin_all" on public.case_levels;
create policy "case_levels_admin_all" on public.case_levels for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create or replace view public.case_learning_point_coverage
with (security_invoker=true)
as
select
  lp.id as learning_point_id,
  lp.lecture_id,
  lp.topic,
  lp.subtopic,
  lp.learning_objective,
  count(ai.id) filter (where ai.published and ai.assessment_type='case' and ai.difficulty=1) as level1_count,
  count(ai.id) filter (where ai.published and ai.assessment_type='case' and ai.difficulty=2) as level2_count,
  count(ai.id) filter (where ai.published and ai.assessment_type='case' and ai.difficulty=3) as level3_count,
  count(ai.id) filter (where ai.published and ai.assessment_type='case' and ai.difficulty=4) as level4_count,
  (
    count(ai.id) filter (where ai.published and ai.assessment_type='case' and ai.difficulty=1) > 0
    and count(ai.id) filter (where ai.published and ai.assessment_type='case' and ai.difficulty=2) > 0
    and count(ai.id) filter (where ai.published and ai.assessment_type='case' and ai.difficulty=3) > 0
    and count(ai.id) filter (where ai.published and ai.assessment_type='case' and ai.difficulty=4) > 0
  ) as fully_covered
from public.mcq_learning_points lp
left join public.assessment_items ai on ai.learning_point_id=lp.id and ai.assessment_type='case'
where lp.active=true
group by lp.id,lp.lecture_id,lp.topic,lp.subtopic,lp.learning_objective;

grant select on public.case_learning_point_coverage to anon,authenticated;

create or replace function public.get_case_coverage_summary()
returns table(
  lecture_id text,
  learning_points bigint,
  fully_covered bigint,
  missing_l1 bigint,
  missing_l2 bigint,
  missing_l3 bigint,
  missing_l4 bigint,
  coverage_percent numeric
)
language sql
security invoker
set search_path=public
as $$
  select
    lecture_id,
    count(*)::bigint,
    count(*) filter (where fully_covered)::bigint,
    count(*) filter (where level1_count=0)::bigint,
    count(*) filter (where level2_count=0)::bigint,
    count(*) filter (where level3_count=0)::bigint,
    count(*) filter (where level4_count=0)::bigint,
    round(100.0 * count(*) filter (where fully_covered) / nullif(count(*),0),2)
  from public.case_learning_point_coverage
  group by lecture_id
  order by lecture_id;
$$;
grant execute on function public.get_case_coverage_summary() to anon,authenticated;

create or replace function public.get_my_case_level_performance()
returns table(
  difficulty integer,
  attempts bigint,
  average_percent numeric,
  last_completed_at timestamptz
)
language sql
security invoker
set search_path=public
as $$
  select
    ai.difficulty,
    count(*)::bigint,
    round(avg(case when aa.max_score>0 then 100.0*aa.score/aa.max_score else 0 end),2),
    max(aa.completed_at)
  from public.assessment_attempts aa
  join public.assessment_items ai on ai.id=aa.assessment_item_id
  where aa.user_id=auth.uid() and ai.assessment_type='case'
  group by ai.difficulty
  order by ai.difficulty;
$$;
grant execute on function public.get_my_case_level_performance() to authenticated;

create or replace function public.get_my_case_review_targets()
returns table(
  learning_point_id uuid,
  lecture_id text,
  topic text,
  subtopic text,
  difficulty integer,
  attempts bigint,
  average_percent numeric,
  last_completed_at timestamptz
)
language sql
security invoker
set search_path=public
as $$
  select
    lp.id,
    ai.lecture_id,
    lp.topic,
    lp.subtopic,
    ai.difficulty,
    count(*)::bigint,
    round(avg(case when aa.max_score>0 then 100.0*aa.score/aa.max_score else 0 end),2),
    max(aa.completed_at)
  from public.assessment_attempts aa
  join public.assessment_items ai on ai.id=aa.assessment_item_id
  join public.mcq_learning_points lp on lp.id=ai.learning_point_id
  where aa.user_id=auth.uid() and ai.assessment_type='case'
  group by lp.id,ai.lecture_id,lp.topic,lp.subtopic,ai.difficulty
  having avg(case when aa.max_score>0 then 100.0*aa.score/aa.max_score else 0 end) < 70
  order by 7 asc,6 desc;
$$;
grant execute on function public.get_my_case_review_targets() to authenticated;

