alter function public.service_submit_mcq_answers(uuid, jsonb)
  security definer;

alter function public.service_submit_mcq_answers(uuid, jsonb)
  set search_path = public, private;

revoke all on function public.service_submit_mcq_answers(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.service_submit_mcq_answers(uuid, jsonb)
  to service_role;
