DO $$
DECLARE r text; obj text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH obj IN ARRAY ARRAY['lecture_document_variants_public','lecture_document_variant_catalog'] LOOP
      IF has_table_privilege(r, 'public.' || obj, 'SELECT') THEN
        RAISE EXCEPTION 'Containment failed: % can read %', r, obj;
      END IF;
    END LOOP;
  END LOOP;
END $$;
SET request.jwt.claims = '{"app_metadata":{"role":"admin"}}';
SET ROLE authenticated;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.lecture_document_variants WHERE lecture_id='fixture') <> 3 THEN
    RAISE EXCEPTION 'Containment changed source data or admin access';
  END IF;
END $$;
RESET ROLE;
