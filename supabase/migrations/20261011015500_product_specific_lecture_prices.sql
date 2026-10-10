drop index if exists public.lecture_pricing_rules_unique_scope;

create unique index lecture_pricing_rules_unique_scope
on public.lecture_pricing_rules
using btree (lecture_id, coalesce(academic_year,0), lower(nationality_match), product_type);

insert into public.lecture_pricing_rules
(lecture_id,academic_year,nationality_match,price_egp,view_limit,enabled,priority,product_type)
select lecture_id,academic_year,nationality_match,30,view_limit,enabled,priority,'datashow'
from public.lecture_pricing_rules
where product_type='video'
on conflict do nothing;

insert into public.lecture_pricing_rules
(lecture_id,academic_year,nationality_match,price_egp,view_limit,enabled,priority,product_type)
select lecture_id,academic_year,nationality_match,price_egp+30,view_limit,enabled,priority,'bundle'
from public.lecture_pricing_rules
where product_type='video'
on conflict do nothing;
