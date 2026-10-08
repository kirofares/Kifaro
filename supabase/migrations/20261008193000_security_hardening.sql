-- Security hardening: server-side MCQ grading, audit log, rate limits, refund recalculation.

revoke select on table public.mcq_questions from anon, authenticated;
grant select (
  id, lecture_id, topic, subtopic, question_text,
  option_a, option_b, option_c, option_d,
  question_type, difficulty, source_scope, published,
  created_at, learning_objective, image_url, image_alt,
  learning_point_id, image_required, image_status, image_reason, quality_status
) on public.mcq_questions to authenticated;

drop policy if exists "mcq_attempts_own_insert" on public.mcq_attempts;
revoke insert on table public.mcq_attempts from anon, authenticated;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  actor_db_role text not null default current_user,
  action text not null,
  table_name text not null,
  record_key text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_actor_idx on public.admin_audit_log(actor_user_id, created_at desc);
alter table public.admin_audit_log enable row level security;
drop policy if exists "admins read audit log" on public.admin_audit_log;
create policy "admins read audit log" on public.admin_audit_log for select to authenticated using ((select private.is_admin()));
revoke insert, update, delete on public.admin_audit_log from anon, authenticated;

create or replace function private.audit_sensitive_change()
returns trigger language plpgsql security definer set search_path=public,private as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  v_key text;
begin
  v_key := coalesce(v_new->>'id',v_old->>'id',v_new->>'lecture_id',v_old->>'lecture_id',
                    v_new->>'module_code',v_old->>'module_code',v_new->>'user_id',v_old->>'user_id',
                    v_new->>'paymob_transaction_id',v_old->>'paymob_transaction_id');
  insert into public.admin_audit_log(actor_user_id,actor_db_role,action,table_name,record_key,details)
  values(auth.uid(),current_user,tg_op,tg_table_name,v_key,
    jsonb_build_object('changed_keys',
      case when tg_op='UPDATE' then (
        select coalesce(jsonb_agg(k),'[]'::jsonb)
        from (
          select key k from jsonb_each(v_new)
          except
          select key k from jsonb_each(v_old) where v_new->key=value
        ) s
      ) else '[]'::jsonb end));
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function private.audit_sensitive_change() from public;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','lecture_settings','lecture_assets','lecture_pricing_rules',
    'module_products','module_entitlements','manual_payment_channels',
    'manual_payment_requests','payment_transactions'
  ]
  loop
    execute format('drop trigger if exists audit_sensitive_change on public.%I',t);
    execute format('create trigger audit_sensitive_change after insert or update or delete on public.%I for each row execute function private.audit_sensitive_change()',t);
  end loop;
end $$;

create table if not exists public.api_rate_limits (
  actor_key text not null,
  action_key text not null,
  window_started_at timestamptz not null,
  hit_count integer not null default 1,
  primary key(actor_key,action_key)
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon,authenticated;
drop policy if exists "deny client rate limit access" on public.api_rate_limits;
create policy "deny client rate limit access" on public.api_rate_limits for all to authenticated using(false) with check(false);

create or replace function public.consume_service_rate_limit(
  p_actor_key text,p_action_key text,p_limit integer,p_window_seconds integer
)
returns boolean language plpgsql security definer set search_path=public as $$
declare
  v_row public.api_rate_limits%rowtype;
  v_now timestamptz:=now();
begin
  if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;
  if p_limit<1 or p_window_seconds<1 then raise exception 'Invalid rate limit'; end if;
  insert into public.api_rate_limits(actor_key,action_key,window_started_at,hit_count)
  values(p_actor_key,p_action_key,v_now,1)
  on conflict(actor_key,action_key) do update set
    window_started_at=case when public.api_rate_limits.window_started_at+make_interval(secs=>p_window_seconds)<=v_now then v_now else public.api_rate_limits.window_started_at end,
    hit_count=case when public.api_rate_limits.window_started_at+make_interval(secs=>p_window_seconds)<=v_now then 1 else public.api_rate_limits.hit_count+1 end
  returning * into v_row;
  return v_row.hit_count<=p_limit;
end;
$$;
revoke all on function public.consume_service_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_service_rate_limit(text,text,integer,integer) to service_role;

create or replace function private.rate_limit_manual_payment_request()
returns trigger language plpgsql security definer set search_path=public,private as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.consume_service_rate_limit('user:'||auth.uid()::text,'manual_payment_request',5,3600) then
    raise exception 'Too many payment requests. Try again later.';
  end if;
  return new;
end;
$$;
revoke all on function private.rate_limit_manual_payment_request() from public,anon,authenticated;
drop trigger if exists rate_limit_manual_payment_request_trigger on public.manual_payment_requests;
create trigger rate_limit_manual_payment_request_trigger before insert on public.manual_payment_requests
for each row execute function private.rate_limit_manual_payment_request();

create or replace function public.service_submit_mcq_answers(p_user_id uuid,p_answers jsonb)
returns table(
  question_id uuid,is_correct boolean,correct_option text,explanation text,
  distractor_explanations jsonb,learning_objective text,topic text,subtopic text,difficulty integer
)
language plpgsql security invoker set search_path=public,private as $$
declare
  v_item jsonb; v_q public.mcq_questions%rowtype; v_selected text; v_response_ms integer; v_allowed boolean;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;
  if p_user_id is null then raise exception 'User required'; end if;
  if not public.consume_service_rate_limit('user:'||p_user_id::text,'mcq_submit',20,60) then
    raise exception 'Too many MCQ submissions. Try again shortly.';
  end if;
  if jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)=0 or jsonb_array_length(p_answers)>200 then
    raise exception 'Invalid answer batch';
  end if;

  for v_item in select value from jsonb_array_elements(p_answers)
  loop
    v_selected:=upper(trim(coalesce(v_item->>'selected_option','')));
    if v_selected not in ('A','B','C','D') then raise exception 'Invalid selected option'; end if;
    v_response_ms:=nullif(v_item->>'response_ms','')::integer;
    if v_response_ms is not null then v_response_ms:=greatest(0,least(v_response_ms,3600000)); end if;

    select q.* into v_q from public.mcq_questions q
    where q.id=(v_item->>'question_id')::uuid and q.published=true and q.quality_status='ready';
    if not found then raise exception 'Question not available'; end if;

    select (
      private.is_admin(p_user_id) or exists(
        select 1 from public.lecture_module_map lm
        join public.profiles p on p.id=p_user_id
        join public.module_entitlements me on me.user_id=p_user_id and me.module_code=lm.module_code
          and me.product_type='mcq' and me.revoked_at is null and me.expires_at>now()
        where lm.lecture_id=v_q.lecture_id and lm.academic_year=p.medical_year
      )
    ) into v_allowed;
    if not coalesce(v_allowed,false) then raise exception 'No active MCQ access for this question'; end if;

    insert into public.mcq_attempts(user_id,question_id,lecture_id,selected_option,is_correct,response_ms)
    values(p_user_id,v_q.id,v_q.lecture_id,v_selected,(v_selected=v_q.correct_option),v_response_ms);

    question_id:=v_q.id; is_correct:=(v_selected=v_q.correct_option); correct_option:=v_q.correct_option;
    explanation:=coalesce(v_q.explanation,''); distractor_explanations:=coalesce(v_q.distractor_explanations,'{}'::jsonb);
    learning_objective:=v_q.learning_objective; topic:=v_q.topic; subtopic:=v_q.subtopic; difficulty:=v_q.difficulty;
    return next;
  end loop;
end;
$$;
revoke all on function public.service_submit_mcq_answers(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.service_submit_mcq_answers(uuid,jsonb) to service_role;


-- lock direct mutation of mcq_attempts; all grading writes go through service-only server logic.
revoke insert, update, delete, truncate, trigger, references
on table public.mcq_attempts
from anon, authenticated;
grant select on table public.mcq_attempts to authenticated;
