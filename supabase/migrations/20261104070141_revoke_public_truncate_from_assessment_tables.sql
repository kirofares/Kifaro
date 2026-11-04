-- Applied to Supabase production on 2026-11-04 via migration
-- 20261104070141_revoke_public_truncate_from_assessment_tables.
-- SECURITY: RLS cannot restrict PostgreSQL TRUNCATE.
-- Preserve SELECT/INSERT/UPDATE/DELETE grants, ownership and every RLS policy.
-- No data is modified; never run TRUNCATE to test this migration.
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['mcq_stages','mcq_levels','module_products','module_entitlements','lecture_module_map']
  LOOP
    EXECUTE format('REVOKE TRUNCATE ON TABLE public.%I FROM PUBLIC, anon, authenticated', target);
    IF has_table_privilege('anon', format('public.%I', target), 'TRUNCATE')
       OR has_table_privilege('authenticated', format('public.%I', target), 'TRUNCATE') THEN
      RAISE EXCEPTION 'TRUNCATE privilege remains for %', target;
    END IF;
  END LOOP;
END $$;
