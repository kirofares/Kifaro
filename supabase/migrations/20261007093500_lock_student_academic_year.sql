create or replace function public.protect_student_academic_year()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if old.medical_year is distinct from new.medical_year then
    if auth.uid() is null or not private.is_admin() then
      raise exception 'Academic year can only be changed by an administrator.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_student_academic_year on public.profiles;
create trigger protect_student_academic_year
before update on public.profiles
for each row execute function public.protect_student_academic_year();
