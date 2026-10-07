alter function public.mcq_is_publishable(boolean, text, text)
  set search_path = '';

revoke execute on function public.protect_student_academic_year() from public;
revoke execute on function public.protect_student_academic_year() from anon;
revoke execute on function public.protect_student_academic_year() from authenticated;
