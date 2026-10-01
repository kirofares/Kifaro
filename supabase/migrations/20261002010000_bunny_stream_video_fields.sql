alter table public.lecture_assets
  add column if not exists video_provider text,
  add column if not exists bunny_video_id text,
  add column if not exists bunny_status text,
  add column if not exists bunny_encode_progress integer;

alter table public.lecture_assets
  drop constraint if exists lecture_assets_video_provider_check;
alter table public.lecture_assets
  add constraint lecture_assets_video_provider_check
  check (video_provider is null or video_provider in ('supabase','bunny'));

alter table public.lecture_assets
  drop constraint if exists lecture_assets_bunny_status_check;
alter table public.lecture_assets
  add constraint lecture_assets_bunny_status_check
  check (bunny_status is null or bunny_status in ('uploading','processing','ready','error'));

create or replace view public.lecture_asset_readiness as
select
  lecture_id,
  (
    (video_path is not null and btrim(video_path) <> '')
    or
    (video_provider = 'bunny' and bunny_video_id is not null and btrim(bunny_video_id) <> '' and bunny_status = 'ready')
  ) as has_video,
  (pdf_path is not null and btrim(pdf_path) <> '') as has_datashow,
  (pdf_path is not null and btrim(pdf_path) <> '') as has_pdf,
  (pptx_path is not null and btrim(pptx_path) <> '') as has_pptx
from public.lecture_assets;

revoke all on public.lecture_asset_readiness from public;
grant select on public.lecture_asset_readiness to anon, authenticated;
