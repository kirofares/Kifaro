alter table public.manual_payment_requests
  drop constraint if exists manual_payment_requests_target_type_check;
alter table public.manual_payment_requests
  add constraint manual_payment_requests_target_type_check
  check (target_type in ('lecture','module','chat'));

alter table public.manual_payment_requests
  drop constraint if exists manual_payment_requests_product_type_check;
alter table public.manual_payment_requests
  add constraint manual_payment_requests_product_type_check
  check (
    (target_type='lecture' and product_type in ('video','datashow','bundle'))
    or
    (target_type='module' and product_type in ('mcq','cases','osce','assessment_bundle'))
    or
    (target_type='chat' and product_type='chat')
  );

alter table public.manual_payment_requests
  drop constraint if exists manual_payment_target_check;
alter table public.manual_payment_requests
  add constraint manual_payment_target_check check (
    (target_type='lecture' and lecture_id is not null and module_code is null and chat_session_id is null and product_type in ('video','datashow','bundle'))
    or
    (target_type='module' and module_code is not null and lecture_id is null and chat_session_id is null and product_type in ('mcq','cases','osce','assessment_bundle'))
    or
    (target_type='chat' and lecture_id is null and module_code is null and chat_session_id is not null and product_type='chat')
  );