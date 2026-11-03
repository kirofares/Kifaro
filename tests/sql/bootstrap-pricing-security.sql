-- Runs on real non-owner roles; every data probe rolls back.
BEGIN;
DO $$ BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.lecture_pricing_rules'::regclass) THEN
   RAISE EXCEPTION 'Pricing RLS disabled';
 END IF;
 IF has_table_privilege('anon','public.lecture_pricing_rules','SELECT')
    OR has_table_privilege('authenticated','public.lecture_pricing_rules','TRUNCATE')
    OR EXISTS (SELECT 1 FROM pg_proc p, LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid='private.is_admin()'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN
   RAISE EXCEPTION 'Excess bootstrap privilege';
 END IF;
END $$;
INSERT INTO auth.users(id,raw_user_meta_data) VALUES
 ('00000000-0000-0000-0000-000000000001','{"medical_year":1}'),
 ('00000000-0000-0000-0000-000000000002','{"medical_year":2}');
INSERT INTO public.lecture_pricing_rules(lecture_id,academic_year,price_egp) VALUES
 ('bootstrap-y1',1,30),('bootstrap-y2',2,30);
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF private.is_admin() OR (SELECT count(*) FROM public.lecture_pricing_rules)<>1
    OR EXISTS (SELECT 1 FROM public.lecture_pricing_rules WHERE academic_year<>1) THEN
   RAISE EXCEPTION 'Pricing year/admin boundary failed';
 END IF;
 BEGIN
   INSERT INTO public.lecture_pricing_rules(lecture_id,price_egp) VALUES ('attack',0);
   RAISE EXCEPTION 'Student can set price';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
SET LOCAL request.jwt.claim.sub='';
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.lecture_pricing_rules) THEN
   RAISE EXCEPTION 'Missing identity can read pricing';
 END IF;
END $$;
ROLLBACK;
