-- The first lecture of each current AnatoMate block is free, including protected slides.
-- Other lectures and module MCQ / Cases / OSCE entitlements are unaffected.
with module_openings(module_code, lecture_id) as (
  values
  ('ORIENTATION', 'y1-orientation-01'),
  ('IAE-1', 'y1-found-01'),
  ('MLS-1', 'y1-mls-1-21'),
  ('MBL-2', 'y2-mbl-2-01'),
  ('MRS-2', 'y2-mrs-2-07'),
  ('MCVS-2', 'y2-mcvs-2-18'),
  ('MCNS-2', 'y2-mcns-2-29'),
  ('MSS-2', 'y2-mss-2-48'),
  ('MEM-2', 'y2-mem-2-56'),
  ('MGL-3', 'y3-hn-01'),
  ('MUG-3', 'y3-mug-3-01')
),
validated_openings as (
  select o.lecture_id from module_openings o
  join public.lecture_module_map m
    on m.lecture_id = o.lecture_id and m.module_code = o.module_code
)
insert into public.lecture_settings (lecture_id, access_mode, price_egp, published)
select lecture_id, 'free', 0, true from validated_openings
on conflict (lecture_id) do update
  set access_mode = 'free', price_egp = 0, updated_at = now();

-- Free status authorizes secure video and watermarked slides, not original downloads.
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

-- Do not accept new manual payments for free lectures.
create or replace function private.reject_free_lecture_manual_payment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.target_type = 'lecture'
    and exists (
      select 1 from public.lecture_settings s
      where s.lecture_id = new.lecture_id
        and s.published = true and s.access_mode = 'free'
    )
  then
    raise exception 'This lecture is free. Open it directly without payment.';
  end if;
  return new;
end;
$$;
drop trigger if exists reject_free_lecture_manual_payment_trigger on public.manual_payment_requests;
create trigger reject_free_lecture_manual_payment_trigger
before insert on public.manual_payment_requests
for each row execute function private.reject_free_lecture_manual_payment();
