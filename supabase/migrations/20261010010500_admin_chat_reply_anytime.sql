drop policy if exists "admins send chat messages" on public.student_chat_messages;

create policy "admins send chat messages anytime after activation"
on public.student_chat_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and sender_role = 'admin'
  and (select private.is_admin())
  and exists (
    select 1
    from public.student_chat_sessions s
    where s.id = student_chat_messages.session_id
      and s.opened_at is not null
  )
);
