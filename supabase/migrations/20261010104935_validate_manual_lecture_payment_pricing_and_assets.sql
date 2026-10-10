-- Applied to production via Supabase migration 20261010104935.
-- Prevent arbitrary client-side prices, wrong-year purchases, and buying unavailable lectures.
CREATE OR REPLACE FUNCTION private.validate_manual_lecture_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_profile public.profiles%rowtype;
  v_asset public.lecture_assets%rowtype;
  v_setting public.lecture_settings%rowtype;
  v_rule record;
  v_has_rule boolean := false;
  v_has_setting boolean := false;
  v_has_pdf boolean := false;
  v_has_video boolean := false;
begin
  if new.target_type <> 'lecture' then
    return new;
  end if;

  if (select auth.uid()) is null or new.user_id is distinct from (select auth.uid()) then
    raise exception 'Authenticated student account required';
  end if;

  select * into v_profile from public.profiles where id = (select auth.uid());
  if not found or v_profile.medical_year is null then
    raise exception 'Complete your academic profile before payment';
  end if;

  if new.academic_year is distinct from v_profile.medical_year
     or not exists (
       select 1 from public.lecture_module_map lm
       where lm.lecture_id = new.lecture_id
         and lm.academic_year = v_profile.medical_year
     ) then
    raise exception 'This lecture does not belong to your academic year';
  end if;

  select * into v_setting from public.lecture_settings where lecture_id = new.lecture_id;
  v_has_setting := found;
  if v_has_setting and (v_setting.published is distinct from true or v_setting.access_mode = 'free') then
    raise exception 'This lecture is not available for paid checkout';
  end if;

  select * into v_asset from public.lecture_assets where lecture_id = new.lecture_id;
  if not found then
    raise exception 'The lecture material is not available yet';
  end if;
  v_has_pdf := coalesce(
    nullif(v_asset.pdf_url, ''), nullif(v_asset.pdf_path, ''),
    nullif(v_asset.pptx_url, ''), nullif(v_asset.pptx_path, '')
  ) is not null;
  v_has_video := coalesce(
    nullif(v_asset.video_url, ''), nullif(v_asset.video_path, ''),
    nullif(v_asset.video_storage_path, ''), nullif(v_asset.bunny_video_id, '')
  ) is not null;

  if (new.product_type = 'datashow' and not v_has_pdf)
     or (new.product_type = 'video' and not v_has_video)
     or (new.product_type = 'bundle' and (not v_has_pdf or not v_has_video))
     or new.product_type not in ('datashow', 'video', 'bundle') then
    raise exception 'The selected lecture format is not ready for purchase';
  end if;

  -- Never trust amount_egp or view_limit submitted in the browser.
  select r.price_egp, r.view_limit into v_rule
  from public.lecture_pricing_rules r
  where r.lecture_id = new.lecture_id
    and r.product_type = new.product_type
    and r.enabled
    and (r.academic_year is null or r.academic_year = v_profile.medical_year)
    and (
      r.nationality_match = '*'
      or lower(r.nationality_match) = lower(coalesce(v_profile.nationality, ''))
      or (r.nationality_match = 'NON_EGYPTIAN'
          and lower(coalesce(v_profile.nationality, '')) not in ('egyptian','egypt'))
    )
  order by
    (case when r.academic_year is null then 0 else 20 end)
    + (case when r.nationality_match = '*' then 0 when r.nationality_match = 'NON_EGYPTIAN' then 5 else 10 end)
    + coalesce(r.priority, 0) desc
  limit 1;
  v_has_rule := found;

  if v_has_rule and coalesce(v_rule.price_egp, 0) > 0 then
    new.amount_egp := v_rule.price_egp;
    new.view_limit := v_rule.view_limit;
  elsif v_has_setting and v_setting.published = true
        and v_setting.access_mode = 'paid'
        and v_setting.price_egp > 0 then
    if new.product_type = 'video' then
      new.amount_egp := v_setting.price_egp;
    elsif new.product_type = 'datashow' then
      new.amount_egp := greatest(30, v_setting.price_egp);
    else
      new.amount_egp := v_setting.price_egp + greatest(30, v_setting.price_egp);
    end if;
    new.view_limit := null;
  elsif new.product_type = 'datashow' then
    -- Legacy approved 30 EGP datashow offer, only for a real uploaded lecture.
    new.amount_egp := 30;
    new.view_limit := null;
  else
    raise exception 'This lecture format needs admin pricing before checkout';
  end if;

  return new;
end;
$function$


DROP TRIGGER IF EXISTS zz_validate_manual_lecture_payment ON public.manual_payment_requests;
CREATE TRIGGER zz_validate_manual_lecture_payment
BEFORE INSERT ON public.manual_payment_requests
FOR EACH ROW EXECUTE FUNCTION private.validate_manual_lecture_payment();

REVOKE ALL ON FUNCTION private.validate_manual_lecture_payment() FROM public, anon, authenticated;
COMMENT ON FUNCTION private.validate_manual_lecture_payment() IS
'Trigger-only, server-authoritative lecture year, asset availability, and price verification for manual checkout.';
