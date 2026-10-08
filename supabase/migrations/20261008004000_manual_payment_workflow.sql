
create or replace function public.is_kifaro_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_kifaro_admin() from public;
grant execute on function public.is_kifaro_admin() to authenticated;

create table if not exists public.manual_payment_channels (
  id text primary key,
  label text not null,
  destination text not null default '',
  account_name text,
  instructions text,
  active boolean not null default false,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.manual_payment_channels enable row level security;

drop policy if exists "manual payment channels readable" on public.manual_payment_channels;
create policy "manual payment channels readable"
on public.manual_payment_channels for select
to authenticated
using (active or public.is_kifaro_admin());

drop policy if exists "admins manage manual payment channels" on public.manual_payment_channels;
create policy "admins manage manual payment channels"
on public.manual_payment_channels for all
to authenticated
using (public.is_kifaro_admin())
with check (public.is_kifaro_admin());

insert into public.manual_payment_channels (id, label, destination, account_name, instructions, active, sort_order)
values
  ('instapay', 'InstaPay', '', null, 'Transfer the exact amount and keep the transaction reference.', false, 10),
  ('wallet', 'Mobile Wallet', '', null, 'Transfer the exact amount and keep the transaction reference.', false, 20)
on conflict (id) do nothing;

create table if not exists public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique default (
    'KF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('lecture', 'module')),
  lecture_id text,
  module_code text,
  academic_year integer check (academic_year between 1 and 7),
  product_type text not null,
  amount_egp numeric(10,2) not null check (amount_egp > 0),
  view_limit integer check (view_limit is null or view_limit >= 1),
  payment_method text not null references public.manual_payment_channels(id),
  transfer_reference text not null,
  receipt_path text,
  student_note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  constraint manual_payment_target_check check (
    (target_type = 'lecture' and lecture_id is not null and module_code is null and product_type in ('video','datashow','bundle'))
    or
    (target_type = 'module' and module_code is not null and lecture_id is null and product_type in ('mcq','cases','osce'))
  )
);

create unique index if not exists manual_payment_one_pending_per_product
on public.manual_payment_requests (
  user_id,
  target_type,
  coalesce(lecture_id, ''),
  coalesce(module_code, ''),
  product_type
)
where status = 'pending';

create index if not exists manual_payment_requests_status_created_idx
on public.manual_payment_requests(status, created_at desc);

alter table public.manual_payment_requests enable row level security;

drop policy if exists "students read own manual payments" on public.manual_payment_requests;
create policy "students read own manual payments"
on public.manual_payment_requests for select
to authenticated
using (user_id = auth.uid() or public.is_kifaro_admin());

drop policy if exists "students create own manual payments" on public.manual_payment_requests;
create policy "students create own manual payments"
on public.manual_payment_requests for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
);

drop policy if exists "admins update manual payments" on public.manual_payment_requests;
create policy "admins update manual payments"
on public.manual_payment_requests for update
to authenticated
using (public.is_kifaro_admin())
with check (public.is_kifaro_admin());

create or replace function public.prepare_manual_payment_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  if not found then
    raise exception 'Complete your student profile first';
  end if;

  new.academic_year := v_profile.medical_year;
  new.transfer_reference := trim(new.transfer_reference);
  if new.transfer_reference = '' then
    raise exception 'Transaction reference is required';
  end if;

  if not exists (
    select 1 from public.manual_payment_channels c
    where c.id = new.payment_method and c.active = true
  ) then
    raise exception 'This manual payment method is not active';
  end if;

  if new.target_type = 'module' then
    select * into v_module
    from public.module_products
    where module_code = upper(trim(new.module_code))
      and product_type = new.product_type
      and enabled = true
      and academic_year = v_profile.medical_year
    limit 1;

    if not found then
      raise exception 'This module product is not available for your academic year';
    end if;

    new.module_code := v_module.module_code;
    new.amount_egp := v_module.price_egp;
    new.view_limit := null;
  else
    select r.price_egp, r.view_limit
      into v_rule
    from public.lecture_pricing_rules r
    where r.lecture_id = new.lecture_id
      and r.product_type = new.product_type
      and r.enabled = true
      and (r.academic_year is null or r.academic_year = v_profile.medical_year)
      and (
        r.nationality_match = '*'
        or lower(r.nationality_match) = lower(coalesce(v_profile.nationality, ''))
        or (
          r.nationality_match = 'NON_EGYPTIAN'
          and lower(coalesce(v_profile.nationality, '')) not in ('egyptian', 'egypt')
        )
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
      select price_egp into v_base
      from public.lecture_settings
      where lecture_id = new.lecture_id
        and published = true
        and access_mode = 'paid';

      if found and coalesce(v_base, 0) > 0 then
        if new.product_type = 'video' then
          new.amount_egp := v_base;
        elsif new.product_type = 'datashow' then
          new.amount_egp := greatest(30, v_base);
        else
          new.amount_egp := v_base + greatest(30, v_base);
        end if;
      elsif new.amount_egp <= 0 or new.amount_egp > 10000 then
        raise exception 'Invalid payment amount';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_manual_payment_request_trigger on public.manual_payment_requests;
create trigger prepare_manual_payment_request_trigger
before insert on public.manual_payment_requests
for each row execute function public.prepare_manual_payment_request();

create or replace function public.review_manual_payment_request(
  p_request_id uuid,
  p_action text,
  p_note text default null
)
returns public.manual_payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.manual_payment_requests%rowtype;
  e public.lecture_entitlements%rowtype;
  v_profile public.profiles%rowtype;
  v_video boolean;
  v_datashow boolean;
  v_adds_access boolean;
begin
  if not public.is_kifaro_admin() then
    raise exception 'Admin access required';
  end if;

  if p_action not in ('approve', 'reject') then
    raise exception 'Invalid review action';
  end if;

  select * into r
  from public.manual_payment_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Payment request not found';
  end if;

  if r.status <> 'pending' then
    raise exception 'This payment request has already been reviewed';
  end if;

  if p_action = 'reject' then
    update public.manual_payment_requests
    set status = 'rejected',
        admin_note = nullif(trim(p_note), ''),
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where id = r.id
    returning * into r;
    return r;
  end if;

  select * into v_profile from public.profiles where id = r.user_id;

  if r.target_type = 'module' then
    if exists (
      select 1 from public.module_entitlements
      where user_id = r.user_id
        and module_code = r.module_code
        and product_type = r.product_type
        and revoked_at is null
        and expires_at > now()
    ) then
      raise exception 'This module access is already active';
    end if;

    insert into public.module_entitlements (
      user_id, module_code, product_type, academic_year,
      price_paid_egp, source, granted_at, expires_at, revoked_at
    ) values (
      r.user_id, r.module_code, r.product_type, r.academic_year,
      r.amount_egp, 'manual:' || r.reference_code, now(), now() + interval '6 months', null
    )
    on conflict (user_id, module_code, product_type) do update
    set academic_year = excluded.academic_year,
        price_paid_egp = excluded.price_paid_egp,
        source = excluded.source,
        granted_at = now(),
        expires_at = now() + interval '6 months',
        revoked_at = null;
  else
    select * into e
    from public.lecture_entitlements
    where user_id = r.user_id and lecture_id = r.lecture_id;

    v_video := r.product_type in ('video','bundle');
    v_datashow := r.product_type in ('datashow','bundle');
    v_adds_access :=
      (v_video and not coalesce(e.video_access, false))
      or
      (v_datashow and not coalesce(e.datashow_access, false));

    if found and not v_adds_access and e.revoked_at is null then
      raise exception 'This lecture product is already active';
    end if;

    insert into public.lecture_entitlements (
      user_id, lecture_id, price_paid_egp, source, granted_at, revoked_at,
      view_limit, views_used, offer_academic_year, offer_nationality,
      video_access, datashow_access, product_type
    ) values (
      r.user_id,
      r.lecture_id,
      r.amount_egp,
      'manual:' || r.reference_code,
      now(),
      null,
      case when v_video then r.view_limit else null end,
      0,
      r.academic_year,
      v_profile.nationality,
      v_video,
      v_datashow,
      case when v_video and v_datashow then 'bundle' when v_video then 'video' else 'datashow' end
    )
    on conflict (user_id, lecture_id) do update
    set price_paid_egp = public.lecture_entitlements.price_paid_egp + excluded.price_paid_egp,
        source = excluded.source,
        granted_at = now(),
        revoked_at = null,
        view_limit = case
          when excluded.video_access and not public.lecture_entitlements.video_access then excluded.view_limit
          else public.lecture_entitlements.view_limit
        end,
        views_used = case
          when excluded.video_access and not public.lecture_entitlements.video_access then 0
          else public.lecture_entitlements.views_used
        end,
        offer_academic_year = excluded.offer_academic_year,
        offer_nationality = excluded.offer_nationality,
        video_access = public.lecture_entitlements.video_access or excluded.video_access,
        datashow_access = public.lecture_entitlements.datashow_access or excluded.datashow_access,
        product_type = case
          when (public.lecture_entitlements.video_access or excluded.video_access)
           and (public.lecture_entitlements.datashow_access or excluded.datashow_access) then 'bundle'
          when (public.lecture_entitlements.video_access or excluded.video_access) then 'video'
          else 'datashow'
        end;
  end if;

  update public.manual_payment_requests
  set status = 'approved',
      admin_note = nullif(trim(p_note), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = r.id
  returning * into r;

  return r;
end;
$$;

revoke all on function public.review_manual_payment_request(uuid, text, text) from public;
grant execute on function public.review_manual_payment_request(uuid, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'manual-payment-receipts',
  'manual-payment-receipts',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "students upload own payment receipts" on storage.objects;
create policy "students upload own payment receipts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'manual-payment-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "students and admins read payment receipts" on storage.objects;
create policy "students and admins read payment receipts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'manual-payment-receipts'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_kifaro_admin()
  )
);
