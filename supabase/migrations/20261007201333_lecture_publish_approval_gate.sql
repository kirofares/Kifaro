create or replace function private.enforce_ai_review_before_publish()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.published = true
     and (tg_op = 'INSERT' or old.published is distinct from true) then
    if exists (
      select 1
      from public.content_production cp
      where cp.lecture_id = new.lecture_id
        and cp.review_state <> 'approved'
    ) then
      raise exception 'Lecture % requires an approved production draft before publishing.', new.lecture_id
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists lecture_settings_ai_review_gate on public.lecture_settings;
create trigger lecture_settings_ai_review_gate
before insert or update of published on public.lecture_settings
for each row
execute function private.enforce_ai_review_before_publish();
