-- Run before the actual bootstrap. No state survives this contract test.
BEGIN;
CREATE TEMP VIEW asset_security_snapshot AS
SELECT jsonb_build_object(
  'relation', (SELECT jsonb_build_object('owner',relowner,'acl',relacl,
    'rls',relrowsecurity,'force_rls',relforcerowsecurity)
    FROM pg_class WHERE oid='public.lecture_assets'::regclass),
  'policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname)
    FROM pg_policies p WHERE schemaname='public' AND tablename='lecture_assets'),
  'constraints', (SELECT jsonb_agg(jsonb_build_object('name',conname,
    'definition',pg_get_constraintdef(oid)) ORDER BY conname)
    FROM pg_constraint WHERE conrelid='public.lecture_assets'::regclass),
  'indexes', (SELECT jsonb_agg(to_jsonb(i) ORDER BY indexname)
    FROM pg_indexes i WHERE schemaname='public' AND tablename='lecture_assets')
) AS state;
CREATE TEMP TABLE asset_security_before AS SELECT state FROM asset_security_snapshot;
CREATE TEMP TABLE asset_columns_before AS
SELECT a.attname, a.atttypid, a.atttypmod, a.attnotnull, a.attacl,
       pg_get_expr(d.adbin,d.adrelid) AS default_expression
FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE a.attrelid='public.lecture_assets'::regclass AND a.attnum>0 AND NOT a.attisdropped;

\ir ../../supabase/bootstrap/lecture-asset-paths.sql

DO $$ BEGIN
  IF (SELECT state FROM asset_security_before) IS DISTINCT FROM
     (SELECT state FROM asset_security_snapshot) THEN
    RAISE EXCEPTION 'Bootstrap changed owner, RLS, ACLs, policies, constraints or indexes';
  END IF;
  IF EXISTS (
    SELECT 1 FROM asset_columns_before b
    LEFT JOIN pg_attribute a ON a.attrelid='public.lecture_assets'::regclass
      AND a.attname=b.attname AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attname IS NULL OR ROW(a.atttypid,a.atttypmod,a.attnotnull,a.attacl,pg_get_expr(d.adbin,d.adrelid))
      IS DISTINCT FROM ROW(b.atttypid,b.atttypmod,b.attnotnull,b.attacl,b.default_expression)
  ) THEN RAISE EXCEPTION 'Bootstrap changed existing columns'; END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.lecture_assets'::regclass
      AND attnum>0 AND NOT attisdropped) <> (SELECT count(*)+3 FROM asset_columns_before) THEN
    RAISE EXCEPTION 'Bootstrap did not add exactly three columns';
  END IF;
  IF (SELECT count(*) FROM pg_attribute a LEFT JOIN pg_attrdef d
      ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid='public.lecture_assets'::regclass
      AND a.attname IN ('video_path','pdf_path','pptx_path')
      AND a.atttypid='text'::regtype AND NOT a.attnotnull AND d.oid IS NULL AND a.attacl IS NULL) <> 3 THEN
    RAISE EXCEPTION 'Incorrect path column contract';
  END IF;
END $$;
ROLLBACK;
\echo PASS: exact three-column addition; existing schema and security unchanged
