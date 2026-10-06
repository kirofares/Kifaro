alter table public.mcq_questions
  add column if not exists image_url text,
  add column if not exists image_alt text;

create table if not exists public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_type text not null check (assessment_type in ('case','osce','ospe','spotter')),
  year smallint not null check (year between 1 and 6),
  module_code text not null,
  lecture_id text,
  title text not null,
  stem text not null default '',
  instructions text,
  media_url text,
  media_alt text,
  difficulty smallint not null default 2 check (difficulty between 1 and 3),
  time_limit_seconds integer,
  content jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessment_items_type_year_module_idx
  on public.assessment_items(assessment_type, year, module_code, published);
create index if not exists assessment_items_lecture_idx
  on public.assessment_items(lecture_id);

alter table public.assessment_items enable row level security;

drop policy if exists "assessment_items_read_published" on public.assessment_items;
create policy "assessment_items_read_published"
on public.assessment_items for select
to anon, authenticated
using (published = true or (select private.is_admin()));

drop policy if exists "assessment_items_admin_all" on public.assessment_items;
create policy "assessment_items_admin_all"
on public.assessment_items for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create table if not exists public.assessment_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_item_id uuid not null references public.assessment_items(id) on delete cascade,
  score numeric(8,2) not null default 0,
  max_score numeric(8,2) not null default 0,
  details jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

create index if not exists assessment_attempts_user_item_idx
  on public.assessment_attempts(user_id, assessment_item_id, completed_at desc);

alter table public.assessment_attempts enable row level security;
drop policy if exists "assessment_attempts_own_select" on public.assessment_attempts;
create policy "assessment_attempts_own_select" on public.assessment_attempts for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "assessment_attempts_own_insert" on public.assessment_attempts;
create policy "assessment_attempts_own_insert" on public.assessment_attempts for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "assessment_attempts_admin_select" on public.assessment_attempts;
create policy "assessment_attempts_admin_select" on public.assessment_attempts for select to authenticated using ((select private.is_admin()));


insert into public.assessment_items
  (assessment_type,year,module_code,lecture_id,title,stem,instructions,difficulty,time_limit_seconds,content,published)
select
  'case',2,'MCNS-2','y2-cns-31','Meningeal irritation case',
  'A patient presents with severe headache, photophobia and neck stiffness. Use the meningeal anatomy to explain the pain-sensitive structures and the rationale for lumbar puncture level.',
  'Work through the case, then answer the questions before revealing the key points.',
  2,420,
  jsonb_build_object(
    'questions', jsonb_build_array(
      jsonb_build_object('prompt','Which space normally contains CSF?','options',jsonb_build_array('Epidural','Subdural','Subarachnoid','Subpial'),'answer',2,'explanation','CSF circulates in the subarachnoid space.'),
      jsonb_build_object('prompt','Why is lumbar puncture performed below the adult spinal cord?','options',jsonb_build_array('To avoid the cauda equina','To avoid direct cord injury','To enter the epidural space','To bypass the dura'),'answer',1,'explanation','The cord usually ends above the standard lumbar puncture levels, reducing risk of direct cord injury.')
    ),
    'key_points', jsonb_build_array('Meningeal layers and spaces','Lumbar cistern anatomy','Clinical relevance of lumbar puncture level')
  ),
  true
where not exists (select 1 from public.assessment_items where title='Meningeal irritation case');

insert into public.assessment_items
  (assessment_type,year,module_code,lecture_id,title,stem,instructions,difficulty,time_limit_seconds,content,published)
select
  'ospe',2,'MCNS-2','y2-cns-33','Spinal cord practical station',
  'Practical anatomy station: identify external spinal cord landmarks and relate them to a safe lumbar puncture.',
  'Complete the station checklist as if you were answering a practical/OSPE station.',
  2,300,
  jsonb_build_object(
    'checklist', jsonb_build_array(
      jsonb_build_object('label','Identifies conus medullaris','marks',1),
      jsonb_build_object('label','Identifies cauda equina','marks',1),
      jsonb_build_object('label','Explains lumbar cistern','marks',1),
      jsonb_build_object('label','States a safe lumbar puncture level','marks',1)
    ),
    'key_points', jsonb_build_array('Conus medullaris','Cauda equina','Lumbar cistern','Lumbar puncture level')
  ),
  true
where not exists (select 1 from public.assessment_items where title='Spinal cord practical station');

insert into public.assessment_items
  (assessment_type,year,module_code,lecture_id,title,stem,instructions,difficulty,time_limit_seconds,content,published)
select
  'osce',1,'IAE-1','y1-found-01','Anatomical communication station',
  'Explain the anatomical position and directional terms to a junior student using clear, structured language.',
  'Use the checklist to self-assess communication and anatomical accuracy.',
  1,300,
  jsonb_build_object(
    'checklist', jsonb_build_array(
      jsonb_build_object('label','States standard anatomical position correctly','marks',2),
      jsonb_build_object('label','Uses superior/inferior correctly','marks',1),
      jsonb_build_object('label','Uses medial/lateral correctly','marks',1),
      jsonb_build_object('label','Explains anterior/posterior correctly','marks',1),
      jsonb_build_object('label','Communicates in a structured and clear way','marks',1)
    )
  ),
  true
where not exists (select 1 from public.assessment_items where title='Anatomical communication station');

insert into public.assessment_items
  (assessment_type,year,module_code,lecture_id,title,stem,instructions,difficulty,time_limit_seconds,content,published)
select
  'spotter',1,'IAE-1','y1-found-02','Joint classification spotter',
  'Identify the joint type shown by the provided image/specimen and state one movement permitted by this joint.',
  'Image can be attached later from the Admin assessment manager.',
  1,90,
  jsonb_build_object(
    'checklist', jsonb_build_array(
      jsonb_build_object('label','Correctly identifies the joint class','marks',1),
      jsonb_build_object('label','States one correct movement','marks',1)
    )
  ),
  true
where not exists (select 1 from public.assessment_items where title='Joint classification spotter');
