-- FRESH INSTALL ONLY. Invoked by the disposable replay runner after the first
-- eight historical files. Not a forward migration and never run by db push.
-- private.is_admin: ledger 20260930114254, confirmed pg_get_functiondef 2026-11-01.
-- Pricing: reconstructed from production catalog metadata (not original DDL).
-- No application rows, payment records or credentials are copied.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles)
     OR EXISTS (SELECT 1 FROM public.lecture_entitlements)
     OR EXISTS (SELECT 1 FROM public.lecture_assets)
     OR EXISTS (SELECT 1 FROM public.lecture_settings)
     OR to_regclass('public.lecture_pricing_rules') IS NOT NULL
     OR to_regprocedure('private.is_admin()') IS NOT NULL THEN
    RAISE EXCEPTION 'Bootstrap refuses existing pricing/helper objects';
  END IF;
END $$;
CREATE SCHEMA private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;
CREATE FUNCTION private.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin');
$$;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO anon, authenticated, service_role;

CREATE TABLE public.lecture_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id text NOT NULL,
  academic_year integer CHECK (academic_year BETWEEN 1 AND 7),
  nationality_match text NOT NULL DEFAULT '*',
  price_egp numeric(10,2) NOT NULL CHECK (price_egp >= 0),
  view_limit integer CHECK (view_limit IS NULL OR view_limit >= 1),
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_type text NOT NULL DEFAULT 'bundle'
    CHECK (product_type IN ('video','datashow','bundle'))
);
CREATE UNIQUE INDEX lecture_pricing_rules_unique_scope ON public.lecture_pricing_rules
  (lecture_id,coalesce(academic_year,0),lower(nationality_match),product_type);
ALTER TABLE public.lecture_pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY pricing_rules_admin_all ON public.lecture_pricing_rules
  FOR ALL TO authenticated USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY pricing_rules_student_matching_select ON public.lecture_pricing_rules
  FOR SELECT TO authenticated USING (
    enabled AND EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id=(SELECT auth.uid())
      AND (lecture_pricing_rules.academic_year IS NULL OR lecture_pricing_rules.academic_year=p.medical_year)
      AND (lecture_pricing_rules.nationality_match='*'
        OR lower(lecture_pricing_rules.nationality_match)=lower(coalesce(p.nationality,''))
        OR (lecture_pricing_rules.nationality_match='NON_EGYPTIAN'
          AND lower(coalesce(p.nationality,''))<>ALL(ARRAY['egyptian','egypt'])))));
-- Deliberately do not restore excess legacy ALL/TRUNCATE privileges.
REVOKE ALL ON public.lecture_pricing_rules FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.lecture_pricing_rules TO authenticated,service_role;
-- The audit trigger and updated_by index are installed by later existing files.
