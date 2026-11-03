-- Read-only regression check. Run as the database owner with SET ROLE permission.
-- EXPLAIN never executes the writes, and WHERE false adds a second safety boundary.
BEGIN READ ONLY;

DO $test$
DECLARE
  api_role text;
  probe text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', api_role);

    -- Match the frontend's projection; private file paths must not be exposed.
    EXECUTE 'SELECT lecture_id, variant_key, label, description, sort_order,
                    published, available_pdf, available_pptx
             FROM public.lecture_document_variants_public LIMIT 0';

    FOREACH probe IN ARRAY ARRAY[
      'EXPLAIN INSERT INTO public.lecture_document_variants_public (lecture_id, variant_key, label) SELECT ''regression-only'', ''regression-only'', ''regression-only'' WHERE false',
      'EXPLAIN UPDATE public.lecture_document_variants_public SET label = label WHERE false',
      'EXPLAIN DELETE FROM public.lecture_document_variants_public WHERE false'
    ] LOOP
      BEGIN
        EXECUTE probe;
        RAISE EXCEPTION 'Unexpected write permission for %', api_role;
      EXCEPTION WHEN insufficient_privilege THEN
        NULL; -- Expected: PostgreSQL SQLSTATE 42501.
      END;
    END LOOP;

    EXECUTE 'RESET ROLE';
  END LOOP;
END
$test$;

SELECT 'PASS: anon/authenticated can read metadata; INSERT/UPDATE/DELETE planning is denied for both roles' AS result;
ROLLBACK;
