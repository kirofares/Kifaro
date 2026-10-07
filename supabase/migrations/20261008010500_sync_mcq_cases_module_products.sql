-- Keep paid MCQ and Clinical Cases products available for every curriculum module.
insert into public.module_products (module_code, academic_year, product_type, price_egp, enabled, updated_at)
select distinct lm.module_code, lm.academic_year, p.product_type, p.price_egp, true, now()
from public.lecture_module_map lm
cross join (
  values
    ('mcq'::text, 100::numeric),
    ('cases'::text, 200::numeric)
) as p(product_type, price_egp)
on conflict (module_code, product_type) do update
set academic_year = excluded.academic_year,
    price_egp = excluded.price_egp,
    enabled = true,
    updated_at = now();
