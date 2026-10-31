-- Focused fixture, NOT a complete fresh-install migration replay.
-- The repository does not contain private.is_admin or mcq_questions creation.
-- Model those dependencies explicitly; never silently claim deployment parity.
CREATE SCHEMA private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id), medical_year integer, role text NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_profile_read ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY fixture_profile_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
-- Body/signature/search_path verified via read-only production catalog on
-- 2026-10-31. auth.uid() remains a synthetic claim adapter, not real JWT validation.
CREATE FUNCTION private.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
$$;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO anon, authenticated, service_role;

CREATE TABLE public.mcq_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lecture_id text, topic text, subtopic text,
  difficulty integer, published boolean DEFAULT false, question_text text,
  option_a text, option_b text, option_c text, option_d text, question_type text,
  source_scope text, created_at timestamptz DEFAULT now(), correct_option text,
  explanation text, learning_point_id text, image_required boolean, image_status text,
  image_reason text, quality_status text DEFAULT 'ready'
);
ALTER TABLE public.mcq_questions ENABLE ROW LEVEL SECURITY;
-- Other dependencies of the real hardening migration; never granted to clients.
CREATE TABLE public.lecture_settings (lecture_id text);
CREATE TABLE public.lecture_assets (lecture_id text);
CREATE TABLE public.lecture_pricing_rules (lecture_id text);
CREATE TABLE public.manual_payment_channels (id uuid);
CREATE TABLE public.manual_payment_requests (id uuid);

\ir ../../supabase/migrations/20261006172000_payment_transaction_ledger.sql
\ir ../../supabase/migrations/20261006181500_mcq_mastery_tracking.sql
\ir ../../supabase/migrations/20261006184500_mcq_four_level_cognitive_model.sql
\ir ../../supabase/migrations/20261006214500_assessment_center_cases_osce_images.sql
\ir ../../supabase/migrations/20261007093000_paid_module_assessments.sql
\ir ../../supabase/migrations/20261007093500_lock_student_academic_year.sql
\ir ../../supabase/migrations/20261007094000_paid_module_content_rls.sql
\ir ../../supabase/migrations/20261008080000_six_month_assessment_access.sql

-- Missing prerequisite columns, also absent from the checked-in history.
ALTER TABLE public.assessment_items
  ADD COLUMN learning_point_id text, ADD COLUMN case_style text,
  ADD COLUMN quality_status text DEFAULT 'ready', ADD COLUMN image_required boolean,
  ADD COLUMN image_status text;
\ir ../../supabase/migrations/20261008193000_security_hardening.sql
\ir ../../supabase/migrations/20261008232000_launch_assessment_hardening.sql
\ir ../../supabase/migrations/20261009174500_fix_mcq_submit_service_rpc.sql

CREATE SCHEMA fixture;
GRANT USAGE ON SCHEMA fixture TO anon, authenticated, service_role;
CREATE FUNCTION fixture.assert_true(ok boolean, message text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', message; END IF;
  RAISE NOTICE 'PASS: %', message;
END $$;
CREATE FUNCTION fixture.denied(statement text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  EXECUTE statement;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN RETURN true;
END $$;
CREATE FUNCTION fixture.changed(statement text) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE n bigint;
BEGIN EXECUTE statement; GET DIAGNOSTICS n = ROW_COUNT; RETURN n; END $$;

INSERT INTO auth.users(id) VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-000000000004');
INSERT INTO public.profiles VALUES
 ('00000000-0000-0000-0000-000000000001',1,'student'),
 ('00000000-0000-0000-0000-000000000002',2,'student'),
 ('00000000-0000-0000-0000-000000000003',3,'admin'),
 ('00000000-0000-0000-0000-000000000004',NULL,'student');
INSERT INTO public.module_products(module_code,academic_year,product_type,price_egp,enabled) VALUES
 ('TEST-Y1',1,'mcq',100,true), ('TEST-Y2',2,'mcq',100,true),
 ('TEST-OFF',1,'mcq',100,false);
INSERT INTO public.lecture_module_map VALUES ('test-y1','TEST-Y1',1),('test-y2','TEST-Y2',2);
INSERT INTO public.module_entitlements(user_id,module_code,product_type,academic_year) VALUES
 ('00000000-0000-0000-0000-000000000001','TEST-Y1','mcq',1),
 ('00000000-0000-0000-0000-000000000001','TEST-Y2','mcq',2),
 ('00000000-0000-0000-0000-000000000002','TEST-Y2','mcq',2);
INSERT INTO public.mcq_questions(id,lecture_id,published,correct_option,explanation) VALUES
 ('10000000-0000-0000-0000-000000000001','test-y1',true,'A','secret'),
 ('10000000-0000-0000-0000-000000000002','test-y2',true,'B','secret');

