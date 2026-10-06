create table if not exists public.lecture_asset_readiness_public (
  lecture_id text primary key,
  has_video boolean not null default false,
  has_datashow boolean not null default false,
  has_pdf boolean not null default false,
  has_pptx boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.lecture_asset_readiness_public enable row level security;

drop policy if exists "readiness_public_select" on public.lecture_asset_readiness_public;
create policy "readiness_public_select"
on public.lecture_asset_readiness_public
for select
to anon, authenticated
using (true);

revoke insert, update, delete on public.lecture_asset_readiness_public from anon, authenticated;
grant select on public.lecture_asset_readiness_public to anon, authenticated;

create or replace function private.sync_lecture_asset_readiness()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id text;
  v_video boolean;
  v_pdf boolean;
  v_pptx boolean;
begin
  if tg_op = 'DELETE' then
    delete from public.lecture_asset_readiness_public where lecture_id = old.lecture_id;
    return old;
  end if;

  v_id := new.lecture_id;
  v_video :=
    (new.video_path is not null and btrim(new.video_path) <> '')
    or
    (new.video_provider = 'bunny' and new.bunny_video_id is not null and btrim(new.bunny_video_id) <> '' and new.bunny_status = 'ready');
  v_pdf := new.pdf_path is not null and btrim(new.pdf_path) <> '';
  v_pptx := new.pptx_path is not null and btrim(new.pptx_path) <> '';

  insert into public.lecture_asset_readiness_public
    (lecture_id, has_video, has_datashow, has_pdf, has_pptx, updated_at)
  values
    (v_id, v_video, v_pdf, v_pdf, v_pptx, now())
  on conflict (lecture_id) do update set
    has_video = excluded.has_video,
    has_datashow = excluded.has_datashow,
    has_pdf = excluded.has_pdf,
    has_pptx = excluded.has_pptx,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_lecture_asset_readiness on public.lecture_assets;
create trigger trg_sync_lecture_asset_readiness
after insert or update or delete on public.lecture_assets
for each row execute function private.sync_lecture_asset_readiness();

insert into public.lecture_asset_readiness_public
  (lecture_id, has_video, has_datashow, has_pdf, has_pptx, updated_at)
select
  a.lecture_id,
  ((a.video_path is not null and btrim(a.video_path) <> '')
    or
   (a.video_provider = 'bunny' and a.bunny_video_id is not null and btrim(a.bunny_video_id) <> '' and a.bunny_status = 'ready')),
  (a.pdf_path is not null and btrim(a.pdf_path) <> ''),
  (a.pdf_path is not null and btrim(a.pdf_path) <> ''),
  (a.pptx_path is not null and btrim(a.pptx_path) <> ''),
  now()
from public.lecture_assets a
on conflict (lecture_id) do update set
  has_video = excluded.has_video,
  has_datashow = excluded.has_datashow,
  has_pdf = excluded.has_pdf,
  has_pptx = excluded.has_pptx,
  updated_at = now();

drop view if exists public.lecture_asset_readiness;
create view public.lecture_asset_readiness
with (security_invoker = true)
as
select lecture_id, has_video, has_datashow, has_pdf, has_pptx
from public.lecture_asset_readiness_public;

grant select on public.lecture_asset_readiness to anon, authenticated;

create or replace function public.get_lecture_asset_readiness()
returns table(lecture_id text, has_video boolean, has_datashow boolean, has_pdf boolean, has_pptx boolean)
language sql
security invoker
set search_path = public
as $$
  select lecture_id, has_video, has_datashow, has_pdf, has_pptx
  from public.lecture_asset_readiness_public;
$$;

grant execute on function public.get_lecture_asset_readiness() to anon, authenticated;

create index if not exists lecture_assets_updated_by_idx on public.lecture_assets(updated_by);
create index if not exists lecture_pricing_rules_updated_by_idx on public.lecture_pricing_rules(updated_by);
create index if not exists lecture_settings_updated_by_idx on public.lecture_settings(updated_by);
