alter table public.student_chat_sessions
  add column if not exists admin_last_read_at timestamptz;

create index if not exists student_chat_messages_admin_unread_idx
  on public.student_chat_messages(session_id, sender_role, created_at desc);

create index if not exists student_chat_sessions_admin_read_idx
  on public.student_chat_sessions(admin_last_read_at);

create or replace function public.get_admin_chat_unread_counts()
returns table (
  session_id uuid,
  unread_count bigint,
  latest_student_message_at timestamptz
)
language sql
stable
security invoker
set search_path = public, private
as $$
  select
    s.id as session_id,
    count(m.id) filter (
      where m.sender_role = 'student'
        and m.created_at > coalesce(s.admin_last_read_at, 'epoch'::timestamptz)
    ) as unread_count,
    max(m.created_at) filter (where m.sender_role = 'student') as latest_student_message_at
  from public.student_chat_sessions s
  left join public.student_chat_messages m on m.session_id = s.id
  where private.is_admin()
  group by s.id;
$$;

revoke all on function public.get_admin_chat_unread_counts() from public, anon;
grant execute on function public.get_admin_chat_unread_counts() to authenticated;
