-- Limit the public lecture-variant metadata projection to its read-only API contract.
-- Direct grants inherited at view creation are not removed by revoking from PUBLIC alone.
-- Do not switch this view to security_invoker: the source table has admin-only RLS.
-- Keep its columns, published-row filter, source-table policies and admin grants intact.

REVOKE ALL PRIVILEGES
ON TABLE public.lecture_document_variants_public
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON TABLE public.lecture_document_variants_public
TO anon, authenticated;

DO $verify$
DECLARE
  api_role text;
  disallowed_privilege text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF NOT has_table_privilege(api_role, 'public.lecture_document_variants_public', 'SELECT') THEN
      RAISE EXCEPTION 'Public metadata SELECT was lost for %', api_role;
    END IF;

    FOREACH disallowed_privilege IN ARRAY ARRAY[
      'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ] LOOP
      IF has_table_privilege(api_role, 'public.lecture_document_variants_public', disallowed_privilege) THEN
        RAISE EXCEPTION 'Unexpected % permission remains for %', disallowed_privilege, api_role;
      END IF;
    END LOOP;

    IF has_any_column_privilege(api_role, 'public.lecture_document_variants_public', 'INSERT')
       OR has_any_column_privilege(api_role, 'public.lecture_document_variants_public', 'UPDATE')
       OR has_any_column_privilege(api_role, 'public.lecture_document_variants_public', 'REFERENCES') THEN
      RAISE EXCEPTION 'Unexpected column-level write permission remains for %', api_role;
    END IF;
  END LOOP;
END
$verify$;
