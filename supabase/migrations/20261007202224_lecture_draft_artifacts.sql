alter table public.lecture_drafts
  add column if not exists pptx_path text;

alter table public.lecture_drafts
  add column if not exists pdf_path text;

alter table public.lecture_drafts
  add column if not exists artifacts_built_at timestamptz;
