
create or replace function public.is_kifaro_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((select private.is_admin()), false);
$$;

revoke all on function public.is_kifaro_admin() from public, anon;
grant execute on function public.is_kifaro_admin() to authenticated;

alter function public.prepare_manual_payment_request() security invoker;
revoke all on function public.prepare_manual_payment_request() from public, anon, authenticated;

alter function public.review_manual_payment_request(uuid, text, text) security invoker;
revoke all on function public.review_manual_payment_request(uuid, text, text) from public, anon;
grant execute on function public.review_manual_payment_request(uuid, text, text) to authenticated;

drop policy if exists "manual payment channels readable" on public.manual_payment_channels;
drop policy if exists "admins manage manual payment channels" on public.manual_payment_channels;

create policy "manual payment channels readable"
on public.manual_payment_channels for select
to authenticated
using (active or (select private.is_admin()));

create policy "admins insert manual payment channels"
on public.manual_payment_channels for insert
to authenticated
with check ((select private.is_admin()));

create policy "admins update manual payment channels"
on public.manual_payment_channels for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "admins delete manual payment channels"
on public.manual_payment_channels for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists "students read own manual payments" on public.manual_payment_requests;
drop policy if exists "students create own manual payments" on public.manual_payment_requests;
drop policy if exists "admins update manual payments" on public.manual_payment_requests;

create policy "students read own manual payments"
on public.manual_payment_requests for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

create policy "students create own manual payments"
on public.manual_payment_requests for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
);

create policy "admins update manual payments"
on public.manual_payment_requests for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "students upload own payment receipts" on storage.objects;
drop policy if exists "students and admins read payment receipts" on storage.objects;

create policy "students upload own payment receipts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'manual-payment-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "students and admins read payment receipts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'manual-payment-receipts'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_admin())
  )
);

create index if not exists manual_payment_channels_updated_by_idx
on public.manual_payment_channels(updated_by);

create index if not exists manual_payment_requests_payment_method_idx
on public.manual_payment_requests(payment_method);

create index if not exists manual_payment_requests_reviewed_by_idx
on public.manual_payment_requests(reviewed_by);
