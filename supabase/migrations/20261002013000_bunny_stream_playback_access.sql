create or replace function private.consume_bunny_video(
  p_lecture_id text
)
returns table(video_id text, views_used integer, view_limit integer)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_ent public.lecture_entitlements%rowtype;
  v_video_id text;
  v_next integer := 0;
  v_is_free boolean := false;
  v_is_admin boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

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
    select * into v_ent
    from public.lecture_entitlements
    where user_id = v_uid
      and lecture_id = p_lecture_id
      and revoked_at is null
    for update;

    if not found or not v_ent.video_access then
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
$$;

create or replace function public.consume_bunny_video(
  p_lecture_id text
)
returns table(video_id text, views_used integer, view_limit integer)
language sql
security invoker
set search_path = public, private
as $$
  select * from private.consume_bunny_video(p_lecture_id);
$$;

revoke all on function public.consume_bunny_video(text) from public;
grant execute on function public.consume_bunny_video(text) to authenticated;
