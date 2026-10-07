create table if not exists public.module_products (
  module_code text not null,
  academic_year integer not null check (academic_year between 1 and 7),
  product_type text not null check (product_type in ('mcq','cases','osce')),
  price_egp numeric(10,2) not null check (price_egp > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (module_code, product_type)
);

insert into public.module_products(module_code, academic_year, product_type, price_egp)
select code, yr, ptype, price
from (
  values
    ('ORIENTATION',1,'mcq',100::numeric),('ORIENTATION',1,'cases',200::numeric),('ORIENTATION',1,'osce',100::numeric),
    ('IAE-1',1,'mcq',100),('IAE-1',1,'cases',200),('IAE-1',1,'osce',100),
    ('MLS-1',1,'mcq',100),('MLS-1',1,'cases',200),('MLS-1',1,'osce',100),
    ('MBL-2',2,'mcq',100),('MBL-2',2,'cases',200),('MBL-2',2,'osce',100),
    ('MRS-2',2,'mcq',100),('MRS-2',2,'cases',200),('MRS-2',2,'osce',100),
    ('MCVS-2',2,'mcq',100),('MCVS-2',2,'cases',200),('MCVS-2',2,'osce',100),
    ('MCNS-2',2,'mcq',100),('MCNS-2',2,'cases',200),('MCNS-2',2,'osce',100),
    ('MSS-2',2,'mcq',100),('MSS-2',2,'cases',200),('MSS-2',2,'osce',100),
    ('MGL-3',3,'mcq',100),('MGL-3',3,'cases',200),('MGL-3',3,'osce',100),
    ('MUG-3',3,'mcq',100),('MUG-3',3,'cases',200),('MUG-3',3,'osce',100)
) as seed(code,yr,ptype,price)
on conflict (module_code, product_type) do update set
  academic_year=excluded.academic_year,
  price_egp=excluded.price_egp,
  enabled=true,
  updated_at=now();

alter table public.module_products enable row level security;
drop policy if exists "module_products_student_read" on public.module_products;
create policy "module_products_student_read"
on public.module_products for select
to authenticated
using (
  enabled = true
  and (
    (select private.is_admin())
    or academic_year = (select p.medical_year from public.profiles p where p.id = auth.uid())
  )
);

create table if not exists public.module_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_code text not null,
  product_type text not null check (product_type in ('mcq','cases','osce')),
  academic_year integer not null check (academic_year between 1 and 7),
  price_paid_egp numeric(10,2) not null default 0 check (price_paid_egp >= 0),
  source text not null default 'admin',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, module_code, product_type)
);

alter table public.module_entitlements enable row level security;
drop policy if exists "module_entitlements_own_read" on public.module_entitlements;
create policy "module_entitlements_own_read"
on public.module_entitlements for select
to authenticated
using (user_id = auth.uid() or (select private.is_admin()));

drop policy if exists "module_entitlements_admin_all" on public.module_entitlements;
create policy "module_entitlements_admin_all"
on public.module_entitlements for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

alter table public.payment_transactions add column if not exists module_code text;
alter table public.payment_transactions drop constraint if exists payment_transactions_product_type_check;
alter table public.payment_transactions add constraint payment_transactions_product_type_check
check (product_type in ('video','datashow','bundle','mcq_module','cases_module','osce_module'));
