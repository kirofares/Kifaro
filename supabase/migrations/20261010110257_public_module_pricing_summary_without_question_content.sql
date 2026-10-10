CREATE OR REPLACE FUNCTION public.get_public_module_prices()
 RETURNS TABLE(academic_year integer, module_code text, product_type text, price_egp numeric, question_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH mcq_counts AS (
 SELECT lm.academic_year,lm.module_code,count(*)::bigint AS amount
 FROM public.mcq_questions q
 JOIN public.lecture_module_map lm ON lm.lecture_id=q.lecture_id
 WHERE q.published=true AND q.quality_status='ready'
 GROUP BY 1,2
), case_counts AS (
 SELECT a.year::integer AS academic_year,a.module_code,count(*)::bigint AS amount
 FROM public.assessment_items a WHERE a.published=true AND a.quality_status='ready' AND a.assessment_type='case'
 GROUP BY 1,2
), practical_counts AS (
 SELECT a.year::integer AS academic_year,a.module_code,count(*)::bigint AS amount
 FROM public.assessment_items a WHERE a.published=true AND a.quality_status='ready'
   AND a.assessment_type IN ('osce','ospe','spotter')
 GROUP BY 1,2
)
SELECT p.academic_year,p.module_code,p.product_type,p.price_egp,
 CASE p.product_type
   WHEN 'mcq' THEN coalesce(m.amount,0)
   WHEN 'cases' THEN coalesce(c.amount,0)
   WHEN 'osce' THEN coalesce(o.amount,0)
   ELSE 0::bigint
 END AS question_count
FROM public.module_products p
LEFT JOIN mcq_counts m ON m.academic_year=p.academic_year AND m.module_code=p.module_code
LEFT JOIN case_counts c ON c.academic_year=p.academic_year AND c.module_code=p.module_code
LEFT JOIN practical_counts o ON o.academic_year=p.academic_year AND o.module_code=p.module_code
WHERE p.enabled=true AND p.product_type IN ('mcq','cases','osce') ORDER BY p.academic_year,p.module_code,p.product_type;
$function$;
REVOKE ALL ON FUNCTION public.get_public_module_prices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_module_prices() TO anon,authenticated;
COMMENT ON FUNCTION public.get_public_module_prices() IS 'Public read-only offer metadata: prices and totals, never stems, answers or user data.';
