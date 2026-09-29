create table if not exists public.lecture_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_id text not null,
  price_paid_egp integer not null check (price_paid_egp >= 0),
  source text not null default 'payment',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, lecture_id)
);

alter table public.lecture_entitlements enable row level security;

create policy "Users can read own lecture entitlements"
on public.lecture_entitlements
for select
using (auth.uid() = user_id);

-- Intentionally no INSERT / UPDATE / DELETE policies for students.
-- Access grants must be written only by trusted server-side code
-- (payment webhook / admin using the Supabase service role).
