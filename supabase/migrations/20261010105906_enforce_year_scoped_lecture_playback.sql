-- Mirror of the production schema update applied on 2026-10-10.
-- Reject access to another year's lectures inside server-side consumption RPCs.
CREATE OR REPLACE FUNCTION private.assert_lecture_student_year(p_lecture_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF (select auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF (SELECT private.is_admin()) THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.lecture_module_map lm ON lm.academic_year = p.medical_year
    WHERE p.id = (select auth.uid()) AND lm.lecture_id = p_lecture_id
  ) THEN RAISE EXCEPTION 'Lecture not available for student academic year'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION private.consume_bunny_video(p_lecture_id text)
 RETURNS TABLE(video_id text, views_used integer, view_limit integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_ent public.lecture_entitlements%rowtype;
  v_video_id text;
  v_next integer := 0;
  v_is_free boolean := false;
  v_is_admin boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform private.assert_lecture_student_year(p_lecture_id);

  select private.is_admin() into v_is_admin;

  select exists (
    select 1
    from public.lecture_settings s
    where s.lecture_id = p_lecture_id
      and s.published = true
      and s.access_mode = 'free'
  ) into v_is_free;

  select a.bunny_video_id
    into v_video_id
  from public.lecture_assets a
  where a.lecture_id = p_lecture_id
    and a.video_provider = 'bunny'
    and a.bunny_status = 'ready';

  if v_video_id is null or btrim(v_video_id) = '' then
    raise exception 'Video is not ready yet';
  end if;

  if not v_is_admin and not v_is_free then
    select *
      into v_ent
    from public.lecture_entitlements
    where user_id = v_uid
      and lecture_id = p_lecture_id
      and revoked_at is null
    for update;

    if not found then
      raise exception 'Video access required';
    end if;

    if not v_ent.video_access then
      raise exception 'Video access required';
    end if;

    if v_ent.view_limit is not null and v_ent.views_used >= v_ent.view_limit then
      raise exception 'View limit reached';
    end if;

    v_next := v_ent.views_used + 1;

    update public.lecture_entitlements
    set views_used = v_next
    where user_id = v_uid
      and lecture_id = p_lecture_id;
  elsif not v_is_admin and v_is_free then
    v_next := 0;
  end if;

  return query
  select
    v_video_id,
    v_next,
    case when v_is_admin or v_is_free then null else v_ent.view_limit end;
end;
$function$;

CREATE OR REPLACE FUNCTION private.consume_lecture_asset(p_lecture_id text, p_asset_type text)
 RETURNS TABLE(asset_path text, views_used integer, view_limit integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_ent public.lecture_entitlements%rowtype;
  v_path text;
  v_next integer := 0;
  v_is_free_lecture boolean := false;
  v_is_admin boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  perform private.assert_lecture_student_year(p_lecture_id);

  if p_asset_type not in ('video', 'datashow', 'document', 'pdf', 'pptx') then
    raise exception 'Invalid asset type';
  end if;

  select private.is_admin() into v_is_admin;

  select exists (
    select 1 from public.lecture_settings s
    where s.lecture_id = p_lecture_id
      and s.published = true
      and s.access_mode = 'free'
  ) into v_is_free_lecture;

  if p_asset_type in ('pdf', 'pptx') and not v_is_admin then
    raise exception 'Original files are admin only';
  end if;

  if not v_is_admin then
    if p_asset_type in ('video', 'datashow', 'document') and v_is_free_lecture then
      v_next := 0;
    else
      select * into v_ent
      from public.lecture_entitlements
      where user_id = v_uid
        and lecture_id = p_lecture_id
        and revoked_at is null
      for update;

      if not found then raise exception 'No active access'; end if;

      if p_asset_type = 'video' and not v_ent.video_access then
        raise exception 'Video access required';
      end if;

      if p_asset_type in ('datashow', 'document') and not v_ent.datashow_access then
        raise exception 'Datashow access required';
      end if;

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

  if v_path is null or btrim(v_path) = '' then
    raise exception 'Asset is not available yet';
  end if;

  return query
  select
    v_path,
    v_next,
    case when v_is_admin or (p_asset_type in ('video', 'datashow', 'document') and v_is_free_lecture) then null else v_ent.view_limit end;
end;
$function$;

CREATE OR REPLACE FUNCTION private.consume_lecture_view(p_lecture_id text)
 RETURNS TABLE(video_url text, views_used integer, view_limit integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_ent public.lecture_entitlements%rowtype;
  v_url text;
  v_next integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform private.assert_lecture_student_year(p_lecture_id);

  select *
    into v_ent
  from public.lecture_entitlements
  where user_id = v_uid
    and lecture_id = p_lecture_id
    and revoked_at is null
  for update;

  if not found then
    raise exception 'No active lecture access';
  end if;

  if v_ent.view_limit is not null and v_ent.views_used >= v_ent.view_limit then
    raise exception 'View limit reached';
  end if;

  select a.video_url
    into v_url
  from public.lecture_assets a
  where a.lecture_id = p_lecture_id;

  if v_url is null or btrim(v_url) = '' then
    raise exception 'Video is not available yet';
  end if;

  v_next := v_ent.views_used + 1;

  update public.lecture_entitlements
  set views_used = v_next
  where user_id = v_uid and lecture_id = p_lecture_id;

  return query select v_url, v_next, v_ent.view_limit;
end;
$function$;

CREATE OR REPLACE FUNCTION public.consume_lecture_view_path(p_user_id uuid, p_lecture_id text)
 RETURNS TABLE(video_storage_path text, views_used integer, view_limit integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_ent public.lecture_entitlements%rowtype;
  v_path text;
  v_next integer;
begin
  if not exists (
    select 1 from public.profiles prof
    left join public.lecture_module_map lm
      on lm.lecture_id = p_lecture_id AND lm.academic_year = prof.medical_year
    where prof.id = p_user_id AND (prof.role = 'admin' OR lm.lecture_id IS NOT NULL)
  ) then raise exception 'Lecture not available for student academic year'; end if;
  select *
    into v_ent
  from public.lecture_entitlements
  where user_id = p_user_id
    and lecture_id = p_lecture_id
    and revoked_at is null
  for update;

  if not found then
    raise exception 'No active lecture access';
  end if;

  if v_ent.view_limit is not null and v_ent.views_used >= v_ent.view_limit then
    raise exception 'View limit reached';
  end if;

  select a.video_storage_path
    into v_path
  from public.lecture_assets a
  where a.lecture_id = p_lecture_id;

  if v_path is null or btrim(v_path) = '' then
    raise exception 'Protected video is not available yet';
  end if;

  v_next := v_ent.views_used + 1;

  update public.lecture_entitlements
  set views_used = v_next
  where user_id = p_user_id
    and lecture_id = p_lecture_id;

  return query select v_path, v_next, v_ent.view_limit;
end;
$function$;
REVOKE ALL ON FUNCTION private.assert_lecture_student_year(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.consume_bunny_video(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.consume_bunny_video(text) FROM PUBLIC,anon;
