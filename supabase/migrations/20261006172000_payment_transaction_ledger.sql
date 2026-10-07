create table if not exists public.payment_transactions (
  paymob_transaction_id bigint primary key,
  paymob_order_id text,
  special_reference text,
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_id text not null,
  product_type text not null check (product_type in ('video','datashow','bundle')),
  amount_cents integer not null check (amount_cents >= 0),
  amount_egp numeric(12,2) not null check (amount_egp >= 0),
  currency text not null default 'EGP',
  status text not null check (status in ('pending','paid_pending_fulfillment','paid','failed','refunded','voided')),
  integration_id bigint,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_transactions_special_reference_uidx
  on public.payment_transactions(special_reference)
  where special_reference is not null;

create index if not exists payment_transactions_user_created_idx
  on public.payment_transactions(user_id, created_at desc);

create index if not exists payment_transactions_lecture_idx
  on public.payment_transactions(lecture_id);

alter table public.payment_transactions enable row level security;

drop policy if exists "payment_transactions_own_select" on public.payment_transactions;
create policy "payment_transactions_own_select"
on public.payment_transactions
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "payment_transactions_admin_all" on public.payment_transactions;
create policy "payment_transactions_admin_all"
on public.payment_transactions
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke insert, update, delete on public.payment_transactions from anon, authenticated;
grant select on public.payment_transactions to authenticated;
