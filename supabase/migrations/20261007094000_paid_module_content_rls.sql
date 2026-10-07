create table if not exists public.lecture_module_map (
  lecture_id text primary key,
  module_code text not null,
  academic_year integer not null check (academic_year between 1 and 7)
);

insert into public.lecture_module_map(lecture_id,module_code,academic_year)
values
('y1-orientation-01','ORIENTATION',1),
('y1-orientation-02','ORIENTATION',1),
('y1-found-01','IAE-1',1),
('y1-found-02','IAE-1',1),
('y1-found-03','IAE-1',1),
('y1-found-04','IAE-1',1),
('y1-found-05','IAE-1',1),
('y1-found-06','IAE-1',1),
('y1-found-07','IAE-1',1),
('y1-found-08','IAE-1',1),
('y1-iae-1-09','IAE-1',1),
('y1-found-10','IAE-1',1),
('y1-iae-1-11','IAE-1',1),
('y1-iae-1-12','IAE-1',1),
('y1-iae-1-13','IAE-1',1),
('y1-iae-1-14','IAE-1',1),
('y1-iae-1-15','IAE-1',1),
('y1-iae-1-16','IAE-1',1),
('y1-iae-1-17','IAE-1',1),
('y1-iae-1-18','IAE-1',1),
('y1-iae-1-19','IAE-1',1),
('y1-iae-1-20','IAE-1',1),
('y1-mls-1-21','MLS-1',1),
('y1-mls-1-22','MLS-1',1),
('y1-practical-scapula','MLS-1',1),
('y1-mls-1-24','MLS-1',1),
('y1-mls-1-25','MLS-1',1),
('y1-mls-1-26','MLS-1',1),
('y1-mls-1-27','MLS-1',1),
('y1-mls-1-28','MLS-1',1),
('y1-mls-1-29','MLS-1',1),
('y1-mls-1-30','MLS-1',1),
('y1-mls-1-31','MLS-1',1),
('y1-mls-1-32','MLS-1',1),
('y1-mls-1-33','MLS-1',1),
('y1-mls-1-34','MLS-1',1),
('y1-mls-1-35','MLS-1',1),
('y1-mls-1-36','MLS-1',1),
('y1-mls-1-37','MLS-1',1),
('y1-mls-1-38','MLS-1',1),
('y1-mls-1-39','MLS-1',1),
('y1-mls-1-40','MLS-1',1),
('y1-mls-1-41','MLS-1',1),
('y1-mls-1-42','MLS-1',1),
('y1-mls-1-43','MLS-1',1),
('y1-mls-1-44','MLS-1',1),
('y1-mls-1-45','MLS-1',1),
('y1-mls-1-46','MLS-1',1),
('y1-mls-1-47','MLS-1',1),
('y1-mls-1-48','MLS-1',1),
('y1-mls-1-49','MLS-1',1),
('y1-mls-1-50','MLS-1',1),
('y1-mls-1-51','MLS-1',1),
('y1-mls-1-52','MLS-1',1),
('y1-mls-1-53','MLS-1',1),
('y1-mls-1-54','MLS-1',1),
('y1-mls-1-55','MLS-1',1),
('y1-mls-1-56','MLS-1',1),
('y1-found-09','MLS-1',1),
('y1-mls-1-58','MLS-1',1),
('y1-mls-1-59','MLS-1',1),
('y1-mls-1-60','MLS-1',1),
('y2-mbl-2-01','MBL-2',2),
('y2-mbl-2-02','MBL-2',2),
('y2-mbl-2-03','MBL-2',2),
('y2-mbl-2-04','MBL-2',2),
('y2-mbl-2-05','MBL-2',2),
('y2-mbl-2-06','MBL-2',2),
('y2-mrs-2-07','MRS-2',2),
('y2-mrs-2-08','MRS-2',2),
('y2-mrs-2-09','MRS-2',2),
('y2-mrs-2-10','MRS-2',2),
('y2-mrs-2-11','MRS-2',2),
('y2-mrs-2-12','MRS-2',2),
('y2-mrs-2-13','MRS-2',2),
('y2-mrs-2-14','MRS-2',2),
('y2-mrs-2-15','MRS-2',2),
('y2-mrs-2-16','MRS-2',2),
('y2-mrs-2-17','MRS-2',2),
('y2-mcvs-2-18','MCVS-2',2),
('y2-mcvs-2-19','MCVS-2',2),
('y2-mcvs-2-20','MCVS-2',2),
('y2-mcvs-2-21','MCVS-2',2),
('y2-mcvs-2-22','MCVS-2',2),
('y2-mcvs-2-23','MCVS-2',2),
('y2-mcvs-2-24','MCVS-2',2),
('y2-mcvs-2-25','MCVS-2',2),
('y2-mcvs-2-26','MCVS-2',2),
('y2-mcvs-2-27','MCVS-2',2),
('y2-mcvs-2-28','MCVS-2',2),
('y2-mcns-2-29','MCNS-2',2),
('y2-cns-30','MCNS-2',2),
('y2-cns-31','MCNS-2',2),
('y2-cns-32','MCNS-2',2),
('y2-cns-33','MCNS-2',2),
('y2-cns-34','MCNS-2',2),
('y2-cns-35','MCNS-2',2),
('y2-cns-36','MCNS-2',2),
('y2-cns-37','MCNS-2',2),
('y2-cns-38','MCNS-2',2),
('y2-mcns-2-39','MCNS-2',2),
('y2-mcns-2-40','MCNS-2',2),
('y2-mcns-2-41','MCNS-2',2),
('y2-mcns-2-42','MCNS-2',2),
('y2-mcns-2-43','MCNS-2',2),
('y2-mcns-2-44','MCNS-2',2),
('y2-mcns-2-45','MCNS-2',2),
('y2-mcns-2-46','MCNS-2',2),
('y2-mcns-2-47','MCNS-2',2),
('y2-mss-2-48','MSS-2',2),
('y2-mss-2-49','MSS-2',2),
('y2-mss-2-50','MSS-2',2),
('y2-mss-2-51','MSS-2',2),
('y2-mss-2-52','MSS-2',2),
('y2-mss-2-53','MSS-2',2),
('y2-mss-2-54','MSS-2',2),
('y2-mss-2-55','MSS-2',2),
('y2-mem-2-56','MEM-2',2),
('y2-mem-2-57','MEM-2',2),
('y2-mem-2-58','MEM-2',2),
('y2-mem-2-59','MEM-2',2),
('y2-mem-2-60','MEM-2',2),
('y3-hn-01','MGL-3',3),
('y3-hn-02','MGL-3',3),
('y3-hn-03','MGL-3',3),
('y3-mgl-3-04','MGL-3',3),
('y3-hn-04','MGL-3',3),
('y3-hn-05','MGL-3',3),
('y3-abd-01','MGL-3',3),
('y3-abd-02','MGL-3',3),
('y3-abd-05','MGL-3',3),
('y3-abd-03','MGL-3',3),
('y3-abd-04','MGL-3',3),
('y3-abd-06','MGL-3',3),
('y3-mgl-3-13','MGL-3',3),
('y3-mgl-3-14','MGL-3',3),
('y3-abd-09','MGL-3',3),
('y3-abd-10','MGL-3',3),
('y3-mgl-3-17','MGL-3',3),
('y3-mgl-3-18','MGL-3',3),
('y3-abd-13','MGL-3',3),
('y3-mgl-3-20','MGL-3',3),
('y3-mgl-3-21','MGL-3',3),
('y3-mgl-3-22','MGL-3',3),
('y3-mgl-3-23','MGL-3',3),
('y3-mgl-3-24','MGL-3',3),
('y3-mgl-3-25','MGL-3',3),
('y3-mgl-3-26','MGL-3',3),
('y3-mgl-3-27','MGL-3',3),
('y3-mgl-3-28','MGL-3',3),
('y3-mgl-3-29','MGL-3',3),
('y3-mgl-3-30','MGL-3',3),
('y3-mgl-3-31','MGL-3',3),
('y3-mgl-3-32','MGL-3',3),
('y3-mgl-3-33','MGL-3',3),
('y3-mug-3-01','MUG-3',3),
('y3-mug-3-02','MUG-3',3),
('y3-mug-3-03','MUG-3',3),
('y3-mug-3-04','MUG-3',3),
('y3-mug-3-05','MUG-3',3),
('y3-mug-3-06','MUG-3',3),
('y3-mug-3-07','MUG-3',3),
('y3-mug-3-08','MUG-3',3),
('y3-mug-3-09','MUG-3',3),
('y3-mug-3-10','MUG-3',3),
('y3-mug-3-11','MUG-3',3),
('y3-mug-3-12','MUG-3',3),
('y3-mug-3-13','MUG-3',3),
('y3-mug-3-14','MUG-3',3),
('y3-mug-3-15','MUG-3',3),
('y3-mug-3-16','MUG-3',3),
('y3-mug-3-17','MUG-3',3),
('y3-mug-3-18','MUG-3',3),
('y3-mug-3-19','MUG-3',3),
('y3-mug-3-20','MUG-3',3),
('y3-mug-3-21','MUG-3',3),
('y3-mug-3-22','MUG-3',3),
('y3-mug-3-23','MUG-3',3),
('y3-mug-3-24','MUG-3',3),
('y3-mug-3-25','MUG-3',3),
('y3-mug-3-26','MUG-3',3),
('y3-mug-3-27','MUG-3',3),
('y3-mug-3-28','MUG-3',3),
('y3-mug-3-29','MUG-3',3),
('y3-mug-3-30','MUG-3',3),
('y3-mug-3-31','MUG-3',3)
on conflict(lecture_id) do update set module_code=excluded.module_code, academic_year=excluded.academic_year;

alter table public.lecture_module_map enable row level security;
drop policy if exists "lecture_module_map_read" on public.lecture_module_map;
create policy "lecture_module_map_read"
on public.lecture_module_map for select to authenticated
using ((select private.is_admin()) or academic_year=(select p.medical_year from public.profiles p where p.id=auth.uid()));

drop policy if exists "mcq_questions_read_student_year" on public.mcq_questions;
drop policy if exists "mcq_questions_paid_module_read" on public.mcq_questions;
create policy "mcq_questions_paid_module_read"
on public.mcq_questions for select to authenticated
using (
  (select private.is_admin())
  or (
    published=true
    and exists (
      select 1
      from public.lecture_module_map lm
      join public.module_entitlements me
        on me.user_id=auth.uid()
       and me.module_code=lm.module_code
       and me.product_type='mcq'
       and me.revoked_at is null
      where lm.lecture_id=mcq_questions.lecture_id
        and lm.academic_year=(select p.medical_year from public.profiles p where p.id=auth.uid())
    )
  )
);

drop policy if exists "assessment_items_read_student_year" on public.assessment_items;
drop policy if exists "assessment_items_paid_module_read" on public.assessment_items;
create policy "assessment_items_paid_module_read"
on public.assessment_items for select to authenticated
using (
  (select private.is_admin())
  or (
    published=true
    and year=(select p.medical_year from public.profiles p where p.id=auth.uid())
    and (
      (assessment_type='case' and exists (
        select 1 from public.module_entitlements me
        where me.user_id=auth.uid() and me.module_code=assessment_items.module_code and me.product_type='cases' and me.revoked_at is null
      ))
      or (assessment_type in ('osce','ospe') and exists (
        select 1 from public.module_entitlements me
        where me.user_id=auth.uid() and me.module_code=assessment_items.module_code and me.product_type='osce' and me.revoked_at is null
      ))
      or assessment_type='spotter'
    )
  )
);
