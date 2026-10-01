alter table public.lecture_entitlements
  add column if not exists video_access boolean not null default true,
  add column if not exists datashow_access boolean not null default true,
  add column if not exists product_type text not null default 'bundle';

update public.lecture_entitlements
set
  video_access = coalesce(video_access, true),
  datashow_access = coalesce(datashow_access, true),
  product_type = coalesce(nullif(product_type, ''), 'bundle');

alter table public.lecture_entitlements
  drop constraint if exists lecture_entitlements_product_type_check;
alter table public.lecture_entitlements
  add constraint lecture_entitlements_product_type_check
  check (product_type in ('video', 'datashow', 'bundle'));

alter table public.lecture_pricing_rules
  add column if not exists product_type text not null default 'bundle';

update public.lecture_pricing_rules
set product_type = coalesce(nullif(product_type, ''), 'bundle');

alter table public.lecture_pricing_rules
  drop constraint if exists lecture_pricing_rules_product_type_check;
alter table public.lecture_pricing_rules
  add constraint lecture_pricing_rules_product_type_check
  check (product_type in ('video', 'datashow', 'bundle'));

drop policy if exists "assets_select_entitled_free_or_admin" on public.lecture_assets;
drop policy if exists "assets_select_admin_only" on public.lecture_assets;
drop policy if exists "assets_admin_select_only" on public.lecture_assets;

create policy "assets_admin_select_only"
on public.lecture_assets for select
to authenticated
using ((select private.is_admin()));

create or replace function private.consume_lecture_asset(
  p_lecture_id text,
  p_asset_type text
)
returns table(asset_path text, views_used integer, view_limit integer)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_ent public.lecture_entitlements%rowtype;
  v_path text;
  v_next integer := 0;
  v_is_free_video boolean := false;
  v_is_admin boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_asset_type not in ('video', 'datashow', 'pdf', 'pptx') then raise exception 'Invalid asset type'; end if;

  select private.is_admin() into v_is_admin;

  select exists (
    select 1 from public.lecture_settings s
    where s.lecture_id = p_lecture_id
      and s.published = true
      and s.access_mode = 'free'
  ) into v_is_free_video;

  if p_asset_type in ('pdf', 'pptx') and not v_is_admin then
    raise exception 'Original files are admin only';
  end if;

  if not v_is_admin then
    if p_asset_type = 'video' and v_is_free_video then
      v_next := 0;
    else
      select * into v_ent
      from public.lecture_entitlements
      where user_id = v_uid
        and lecture_id = p_lecture_id
        and revoked_at is null
      for update;

      if not found then raise exception 'No active access'; end if;
      if p_asset_type = 'video' and not v_ent.video_access then raise exception 'Video access required'; end if;
      if p_asset_type = 'datashow' and not v_ent.datashow_access then raise exception 'Datashow access required'; end if;

      if p_asset_type = 'video' then
        if v_ent.view_limit is not null and v_ent.views_used >= v_ent.view_limit then
          raise exception 'View limit reached';
        end if;
        v_next := v_ent.views_used + 1;
        update public.lecture_entitlements
        set views_used = v_next
        where user_id = v_uid and lecture_id = p_lecture_id;
      else
        v_next := v_ent.views_used;
      end if;
    end if;
  end if;

  select case p_asset_type
      when 'video' then a.video_path
      when 'datashow' then a.pdf_path
      when 'pdf' then a.pdf_path
      when 'pptx' then a.pptx_path
    end
  into v_path
  from public.lecture_assets a
  where a.lecture_id = p_lecture_id;

  if v_path is null or btrim(v_path) = '' then raise exception 'Asset is not available yet'; end if;

  return query
  select
    v_path,
    v_next,
    case when v_is_admin or (p_asset_type = 'video' and v_is_free_video) then null else v_ent.view_limit end;
end;
$$;

create or replace function public.consume_lecture_asset(
  p_lecture_id text,
  p_asset_type text
)
returns table(asset_path text, views_used integer, view_limit integer)
language sql
security invoker
set search_path = public, private
as $$
  select * from private.consume_lecture_asset(p_lecture_id, p_asset_type);
$$;

revoke all on function public.consume_lecture_asset(text, text) from public;
grant execute on function public.consume_lecture_asset(text, text) to authenticated;
