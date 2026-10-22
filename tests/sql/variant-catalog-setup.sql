-- DESTRUCTIVE FIXTURE BOOTSTRAP: disposable local PostgreSQL only.
-- Intentionally fails if any object already exists; never resets an existing DB.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA private;
GRANT USAGE ON SCHEMA public, private TO anon, authenticated;

-- Unit fixture only: NOT the deployed is_admin() implementation. Staging must
-- test genuine Auth JWTs and the actual private.is_admin()/profile role source.
CREATE FUNCTION private.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb
    -> 'app_metadata' ->> 'role' = 'admin', false)
$$;

-- Emulate permissive legacy Supabase defaults to exercise explicit REVOKEs.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated;

\ir ../../supabase/migrations/20261010225000_lecture_document_variants.sql

INSERT INTO public.lecture_document_variants
  (lecture_id, variant_key, label, description, published, pdf_path, pptx_path)
VALUES
  ('fixture', 'published', 'Public title', 'Approved public summary', true, 'SECRET/pdf', ''),
  ('fixture', 'draft', 'Draft title', 'Draft summary', false, 'SECRET/draft', 'SECRET/pptx'),
  ('fixture', 'empty', 'No files', NULL, true, NULL, NULL);

-- Persist baseline across separate psql sessions. No real data in this fixture.
CREATE SCHEMA fixture;
REVOKE ALL ON SCHEMA fixture FROM PUBLIC;
CREATE TABLE fixture.baseline AS SELECT * FROM public.lecture_document_variants_public;
CREATE TABLE fixture.source_baseline AS SELECT * FROM public.lecture_document_variants;
CREATE TABLE fixture.source_security AS
  SELECT relacl::text, relrowsecurity FROM pg_class
  WHERE oid = 'public.lecture_document_variants'::regclass;
CREATE TABLE fixture.source_policy AS
  SELECT polname, pg_get_expr(polqual, polrelid) AS qual,
    pg_get_expr(polwithcheck, polrelid) AS check_expr
  FROM pg_policy WHERE polrelid = 'public.lecture_document_variants'::regclass;
