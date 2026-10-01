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

  if p_asset_type not in ('video', 'datashow', 'document', 'pdf', 'pptx') then
    raise exception 'Invalid asset type';
  end if;

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
      if p_asset_type in ('datashow', 'document') and not v_ent.datashow_access then raise exception 'Datashow access required'; end if;

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
      when 'document' then a.pdf_path
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
