create table if not exists public.content_production (
  lecture_id text primary key,
  academic_year smallint not null check (academic_year between 1 and 7),
  module_code text not null,
  lecture_title text not null,
  overall_status text not null default 'not_started'
    check (overall_status in ('not_started','in_progress','needs_review','ready','published','blocked')),
  current_stage text not null default 'outline'
    check (current_stage in ('outline','slides','images','clinical','mcq','cases','osce','recall','final_qa','publish')),
  stage_status jsonb not null default
    '{"outline":"pending","slides":"pending","images":"pending","clinical":"pending","mcq":"pending","cases":"pending","osce":"pending","recall":"pending","final_qa":"pending","publish":"pending"}'::jsonb,
  production_notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_production enable row level security;

revoke all on table public.content_production from anon;
grant select, insert, update, delete on table public.content_production to authenticated;

drop policy if exists "content_production_admin_all" on public.content_production;
create policy "content_production_admin_all"
on public.content_production
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create or replace view public.content_production_quality_summary
with (security_invoker = true)
as
with mcq as (
  select
    lecture_id,
    count(*)::integer as mcq_total,
    count(*) filter (where published = true and quality_status = 'ready')::integer as mcq_ready,
    count(*) filter (
      where image_required = true
        and coalesce(image_status, 'missing') <> 'ready'
    )::integer as mcq_image_issues
  from public.mcq_questions
  group by lecture_id
),
assessments as (
  select
    lecture_id,
    count(*) filter (where assessment_type = 'case')::integer as case_total,
    count(*) filter (
      where assessment_type = 'case'
        and published = true
        and quality_status = 'ready'
    )::integer as case_ready,
    count(*) filter (
      where assessment_type = 'case'
        and image_required = true
        and coalesce(image_status, 'missing') <> 'ready'
    )::integer as case_image_issues,
    count(*) filter (where assessment_type in ('osce','ospe'))::integer as osce_total,
    count(*) filter (
      where assessment_type in ('osce','ospe')
        and published = true
        and quality_status = 'ready'
    )::integer as osce_ready,
    count(*) filter (
      where assessment_type in ('osce','ospe')
        and image_required = true
        and coalesce(image_status, 'missing') <> 'ready'
    )::integer as osce_image_issues,
    count(*) filter (where assessment_type = 'spotter')::integer as spotter_total,
    count(*) filter (
      where assessment_type = 'spotter'
        and published = true
        and quality_status = 'ready'
    )::integer as spotter_ready
  from public.assessment_items
  where lecture_id is not null
  group by lecture_id
)
select
  lm.lecture_id,
  coalesce(mcq.mcq_total, 0) as mcq_total,
  coalesce(mcq.mcq_ready, 0) as mcq_ready,
  coalesce(mcq.mcq_image_issues, 0) as mcq_image_issues,
  coalesce(assessments.case_total, 0) as case_total,
  coalesce(assessments.case_ready, 0) as case_ready,
  coalesce(assessments.case_image_issues, 0) as case_image_issues,
  coalesce(assessments.osce_total, 0) as osce_total,
  coalesce(assessments.osce_ready, 0) as osce_ready,
  coalesce(assessments.osce_image_issues, 0) as osce_image_issues,
  coalesce(assessments.spotter_total, 0) as spotter_total,
  coalesce(assessments.spotter_ready, 0) as spotter_ready
from public.lecture_module_map lm
left join mcq on mcq.lecture_id = lm.lecture_id
left join assessments on assessments.lecture_id = lm.lecture_id
where (select private.is_admin());

revoke all on table public.content_production_quality_summary from anon;
grant select on table public.content_production_quality_summary to authenticated;
