create or replace function public.recalculate_module_entitlement_after_payment_change(
  p_user_id uuid,p_module_code text,p_product_type text
)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_pay record; v_manual record; v_best_source text; v_granted timestamptz;
  v_expires timestamptz; v_price numeric; v_year integer;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;

  select 'paymob:'||pt.paymob_transaction_id::text source,
         coalesce(pt.paid_at,pt.updated_at,pt.created_at) granted_at,
         coalesce(pt.paid_at,pt.updated_at,pt.created_at)+interval '6 months' expires_at,
         pt.amount_egp price_paid_egp
  into v_pay
  from public.payment_transactions pt
  where pt.user_id=p_user_id and pt.module_code=p_module_code
    and pt.product_type=p_product_type||'_module'
    and pt.status='paid'
    and coalesce(pt.paid_at,pt.updated_at,pt.created_at)+interval '6 months'>now()
  order by coalesce(pt.paid_at,pt.updated_at,pt.created_at) desc limit 1;

  select 'manual:'||r.reference_code source,
         coalesce(r.reviewed_at,r.created_at) granted_at,
         coalesce(r.reviewed_at,r.created_at)+interval '6 months' expires_at,
         r.amount_egp price_paid_egp,r.academic_year
  into v_manual
  from public.manual_payment_requests r
  where r.user_id=p_user_id and r.target_type='module'
    and r.module_code=p_module_code and r.product_type=p_product_type
    and r.status='approved'
    and coalesce(r.reviewed_at,r.created_at)+interval '6 months'>now()
  order by coalesce(r.reviewed_at,r.created_at) desc limit 1;

  if v_pay.granted_at is null and v_manual.granted_at is null then
    update public.module_entitlements set revoked_at=coalesce(revoked_at,now())
    where user_id=p_user_id and module_code=p_module_code and product_type=p_product_type;
    return;
  end if;

  if v_manual.granted_at is null or (v_pay.granted_at is not null and v_pay.granted_at>=v_manual.granted_at) then
    v_best_source:=v_pay.source; v_granted:=v_pay.granted_at; v_expires:=v_pay.expires_at; v_price:=v_pay.price_paid_egp;
  else
    v_best_source:=v_manual.source; v_granted:=v_manual.granted_at; v_expires:=v_manual.expires_at; v_price:=v_manual.price_paid_egp;
  end if;

  select academic_year into v_year from public.module_products
  where module_code=p_module_code and product_type=p_product_type limit 1;

  insert into public.module_entitlements(user_id,module_code,product_type,academic_year,price_paid_egp,source,granted_at,expires_at,revoked_at)
  values(p_user_id,p_module_code,p_product_type,v_year,coalesce(v_price,0),v_best_source,v_granted,v_expires,null)
  on conflict(user_id,module_code,product_type) do update set
    academic_year=excluded.academic_year,price_paid_egp=excluded.price_paid_egp,source=excluded.source,
    granted_at=excluded.granted_at,expires_at=excluded.expires_at,revoked_at=null;
end;
$$;
revoke all on function public.recalculate_module_entitlement_after_payment_change(uuid,text,text) from public,anon,authenticated;
grant execute on function public.recalculate_module_entitlement_after_payment_change(uuid,text,text) to service_role;

create or replace function public.recalculate_lecture_entitlement_after_payment_change(p_user_id uuid,p_lecture_id text)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_video boolean:=false; v_datashow boolean:=false; v_total numeric:=0;
  v_latest timestamptz; v_latest_source text; v_view_limit integer;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;

  select coalesce(bool_or(product_type in ('video','bundle')),false),
         coalesce(bool_or(product_type in ('datashow','bundle')),false),
         coalesce(sum(amount_egp),0),max(coalesce(paid_at,updated_at,created_at))
  into v_video,v_datashow,v_total,v_latest
  from public.payment_transactions
  where user_id=p_user_id and lecture_id=p_lecture_id and status='paid'
    and product_type in ('video','datashow','bundle');

  select v_video or coalesce(bool_or(product_type in ('video','bundle')),false),
         v_datashow or coalesce(bool_or(product_type in ('datashow','bundle')),false),
         v_total+coalesce(sum(amount_egp),0),
         greatest(v_latest,max(coalesce(reviewed_at,created_at))),
         max(view_limit) filter(where product_type in ('video','bundle'))
  into v_video,v_datashow,v_total,v_latest,v_view_limit
  from public.manual_payment_requests
  where user_id=p_user_id and target_type='lecture' and lecture_id=p_lecture_id and status='approved';

  if not v_video and not v_datashow then
    update public.lecture_entitlements set video_access=false,datashow_access=false,revoked_at=coalesce(revoked_at,now())
    where user_id=p_user_id and lecture_id=p_lecture_id;
    return;
  end if;

  select source into v_latest_source from (
    select 'paymob:'||paymob_transaction_id::text source,coalesce(paid_at,updated_at,created_at) ts
    from public.payment_transactions where user_id=p_user_id and lecture_id=p_lecture_id and status='paid'
    union all
    select 'manual:'||reference_code,coalesce(reviewed_at,created_at)
    from public.manual_payment_requests where user_id=p_user_id and target_type='lecture' and lecture_id=p_lecture_id and status='approved'
  ) s order by ts desc nulls last limit 1;

  insert into public.lecture_entitlements(
    user_id,lecture_id,price_paid_egp,source,granted_at,revoked_at,view_limit,views_used,video_access,datashow_access,product_type
  ) values (
    p_user_id,p_lecture_id,v_total,coalesce(v_latest_source,'recalculated'),coalesce(v_latest,now()),null,
    case when v_video then v_view_limit else null end,0,v_video,v_datashow,
    case when v_video and v_datashow then 'bundle' when v_video then 'video' else 'datashow' end
  )
  on conflict(user_id,lecture_id) do update set
    price_paid_egp=excluded.price_paid_egp,source=excluded.source,revoked_at=null,
    video_access=excluded.video_access,datashow_access=excluded.datashow_access,product_type=excluded.product_type,
    view_limit=case when excluded.video_access then coalesce(public.lecture_entitlements.view_limit,excluded.view_limit) else null end;
end;
$$;
revoke all on function public.recalculate_lecture_entitlement_after_payment_change(uuid,text) from public,anon,authenticated;
grant execute on function public.recalculate_lecture_entitlement_after_payment_change(uuid,text) to service_role;
