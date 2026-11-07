-- Evidence only; original Supabase migration ledger, read-only retrieval 2026-11-01.
-- Not a forward migration. Review dependencies/data rewrites before activation.

alter table public.mcq_questions
  add column if not exists image_required boolean not null default false,
  add column if not exists image_status text not null default 'not_required',
  add column if not exists image_reason text,
  add column if not exists quality_status text not null default 'needs_review';

alter table public.mcq_questions
  drop constraint if exists mcq_questions_image_status_check;
alter table public.mcq_questions
  add constraint mcq_questions_image_status_check
  check (image_status in ('not_required','missing','ready','needs_review'));

alter table public.mcq_questions
  drop constraint if exists mcq_questions_quality_status_check;
alter table public.mcq_questions
  add constraint mcq_questions_quality_status_check
  check (quality_status in ('needs_review','ready','blocked'));

alter table public.assessment_items
  add column if not exists quality_status text not null default 'needs_review',
  add column if not exists quality_notes text,
  add column if not exists image_required boolean not null default false,
  add column if not exists image_status text not null default 'not_required';

alter table public.assessment_items
  drop constraint if exists assessment_items_quality_status_check;
alter table public.assessment_items
  add constraint assessment_items_quality_status_check
  check (quality_status in ('needs_review','ready','blocked'));

alter table public.assessment_items
  drop constraint if exists assessment_items_image_status_check;
alter table public.assessment_items
  add constraint assessment_items_image_status_check
  check (image_status in ('not_required','missing','ready','needs_review'));

update public.assessment_items
set
  published=false,
  quality_status='blocked',
  quality_notes='Auto-generated learning-point case requires conversion to a genuine exam vignette before publication.'
where assessment_type='case'
  and case_style='learning_point_exam';

update public.assessment_items
set quality_status='needs_review'
where assessment_type='case'
  and case_style='curated_exam'
  and quality_status<>'ready';

update public.mcq_questions
set
  image_required = true,
  image_status = case
    when nullif(btrim(coalesce(image_url,'')),'') is null then 'missing'
    else 'ready'
  end,
  image_reason = case
    when question_type ~* 'image|spotter' then 'Question type is visual/spotter.'
    when question_text ~* 'x-ray|radiograph|ct|mri|scan|image|shown|arrow|label|specimen|cross.?section' then 'Stem explicitly depends on a visual.'
    when question_text ~* 'identify' and (topic ~* 'osteology|bone|surface|orbit|brain|cord|ventric|mening|laryn|lung|heart|ear|eye|sinus|pleura|mediast') then 'Identification question in a visual anatomy domain.'
    else 'Visual anatomy concept flagged for review.'
  end,
  quality_status = case
    when nullif(btrim(coalesce(image_url,'')),'') is null then 'blocked'
    else quality_status
  end
where
  question_type ~* 'image|spotter'
  or question_text ~* 'x-ray|radiograph|ct|mri|scan|image|shown|arrow|label|specimen|cross.?section'
  or (
    question_text ~* 'identify'
    and (topic ~* 'osteology|bone|surface|orbit|brain|cord|ventric|mening|laryn|lung|heart|ear|eye|sinus|pleura|mediast')
  );

update public.mcq_questions
set image_status='ready'
where image_required=true
  and nullif(btrim(coalesce(image_url,'')),'') is not null;

update public.mcq_questions
set image_status='not_required'
where image_required=false;

create or replace view public.content_quality_audit
with (security_invoker=true)
as
select
  'mcq'::text as item_type,
  lecture_id,
  count(*) as total_items,
  count(*) filter (where quality_status='ready') as ready_items,
  count(*) filter (where quality_status='needs_review') as needs_review_items,
  count(*) filter (where quality_status='blocked') as blocked_items,
  count(*) filter (where image_required) as image_required_items,
  count(*) filter (where image_required and image_status='missing') as missing_image_items
from public.mcq_questions
group by lecture_id
union all
select
  'case'::text,
  lecture_id,
  count(*),
  count(*) filter (where quality_status='ready'),
  count(*) filter (where quality_status='needs_review'),
  count(*) filter (where quality_status='blocked'),
  count(*) filter (where image_required),
  count(*) filter (where image_required and image_status='missing')
from public.assessment_items
where assessment_type='case'
group by lecture_id;

grant select on public.content_quality_audit to authenticated;

create or replace function private.build_learning_point_exam_cases()
returns integer
language plpgsql
security definer
set search_path=public,private
as $$
begin
  raise exception 'Auto-generation of learning-point cases is disabled. Cases must be authored/reviewed as genuine clinical or practical exam vignettes.';
end;
$$;

