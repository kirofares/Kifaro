drop view if exists public.lecture_asset_readiness;

create view public.lecture_asset_readiness as
select
  lecture_id,
  (video_path is not null and btrim(video_path) <> '') as has_video,
  (pdf_path is not null and btrim(pdf_path) <> '') as has_datashow,
  (pdf_path is not null and btrim(pdf_path) <> '') as has_pdf,
  (pptx_path is not null and btrim(pptx_path) <> '') as has_pptx
from public.lecture_assets;

revoke all on public.lecture_asset_readiness from public;
grant select on public.lecture_asset_readiness to anon, authenticated;
