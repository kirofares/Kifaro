GRANT USAGE ON SCHEMA fixture TO anon, authenticated;
-- Actual PostgreSQL authorization tests, not SQL substring checks.
-- Source schema/policy are loaded from the existing repository migration.
CREATE FUNCTION fixture.assert_true(ok boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', message; END IF;
  RAISE NOTICE 'PASS: %', message;
END $$;

CREATE FUNCTION fixture.denied(statement text)
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE statement;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN RETURN true;
END $$;

SELECT fixture.assert_true(NOT EXISTS (
  (SELECT * FROM fixture.baseline EXCEPT SELECT * FROM public.lecture_document_variants_public)
  UNION ALL
  (SELECT * FROM public.lecture_document_variants_public EXCEPT SELECT * FROM fixture.baseline)
), 'published API rows and values preserved exactly');
SELECT fixture.assert_true(NOT EXISTS (
  (SELECT * FROM fixture.source_baseline EXCEPT SELECT * FROM public.lecture_document_variants)
  UNION ALL
  (SELECT * FROM public.lecture_document_variants EXCEPT SELECT * FROM fixture.source_baseline)
), 'source rows unchanged by proposal and rejected reapplication');
SELECT fixture.assert_true((SELECT c.relacl::text = s.relacl AND c.relrowsecurity = s.relrowsecurity
  FROM pg_class c CROSS JOIN fixture.source_security s
  WHERE c.oid = 'public.lecture_document_variants'::regclass), 'source grants/RLS unchanged');
SELECT fixture.assert_true(NOT EXISTS (
  (SELECT polname, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
   FROM pg_policy WHERE polrelid = 'public.lecture_document_variants'::regclass
   EXCEPT SELECT * FROM fixture.source_policy)
  UNION ALL
  (SELECT * FROM fixture.source_policy EXCEPT
   SELECT polname, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
   FROM pg_policy WHERE polrelid = 'public.lecture_document_variants'::regclass)
), 'source admin policies unchanged');
SELECT fixture.assert_true((SELECT 'security_invoker=true' = ANY(reloptions)
  FROM pg_class WHERE oid = 'public.lecture_document_variants_public'::regclass), 'invoker view enabled');
SELECT fixture.assert_true((SELECT relrowsecurity FROM pg_class
  WHERE oid = 'public.lecture_document_variant_catalog'::regclass), 'catalog RLS enabled');
SELECT fixture.assert_true((SELECT array_agg(attname::text ORDER BY attnum)
  FROM pg_attribute WHERE attrelid = 'public.lecture_document_variant_catalog'::regclass
  AND attnum > 0 AND NOT attisdropped) = ARRAY[
  'lecture_id','variant_key','label','description','sort_order','published','available_pdf','available_pptx'
], 'catalog has exactly eight public columns');

-- Both anon and every authenticated identity must have SELECT ONLY, including
-- no TRUNCATE, REFERENCES or TRIGGER. RLS alone does not restrict TRUNCATE.
DO $$
DECLARE r text; obj text; privilege text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH obj IN ARRAY ARRAY['lecture_document_variant_catalog', 'lecture_document_variants_public'] LOOP
      PERFORM fixture.assert_true(has_table_privilege(r, 'public.' || obj, 'SELECT'), r || ' SELECT ' || obj);
      FOREACH privilege IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        PERFORM fixture.assert_true(NOT has_table_privilege(r, 'public.' || obj, privilege),
          r || ' lacks ' || privilege || ' on ' || obj);
      END LOOP;
    END LOOP;
    PERFORM fixture.assert_true(NOT has_function_privilege(r,
      'private.sync_lecture_document_variant_catalog()', 'EXECUTE'), r || ' cannot execute sync function');
  END LOOP;
END $$;

SET ROLE anon;
SELECT fixture.assert_true((SELECT count(*) = 2 FROM public.lecture_document_variants_public
  WHERE lecture_id = 'fixture'), 'anon sees only two published fixture variants');
SELECT fixture.assert_true((SELECT count(*) = 0 FROM public.lecture_document_variant_catalog
  WHERE published IS FALSE), 'anon cannot bypass filtering via catalog');
SELECT fixture.assert_true(fixture.denied('SELECT * FROM public.lecture_document_variants'), 'anon source SELECT denied');
SELECT fixture.assert_true(fixture.denied('INSERT INTO public.lecture_document_variant_catalog (lecture_id,variant_key,label) VALUES (''attack'',''x'',''x'')'), 'anon catalog INSERT denied');
SELECT fixture.assert_true(fixture.denied('UPDATE public.lecture_document_variants_public SET published = false'), 'anon view UPDATE denied');
SELECT fixture.assert_true(fixture.denied('DELETE FROM public.lecture_document_variant_catalog'), 'anon catalog DELETE denied');
SELECT fixture.assert_true(fixture.denied('TRUNCATE public.lecture_document_variant_catalog'), 'anon catalog TRUNCATE denied');
SELECT fixture.assert_true(fixture.denied('SELECT private.sync_lecture_document_variant_catalog()'), 'anon direct sync invocation denied');
RESET ROLE;

SET request.jwt.claims = '{"sub":"student-fixture","app_metadata":{"role":"student"},"user_metadata":{"role":"admin"}}';
SET ROLE authenticated;
SELECT fixture.assert_true((SELECT count(*) = 2 FROM public.lecture_document_variants_public
  WHERE lecture_id = 'fixture'), 'student metadata stays available');
SELECT fixture.assert_true((SELECT count(*) = 0 FROM public.lecture_document_variant_catalog
  WHERE published IS FALSE), 'student cannot read draft metadata through catalog');
SELECT fixture.assert_true((SELECT count(*) = 0 FROM public.lecture_document_variants), 'student source SELECT filtered by RLS; forged user_metadata is not admin');
SELECT fixture.assert_true(fixture.denied('INSERT INTO public.lecture_document_variants (lecture_id,variant_key,label) VALUES (''attack'',''x'',''x'')'), 'student source INSERT denied');
WITH changed AS (UPDATE public.lecture_document_variants SET published = true RETURNING *)
  SELECT fixture.assert_true((SELECT count(*) = 0 FROM changed), 'student source UPDATE changes zero rows');
WITH changed AS (DELETE FROM public.lecture_document_variants RETURNING *)
  SELECT fixture.assert_true((SELECT count(*) = 0 FROM changed), 'student source DELETE changes zero rows');
SELECT fixture.assert_true(fixture.denied('INSERT INTO public.lecture_document_variants_public (lecture_id,variant_key,label,published) VALUES (''attack'',''x'',''x'',true)'), 'student view INSERT denied');
SELECT fixture.assert_true(fixture.denied('UPDATE public.lecture_document_variant_catalog SET published = true'), 'student catalog UPDATE denied');
SELECT fixture.assert_true(fixture.denied('DELETE FROM public.lecture_document_variants_public'), 'student view DELETE denied');
SELECT fixture.assert_true(fixture.denied('TRUNCATE public.lecture_document_variants'), 'student source TRUNCATE denied');
SELECT fixture.assert_true(fixture.denied('SELECT private.sync_lecture_document_variant_catalog()'), 'student direct sync invocation denied');
RESET ROLE;

SET request.jwt.claims = '{"sub":"admin-fixture","app_metadata":{"role":"admin"}}';
SET ROLE authenticated;
SELECT fixture.assert_true((SELECT count(*) = 3 FROM public.lecture_document_variants
  WHERE lecture_id = 'fixture'), 'admin retains source access including draft');
SELECT fixture.assert_true((SELECT count(*) = 2 FROM public.lecture_document_variant_catalog
  WHERE lecture_id = 'fixture'), 'admin catalog still published-only');
SELECT fixture.assert_true(fixture.denied('UPDATE public.lecture_document_variant_catalog SET published = true'), 'admin must edit authoritative source, not catalog');
INSERT INTO public.lecture_document_variants (lecture_id,variant_key,label,published,pdf_path,pptx_path)
VALUES ('fixture', 'new', 'New', true, '', 'SECRET/new');
SELECT fixture.assert_true((SELECT NOT available_pdf AND available_pptx
  FROM public.lecture_document_variants_public WHERE lecture_id='fixture' AND variant_key='new'), 'admin INSERT sync and empty path flags');
UPDATE public.lecture_document_variants SET label='Updated', description='Updated public text', sort_order=9,
  pdf_path='SECRET/new-pdf', pptx_path=NULL WHERE lecture_id='fixture' AND variant_key='new';
SELECT fixture.assert_true((SELECT label='Updated' AND description='Updated public text' AND sort_order=9
  AND available_pdf AND NOT available_pptx FROM public.lecture_document_variants_public
  WHERE lecture_id='fixture' AND variant_key='new'), 'admin UPDATE syncs labels/order/path flags');
UPDATE public.lecture_document_variants SET published=false WHERE lecture_id='fixture' AND variant_key='new';
SELECT fixture.assert_true((SELECT count(*)=0 FROM public.lecture_document_variants_public
  WHERE lecture_id='fixture' AND variant_key='new'), 'unpublish removes public visibility');
UPDATE public.lecture_document_variants SET published=true WHERE lecture_id='fixture' AND variant_key='new';
UPDATE public.lecture_document_variants SET lecture_id='renamed', variant_key='moved'
  WHERE lecture_id='fixture' AND variant_key='new';
SELECT fixture.assert_true((SELECT count(*)=0 FROM public.lecture_document_variant_catalog
  WHERE lecture_id='fixture' AND variant_key='new'), 'key change removes stale catalog key');
SELECT fixture.assert_true((SELECT count(*)=1 FROM public.lecture_document_variants_public
  WHERE lecture_id='renamed' AND variant_key='moved'), 'republish and new key are visible');
DELETE FROM public.lecture_document_variants WHERE lecture_id='renamed';
SELECT fixture.assert_true((SELECT count(*)=0 FROM public.lecture_document_variant_catalog
  WHERE lecture_id='renamed'), 'admin DELETE removes catalog row');

BEGIN;
UPDATE public.lecture_document_variants SET published=false WHERE lecture_id='fixture';
ROLLBACK;
SELECT fixture.assert_true((SELECT count(*)=2 FROM public.lecture_document_variants_public
  WHERE lecture_id='fixture'), 'source rollback also rolls back trigger writes');
RESET ROLE;

BEGIN;
TRUNCATE public.lecture_document_variants;
SELECT fixture.assert_true((SELECT count(*)=0 FROM public.lecture_document_variant_catalog), 'privileged TRUNCATE clears catalog');
ROLLBACK;
SELECT fixture.assert_true((SELECT count(*)=3 FROM public.lecture_document_variants
  WHERE lecture_id='fixture'), 'TRUNCATE rollback restores source');
SELECT fixture.assert_true((SELECT count(*)=3 FROM public.lecture_document_variant_catalog
  WHERE lecture_id='fixture'), 'TRUNCATE rollback restores catalog');
