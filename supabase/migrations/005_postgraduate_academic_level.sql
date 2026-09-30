alter table public.profiles
  drop constraint if exists profiles_medical_year_check;

alter table public.profiles
  add constraint profiles_medical_year_check
  check (medical_year between 1 and 7);
