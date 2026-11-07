-- REVIEW ONLY: emergency containment after an approved deployment.
-- Deliberately disables public variant metadata. It does NOT restore the unsafe
-- SECURITY DEFINER view, delete source data, or change source admin policies.
-- A production execution still requires explicit owner approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
REVOKE ALL ON public.lecture_document_variants_public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.lecture_document_variant_catalog FROM PUBLIC, anon, authenticated;
COMMIT;
