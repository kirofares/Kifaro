create or replace function public.is_admin()
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

create policy "Admins can view all profiles"
on public.profiles for select
using (public.is_admin());

create policy "Admins can view all entitlements"
on public.lecture_entitlements for select
using (public.is_admin());

create policy "Admins can grant entitlements"
on public.lecture_entitlements for insert
with check (public.is_admin());

create policy "Admins can update entitlements"
on public.lecture_entitlements for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete entitlements"
on public.lecture_entitlements for delete
using (public.is_admin());
