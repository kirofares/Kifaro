-- Security hardening: students never receive raw Nursing files.
drop policy if exists "kifaro_content_nursing_student_select" on storage.objects;

-- Trusted server-side lecture pricing. Video 30-50 EGP, Datashow 30 EGP.
insert into public.lecture_pricing_rules
(lecture_id,academic_year,nationality_match,price_egp,view_limit,enabled,priority,product_type)
values
('y1-found-02',1,'*',40,null,true,0,'video'),
('y1-found-03',1,'*',40,null,true,0,'video'),
('y1-found-04',1,'*',40,null,true,0,'video'),
('y1-found-05',1,'*',30,null,true,0,'video'),
('y1-found-06',1,'*',40,null,true,0,'video'),
('y1-found-07',1,'*',40,null,true,0,'video'),
('y1-found-08',1,'*',50,null,true,0,'video'),
('y1-found-09',1,'*',40,null,true,0,'video'),
('y1-found-10',1,'*',40,null,true,0,'video'),
('y1-practical-scapula',1,'*',30,null,true,0,'video'),
('y2-cns-30',2,'*',50,null,true,0,'video'),
('y2-cns-31',2,'*',50,null,true,0,'video'),
('y2-cns-32',2,'*',50,null,true,0,'video'),
('y2-cns-33',2,'*',50,null,true,0,'video'),
('y2-cns-34',2,'*',50,null,true,0,'video'),
('y3-abd-01',3,'*',50,null,true,0,'video'),
('y3-abd-02',3,'*',50,null,true,0,'video'),
('y3-abd-03',3,'*',50,null,true,0,'video'),
('y3-abd-04',3,'*',50,null,true,0,'video'),
('y3-abd-05',3,'*',50,null,true,0,'video'),
('y3-abd-06',3,'*',50,null,true,0,'video'),
('y3-abd-09',3,'*',50,null,true,0,'video'),
('y3-abd-10',3,'*',50,null,true,0,'video'),
('y3-abd-13',3,'*',50,null,true,0,'video'),
('y3-hn-02',3,'*',50,null,true,0,'video'),
('y3-hn-03',3,'*',50,null,true,0,'video'),
('y3-hn-04',3,'*',50,null,true,0,'video'),
('y3-hn-05',3,'*',50,null,true,0,'video')
on conflict do nothing;

-- Never trust a client-supplied payment amount; trigger resolves trusted prices.
CREATE OR REPLACE FUNCTION public.prepare_manual_payment_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_profile public.profiles%rowtype;
  v_module public.module_products%rowtype;
  v_rule record;
  v_base integer;
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'Payment request must belong to the signed-in account';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then raise exception 'Complete your student profile first'; end if;

  new.academic_year := v_profile.medical_year;
  new.transfer_reference := trim(new.transfer_reference);
  if new.transfer_reference = '' then raise exception 'Transaction reference is required'; end if;

  if not exists (
    select 1 from public.manual_payment_channels c
    where c.id = new.payment_method and c.active = true
  ) then raise exception 'This manual payment method is not active'; end if;

  if new.target_type = 'chat' then
    if not exists (
      select 1 from public.student_chat_sessions s
      where s.id = new.chat_session_id
        and s.user_id = auth.uid()
        and s.status = 'pending'
    ) then raise exception 'Chat session is not available for payment'; end if;
    new.amount_egp := 5;
    new.view_limit := null;

  elsif new.target_type = 'module' then
    select * into v_module
    from public.module_products
    where module_code = upper(trim(new.module_code))
      and product_type = new.product_type
      and enabled = true
      and academic_year = v_profile.medical_year
    limit 1;
    if not found then raise exception 'This module product is not available for your academic year'; end if;
    new.module_code := v_module.module_code;
    new.amount_egp := public.module_effective_price(auth.uid(), v_module.module_code, v_profile.medical_year, v_module.product_type);
    new.view_limit := null;

  else
    if new.product_type not in ('video','datashow','bundle') then
      raise exception 'Invalid lecture product';
    end if;

    select r.price_egp, r.view_limit into v_rule
    from public.lecture_pricing_rules r
    where r.lecture_id = new.lecture_id
      and r.product_type = new.product_type
      and r.enabled = true
      and (r.academic_year is null or r.academic_year = v_profile.medical_year)
      and (
        r.nationality_match = '*'
        or lower(r.nationality_match) = lower(coalesce(v_profile.nationality, ''))
        or (r.nationality_match = 'NON_EGYPTIAN' and lower(coalesce(v_profile.nationality, '')) not in ('egyptian','egypt'))
      )
    order by
      (case when r.academic_year is null then 0 else 20 end)
      + (case when r.nationality_match = '*' then 0 when r.nationality_match = 'NON_EGYPTIAN' then 5 else 10 end)
      + coalesce(r.priority, 0) desc
    limit 1;

    if found then
      new.amount_egp := v_rule.price_egp;
      new.view_limit := v_rule.view_limit;
    else
      select price_egp into v_base from public.lecture_settings
      where lecture_id = new.lecture_id and published = true and access_mode = 'paid';

      if found and coalesce(v_base,0) > 0 then
        if new.product_type = 'video' then new.amount_egp := v_base;
        elsif new.product_type = 'datashow' then new.amount_egp := 30;
        else new.amount_egp := v_base + 30;
        end if;
        new.view_limit := null;
      else
        raise exception 'Lecture price is not configured on the server';
      end if;
    end if;
  end if;

  return new;
end;
$function$

