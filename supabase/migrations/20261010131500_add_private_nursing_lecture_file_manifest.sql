-- Admin-only catalog of private nursing lecture source files.
-- Student viewing must be served through an authenticated, entitlement-aware endpoint.
create table if not exists public.nursing_lecture_files (
 lecture_id text not null,
 file_kind text not null check (file_kind in ('visual_pdf','visual_pptx','workbook_pdf','workbook_docx')),
 storage_path text not null,
 original_name text not null,
 mime_type text,
 file_size bigint not null check (file_size between 1 and 52428800),
 uploaded_by uuid references auth.users(id),
 uploaded_at timestamptz not null default now(),
 primary key (lecture_id,file_kind)
);
alter table public.nursing_lecture_files enable row level security;
do $policies$
begin
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='nursing_lecture_files' and policyname='nursing_files_admin_select') then
   create policy nursing_files_admin_select on public.nursing_lecture_files for select to authenticated using ((select private.is_admin()));
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='nursing_lecture_files' and policyname='nursing_files_admin_insert') then
   create policy nursing_files_admin_insert on public.nursing_lecture_files for insert to authenticated with check ((select private.is_admin()));
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='nursing_lecture_files' and policyname='nursing_files_admin_update') then
   create policy nursing_files_admin_update on public.nursing_lecture_files for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
 end if;
end
$policies$;
grant select, insert, update on public.nursing_lecture_files to authenticated;