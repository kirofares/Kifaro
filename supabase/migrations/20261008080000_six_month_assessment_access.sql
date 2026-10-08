alter table public.module_entitlements
  add column if not exists expires_at timestamptz;

update public.module_entitlements
set expires_at = granted_at + interval '6 months'
where expires_at is null;

alter table public.module_entitlements
  alter column expires_at set not null,
  alter column expires_at set default (now() + interval '6 months');

create index if not exists module_entitlements_active_idx
  on public.module_entitlements(user_id, module_code, product_type, expires_at);

create or replace function public.set_module_entitlement_expiry()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.expires_at is null then
      new.expires_at := coalesce(new.granted_at, now()) + interval '6 months';
    end if;
  elsif new.granted_at is distinct from old.granted_at then
    new.expires_at := new.granted_at + interval '6 months';
  end if;
  return new;
end;
$$;

drop trigger if exists set_module_entitlement_expiry_trigger on public.module_entitlements;
create trigger set_module_entitlement_expiry_trigger
before insert or update on public.module_entitlements
for each row execute function public.set_module_entitlement_expiry();

drop policy if exists "mcq_questions_paid_module_read" on public.mcq_questions;
create policy "mcq_questions_paid_module_read"
on public.mcq_questions for select
to authenticated
using (
  (select private.is_admin())
  or (
    published=true
    and exists (
      select 1
      from public.lecture_module_map lm
      join public.module_entitlements me
        on me.user_id=auth.uid()
       and me.module_code=lm.module_code
       and me.product_type='mcq'
       and me.revoked_at is null
       and me.expires_at > now()
      where lm.lecture_id=mcq_questions.lecture_id
        and lm.academic_year=(select p.medical_year from public.profiles p where p.id=auth.uid())
    )
  )
);

drop policy if exists "assessment_items_paid_module_read" on public.assessment_items;
create policy "assessment_items_paid_module_read"
on public.assessment_items for select
to authenticated
using (
  (select private.is_admin())
  or (
    published=true
    and year=(select p.medical_year from public.profiles p where p.id=auth.uid())
    and (
      (assessment_type='case' and exists (
        select 1 from public.module_entitlements me
        where me.user_id=auth.uid()
          and me.module_code=assessment_items.module_code
          and me.product_type='cases'
          and me.revoked_at is null
          and me.expires_at > now()
      ))
      or (assessment_type in ('osce','ospe') and exists (
        select 1 from public.module_entitlements me
        where me.user_id=auth.uid()
          and me.module_code=assessment_items.module_code
          and me.product_type='osce'
          and me.revoked_at is null
          and me.expires_at > now()
      ))
      or assessment_type='spotter'
    )
  )
);