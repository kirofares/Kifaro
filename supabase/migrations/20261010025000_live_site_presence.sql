create table if not exists public.site_presence (
  session_id uuid primary key,
  user_id uuid null references auth.users(id) on delete set null,
  last_seen timestamptz not null default now(),
  path text null,
  created_at timestamptz not null default now()
);

alter table public.site_presence enable row level security;
revoke all on table public.site_presence from public, anon, authenticated;

create or replace function public.touch_site_presence(p_session_id uuid, p_path text default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.site_presence(session_id, user_id, last_seen, path)
  values (p_session_id, auth.uid(), now(), left(coalesce(p_path,''), 300))
  on conflict (session_id) do update
  set user_id = auth.uid(),
      last_seen = now(),
      path = left(coalesce(p_path,''), 300);
end;
$$;

revoke all on function public.touch_site_presence(uuid, text) from public;
grant execute on function public.touch_site_presence(uuid, text) to anon, authenticated;

create or replace function public.get_live_visitor_counts()
returns table(total_active bigint, anonymous_active bigint, signed_in_active bigint)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null or not private.is_admin(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  with active as (
    select sp.session_id, sp.user_id
    from public.site_presence sp
    left join public.profiles p on p.id = sp.user_id
    where sp.last_seen >= now() - interval '2 minutes'
      and coalesce(p.role, 'student') <> 'admin'
  )
  select
    count(*)::bigint,
    count(*) filter (where user_id is null)::bigint,
    count(*) filter (where user_id is not null)::bigint
  from active;
end;
$$;

revoke all on function public.get_live_visitor_counts() from public, anon;
grant execute on function public.get_live_visitor_counts() to authenticated, service_role;
