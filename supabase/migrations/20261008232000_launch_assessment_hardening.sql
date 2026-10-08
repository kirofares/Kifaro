-- Launch hardening for assessment delivery.
-- Students can list safe assessment metadata, but answer-bearing content stays server-side.
revoke all on table public.assessment_items from anon, authenticated;

grant select (
  id, assessment_type, year, module_code, lecture_id, title, stem,
  instructions, media_url, media_alt, difficulty, time_limit_seconds,
  published, created_at, updated_at, learning_point_id, case_style,
  quality_status, image_required, image_status
) on table public.assessment_items to authenticated;

-- Assessment scores are written only by trusted server logic.
revoke insert, update, delete, truncate, trigger, references
on table public.assessment_attempts
from anon, authenticated;
grant select on table public.assessment_attempts to authenticated;

-- Never sell assessment products with no ready content.
update public.module_products mp
set enabled=false, updated_at=now()
where enabled=true
and (
  product_type='assessment_bundle'
  or (
    product_type='mcq'
    and not exists (
      select 1
      from public.lecture_module_map lm
      join public.mcq_questions q on q.lecture_id=lm.lecture_id
      where lm.module_code=mp.module_code
        and lm.academic_year=mp.academic_year
        and q.published=true
        and q.quality_status='ready'
    )
  )
  or (
    product_type='cases'
    and not exists (
      select 1
      from public.assessment_items ai
      where ai.module_code=mp.module_code
        and ai.year=mp.academic_year
        and ai.assessment_type='case'
        and ai.published=true
        and ai.quality_status='ready'
    )
  )
  or (
    product_type='osce'
    and not exists (
      select 1
      from public.assessment_items ai
      where ai.module_code=mp.module_code
        and ai.year=mp.academic_year
        and ai.assessment_type in ('osce','ospe')
        and ai.published=true
        and ai.quality_status='ready'
    )
  )
);
