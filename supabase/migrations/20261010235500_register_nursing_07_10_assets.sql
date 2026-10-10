-- Register approved Nursing lecture assets already present in private kifaro-content storage.
-- Safe to re-run: one record per lecture_id + file_kind.
insert into public.nursing_lecture_files
  (lecture_id,file_kind,storage_path,original_name,mime_type,file_size,uploaded_by,uploaded_at)
select
  'nursing-y1-general-anatomy-' || lpad((regexp_match(name, 'lecture-([0-9]{2})/'))[1],2,'0') as lecture_id,
  (regexp_match(name, 'lecture-[0-9]{2}/([^/]+)/'))[1] as file_kind,
  name as storage_path,
  split_part(name,'/',array_length(string_to_array(name,'/'),1)) as original_name,
  case
    when name like '%.pdf' then 'application/pdf'
    when name like '%.pptx' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    else 'application/octet-stream'
  end as mime_type,
  coalesce((metadata->>'size')::bigint,0) as file_size,
  null::uuid as uploaded_by,
  created_at as uploaded_at
from storage.objects
where bucket_id='kifaro-content'
  and name like 'nursing/year-1/general-anatomy/lecture-%'
  and name ~ 'lecture-(07|08|09|10)/(visual_pdf|visual_pptx|workbook_pdf)/'
on conflict (lecture_id,file_kind) do update
set storage_path=excluded.storage_path,
    original_name=excluded.original_name,
    mime_type=excluded.mime_type,
    file_size=excluded.file_size,
    uploaded_at=excluded.uploaded_at;
