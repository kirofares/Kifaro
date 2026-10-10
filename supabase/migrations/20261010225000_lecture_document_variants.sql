create table if not exists public.lecture_document_variants (
  lecture_id text not null,
  variant_key text not null,
  label text not null,
  description text null,
  source_name text null,
  pdf_path text null,
  pptx_path text null,
  sort_order integer not null default 1,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (lecture_id, variant_key)
);

alter table public.lecture_document_variants enable row level security;
revoke all on public.lecture_document_variants from public, anon, authenticated;

drop policy if exists lecture_document_variants_admin_all on public.lecture_document_variants;
create policy lecture_document_variants_admin_all
on public.lecture_document_variants
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

grant select, insert, update, delete on public.lecture_document_variants to authenticated;

create or replace view public.lecture_document_variants_public
with (security_invoker = false)
as
select
  lecture_id,
  variant_key,
  label,
  description,
  sort_order,
  published,
  (pdf_path is not null and length(pdf_path) > 0) as available_pdf,
  (pptx_path is not null and length(pptx_path) > 0) as available_pptx
from public.lecture_document_variants
where published = true;

revoke all on public.lecture_document_variants_public from public;
grant select on public.lecture_document_variants_public to anon, authenticated;

insert into public.lecture_document_variants
  (lecture_id, variant_key, label, description, source_name, pdf_path, pptx_path, sort_order, published)
values
  (
    'y1-found-02',
    'standard',
    'Version 1 · Standard lecture',
    'The currently hosted Introduction to the Skeleton lecture.',
    'Y1_02_Introduction_to_Skeleton',
    'y1-found-02/pdf/Y1_02_Introduction_to_Skeleton.pdf',
    'y1-found-02/pptx/Y1_02_Introduction_to_Skeleton.pptx',
    1,
    true
  ),
  (
    'y1-found-02',
    'extended-slide-9',
    'Version 2 · Extended (with Slide 9)',
    'Keep this as a second approved version rather than replacing Version 1.',
    'Y1_02_Introduction_to_Skeleton_with_Slide_9.pptx',
    null,
    null,
    2,
    true
  )
on conflict (lecture_id, variant_key) do update
set label = excluded.label,
    description = excluded.description,
    source_name = excluded.source_name,
    pdf_path = coalesce(excluded.pdf_path, public.lecture_document_variants.pdf_path),
    pptx_path = coalesce(excluded.pptx_path, public.lecture_document_variants.pptx_path),
    sort_order = excluded.sort_order,
    published = excluded.published,
    updated_at = now();
