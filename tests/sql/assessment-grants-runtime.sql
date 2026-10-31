-- Run as superuser for setup/assertions, but every access check switches to an
-- unprivileged non-owner role. Roll back every successful mutation probe.
SELECT fixture.assert_true((SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname='authenticated'), 'student/admin role cannot bypass RLS');
SELECT fixture.assert_true((SELECT NOT rolsuper AND rolbypassrls FROM pg_roles WHERE rolname='service_role'), 'service role models Supabase BYPASSRLS without superuser');
DO $$
DECLARE t text; r text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mcq_stages','mcq_levels','module_products','module_entitlements','lecture_module_map'] LOOP
    PERFORM fixture.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||t)::regclass), t||' RLS enabled');
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH p IN ARRAY ARRAY['TRUNCATE','REFERENCES','TRIGGER'] LOOP
        PERFORM fixture.assert_true(NOT has_table_privilege(r,'public.'||t,p),r||' lacks '||p||' on '||t);
      END LOOP;
    END LOOP;
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      PERFORM fixture.assert_true(has_table_privilege('service_role','public.'||t,p),'service '||p||' on '||t);
    END LOOP;
  END LOOP;
END $$;

SET ROLE anon;
SELECT fixture.assert_true((SELECT count(*)=5 FROM public.mcq_stages), 'anon reads stage metadata');
SELECT fixture.assert_true((SELECT count(*)=4 FROM public.mcq_levels), 'anon reads level metadata');
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mcq_stages','mcq_levels','module_products','module_entitlements','lecture_module_map'] LOOP
    PERFORM fixture.assert_true(fixture.denied('INSERT INTO public.'||t||' DEFAULT VALUES'), 'anon INSERT denied '||t);
    PERFORM fixture.assert_true(fixture.denied('DELETE FROM public.'||t), 'anon DELETE denied '||t);
    PERFORM fixture.assert_true(fixture.denied('TRUNCATE public.'||t), 'anon TRUNCATE denied '||t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['module_products','module_entitlements','lecture_module_map'] LOOP
    PERFORM fixture.assert_true(fixture.denied('SELECT * FROM public.'||t), 'anon SELECT denied '||t);
  END LOOP;
END $$;
SELECT fixture.assert_true(fixture.denied('UPDATE public.mcq_stages SET label_en=''attack'''), 'anon metadata UPDATE denied');
SELECT fixture.assert_true(fixture.denied('SELECT correct_option FROM public.mcq_questions'), 'anon answer access denied');
SELECT fixture.assert_true(fixture.denied('SELECT content FROM public.assessment_items'), 'anon assessment content denied');
RESET ROLE;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET request.jwt.claims = '{"user_metadata":{"role":"admin","medical_year":2}}';
SET ROLE authenticated;
SELECT fixture.assert_true(NOT private.is_admin(), 'forged user metadata does not grant admin');
SELECT fixture.assert_true((SELECT count(*)=5 FROM public.mcq_stages), 'student stages available');
SELECT fixture.assert_true((SELECT count(*)=4 FROM public.mcq_levels), 'student levels available');
SELECT fixture.assert_true((SELECT array_agg(module_code ORDER BY module_code)=ARRAY['TEST-Y1'] FROM public.module_products WHERE module_code LIKE 'TEST-%'), 'student products enforce year and enabled');
SELECT fixture.assert_true((SELECT array_agg(lecture_id ORDER BY lecture_id)=ARRAY['test-y1'] FROM public.lecture_module_map WHERE lecture_id LIKE 'test-%'), 'student map enforces year');
SELECT fixture.assert_true((SELECT count(*)=2 AND bool_and(user_id=auth.uid()) FROM public.module_entitlements), 'student sees own entitlements only including historical other-year receipt');
SELECT fixture.assert_true((SELECT array_agg(lecture_id)=ARRAY['test-y1'] FROM public.mcq_questions), 'other-year entitlement cannot unlock MCQ');
SELECT fixture.assert_true(fixture.denied('SELECT correct_option FROM public.mcq_questions'), 'student MCQ answer denied');
SELECT fixture.assert_true(fixture.denied('SELECT content FROM public.assessment_items'), 'student assessment answers denied');
SELECT fixture.assert_true((SELECT count(*)=0 FROM public.assessment_items WHERE year<>1), 'published assessment policy cannot bypass academic year');
SELECT fixture.assert_true(fixture.denied('INSERT INTO public.module_entitlements(user_id,module_code,product_type,academic_year) VALUES (auth.uid(),''SELF-GRANT'',''mcq'',1)'), 'student cannot self-grant entitlement');
SELECT fixture.assert_true(fixture.changed('UPDATE public.module_entitlements SET revoked_at=NULL, expires_at=now()+interval ''100 years'', price_paid_egp=0')=0, 'student cannot extend or alter entitlements');
SELECT fixture.assert_true(fixture.changed('UPDATE public.module_entitlements SET user_id=''00000000-0000-0000-0000-000000000002''')=0, 'student cannot transfer entitlement');
SELECT fixture.assert_true(fixture.changed('DELETE FROM public.module_entitlements')=0, 'student cannot delete entitlements');
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mcq_stages','mcq_levels'] LOOP
    PERFORM fixture.assert_true(fixture.denied('INSERT INTO public.'||t||' SELECT * FROM public.'||t||' LIMIT 1'),'student metadata INSERT denied '||t);
    PERFORM fixture.assert_true(fixture.changed('UPDATE public.'||t||' SET label_en=''attack''')=0,'student metadata UPDATE filtered '||t);
    PERFORM fixture.assert_true(fixture.changed('DELETE FROM public.'||t)=0,'student metadata DELETE filtered '||t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['module_products','lecture_module_map'] LOOP
    PERFORM fixture.assert_true(fixture.denied('INSERT INTO public.'||t||' DEFAULT VALUES'),'student INSERT denied '||t);
    PERFORM fixture.assert_true(fixture.denied('UPDATE public.'||t||' SET academic_year=7'),'student UPDATE denied '||t);
    PERFORM fixture.assert_true(fixture.denied('DELETE FROM public.'||t),'student DELETE denied '||t);
  END LOOP;
END $$;
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET medical_year=2 WHERE id=auth.uid();
    RAISE EXCEPTION 'FAIL: student year changed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Academic year can only be changed by an administrator.' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: student academic year update blocked';
END $$;
SELECT fixture.assert_true(NOT has_function_privilege(current_user,'public.service_submit_mcq_answers(uuid,jsonb)','EXECUTE'), 'service grading RPC not callable by student');
RESET ROLE;

-- A fresh login with no profile/year must fail closed, including paid metadata.
SET ROLE authenticated;
SET request.jwt.claim.sub = '';
SELECT fixture.assert_true((SELECT count(*)=0 FROM public.module_products), 'missing JWT has no products');
SELECT fixture.assert_true((SELECT count(*)=0 FROM public.module_entitlements), 'missing JWT has no entitlements');
SELECT fixture.assert_true((SELECT count(*)=0 FROM public.lecture_module_map), 'missing JWT has no map');
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
SELECT fixture.assert_true((SELECT count(*)=0 FROM public.module_products), 'NULL academic year has no products');
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT fixture.assert_true((SELECT array_agg(module_code)=ARRAY['TEST-Y2'] FROM public.module_products WHERE module_code LIKE 'TEST-%'), 'second student sees second-year products only');
SELECT fixture.assert_true((SELECT count(*)=1 AND bool_and(user_id=auth.uid()) FROM public.module_entitlements), 'second student cannot read first student receipts');
RESET ROLE;

-- Expiry/revocation are enforced by the actual later policy, not just grants.
BEGIN;
UPDATE public.module_entitlements SET expires_at=now()-interval '1 second' WHERE user_id='00000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT fixture.assert_true((SELECT count(*)=0 FROM public.mcq_questions), 'expired entitlement does not unlock MCQ');
ROLLBACK;
BEGIN;
UPDATE public.module_entitlements SET revoked_at=now() WHERE user_id='00000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT fixture.assert_true((SELECT count(*)=0 FROM public.mcq_questions), 'revoked entitlement does not unlock MCQ');
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
SELECT fixture.assert_true(private.is_admin(), 'profile-backed administrator recognized');
SELECT fixture.assert_true((SELECT count(*)=2 FROM public.module_products WHERE module_code LIKE 'TEST-%'), 'admin reads enabled products across years');
SELECT fixture.assert_true((SELECT count(*)=3 FROM public.module_entitlements), 'admin reads all entitlements');
SELECT fixture.assert_true((SELECT count(*)=2 FROM public.lecture_module_map WHERE lecture_id LIKE 'test-%'), 'admin reads mapping across years');
INSERT INTO public.module_entitlements(user_id,module_code,product_type,academic_year) VALUES ('00000000-0000-0000-0000-000000000001','ADMIN-GRANT','mcq',1);
SELECT fixture.assert_true(fixture.changed('UPDATE public.module_entitlements SET revoked_at=now() WHERE module_code=''ADMIN-GRANT''')=1, 'admin can revoke entitlement');
SELECT fixture.assert_true(fixture.changed('DELETE FROM public.module_entitlements WHERE module_code=''ADMIN-GRANT''')=1, 'admin can delete entitlement');
DELETE FROM public.mcq_stages WHERE stage_no=5;
INSERT INTO public.mcq_stages(stage_no,label_en,label_ar,min_score,max_score) VALUES (5,'admin','admin',90,100);
SELECT fixture.assert_true(fixture.changed('UPDATE public.mcq_stages SET label_en=''admin-updated'' WHERE stage_no=5')=1, 'admin can CRUD stages');
DELETE FROM public.mcq_levels WHERE level_no=4;
INSERT INTO public.mcq_levels VALUES (4,'admin','admin','a','a','a','a',70);
SELECT fixture.assert_true(fixture.changed('UPDATE public.mcq_levels SET pass_threshold=80 WHERE level_no=4')=1, 'admin can CRUD levels');
SELECT fixture.assert_true(fixture.denied('UPDATE public.module_products SET price_egp=1'), 'authenticated admin cannot write server-managed products directly');
SELECT fixture.assert_true(fixture.denied('UPDATE public.lecture_module_map SET academic_year=7'), 'authenticated admin cannot write server-managed map directly');
ROLLBACK;

BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.sub='';
SELECT fixture.assert_true((SELECT count(*)=3 FROM public.module_products WHERE module_code LIKE 'TEST-%'), 'service sees disabled and all-year products');
SELECT fixture.assert_true((SELECT count(*)=3 FROM public.module_entitlements), 'service reads all entitlements without JWT');
INSERT INTO public.module_products VALUES ('SERVICE',7,'mcq',1,true,now());
SELECT fixture.assert_true(fixture.changed('UPDATE public.module_products SET price_egp=2 WHERE module_code=''SERVICE''')=1, 'service product UPDATE');
DELETE FROM public.module_products WHERE module_code='SERVICE';
INSERT INTO public.lecture_module_map VALUES ('service','SERVICE',7);
UPDATE public.lecture_module_map SET academic_year=6 WHERE lecture_id='service';
DELETE FROM public.lecture_module_map WHERE lecture_id='service';
INSERT INTO public.module_entitlements(user_id,module_code,product_type,academic_year) VALUES ('00000000-0000-0000-0000-000000000001','SERVICE','mcq',7);
UPDATE public.module_entitlements SET revoked_at=now() WHERE module_code='SERVICE';
DELETE FROM public.module_entitlements WHERE module_code='SERVICE';
DELETE FROM public.mcq_stages WHERE stage_no=5;
INSERT INTO public.mcq_stages(stage_no,label_en,label_ar,min_score,max_score) VALUES (5,'service','service',90,100);
UPDATE public.mcq_stages SET label_en='service-updated' WHERE stage_no=5;
DELETE FROM public.mcq_levels WHERE level_no=4;
INSERT INTO public.mcq_levels VALUES (4,'service','service','a','a','a','a',70);
UPDATE public.mcq_levels SET pass_threshold=80 WHERE level_no=4;
SELECT fixture.assert_true(true, 'service CRUD succeeds on all five tables including audit triggers');
ROLLBACK;

