create table if not exists public.lecture_settings (
  lecture_id text primary key,
  title_override text,
  description_override text,
  price_egp integer check (price_egp in (0,40,50,60)),
  access_mode text check (access_mode in ('free','paid')),
  published boolean not null default true,
  video_url text,
  pdf_url text,
  pptx_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.lecture_settings enable row level security;

create policy "Anyone can read lecture settings"
on public.lecture_settings for select
using (true);

create policy "Admins can insert lecture settings"
on public.lecture_settings for insert
with check (public.is_admin());

create policy "Admins can update lecture settings"
on public.lecture_settings for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete lecture settings"
on public.lecture_settings for delete
using (public.is_admin());
