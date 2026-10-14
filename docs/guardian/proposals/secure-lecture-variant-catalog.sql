-- KIFARO Guardian: REVIEW-ONLY proposed SQL; not a registered Supabase migration.
-- Owner approval and a properly generated migration filename are required before applying.
-- Why: security_invoker=true on the old view would break public access because
-- the original lecture_document_variants table is admin-only and includes private paths.
-- This proposal publishes only a safe projection of approved metadata, never private paths.
--
-- Preconditions:
-- 1. Back up metadata; check current table schema and viewer expectations.
-- 2. Review WITH a Supabase security owner. Run on a staging DB first.
-- 3. Confirm real anon / student / admin read behavior after applying.

BEGIN;

CREATE TABLE IF NOT EXISTS public.lecture_document_variant_catalog (
  lecture_id text NOT NULL,
  variant_key text NOT NULL,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 1,
  published boolean NOT NULL DEFAULT false,
  available_pdf boolean NOT NULL DEFAULT false,
  available_pptx boolean NOT NULL DEFAULT false,
  PRIMARY KEY (lecture_id, variant_key)
);

ALTER TABLE public.lecture_document_variant_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lecture_document_variant_catalog FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS lecture_document_variant_catalog_published_select
  ON public.lecture_document_variant_catalog;
CREATE POLICY lecture_document_variant_catalog_published_select
  ON public.lecture_document_variant_catalog FOR SELECT
  TO anon, authenticated USING (published IS TRUE);
GRANT SELECT ON public.lecture_document_variant_catalog TO anon, authenticated;

-- A private trigger ensures public flags are based on the authoritative record.
-- No source_name, pdf_path, pptx_path or user data is persisted in this table.
CREATE OR REPLACE FUNCTION private.sync_lecture_document_variant_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lecture_document_variant_catalog
      WHERE lecture_id = OLD.lecture_id AND variant_key = OLD.variant_key;
    RETURN OLD;
  END IF;

  INSERT INTO public.lecture_document_variant_catalog
    (lecture_id, variant_key, label, description, sort_order,
     published, available_pdf, available_pptx)
  VALUES
    (NEW.lecture_id, NEW.variant_key, NEW.label, NEW.description, NEW.sort_order,
     NEW.published, (NEW.pdf_path IS NOT NULL AND length(NEW.pdf_path) > 0),
     (NEW.pptx_path IS NOT NULL AND length(NEW.pptx_path) > 0))
  ON CONFLICT (lecture_id, variant_key)
  DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    published = EXCLUDED.published,
    available_pdf = EXCLUDED.available_pdf,
    available_pptx = EXCLUDED.available_pptx;

  IF TG_OP = 'UPDATE'
    AND (OLD.lecture_id, OLD.variant_key) IS DISTINCT FROM (NEW.lecture_id, NEW.variant_key) THEN
    DELETE FROM public.lecture_document_variant_catalog
      WHERE lecture_id = OLD.lecture_id AND variant_key = OLD.variant_key;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION private.sync_lecture_document_variant_catalog()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_lecture_document_variant_catalog
  ON public.lecture_document_variants;
CREATE TRIGGER sync_lecture_document_variant_catalog
  AFTER INSERT OR UPDATE OR DELETE ON public.lecture_document_variants
  FOR EACH ROW EXECUTE FUNCTION private.sync_lecture_document_variant_catalog();

-- Backfill and prune in the same transaction to prevent stale catalog records.
INSERT INTO public.lecture_document_variant_catalog
  (lecture_id, variant_key, label, description, sort_order,
   published, available_pdf, available_pptx)
SELECT lecture_id, variant_key, label, description, sort_order,
       published, (pdf_path IS NOT NULL AND length(pdf_path)>0),
       (pptx_path IS NOT NULL AND length(pptx_path)>0)
FROM public.lecture_document_variants
ON CONFLICT (lecture_id, variant_key)
DO UPDATE SET label=EXCLUDED.label,
  description=EXCLUDED.description,
  sort_order=EXCLUDED.sort_order,
  published=EXCLUDED.published,
  available_pdf=EXCLUDED.available_pdf,
  available_pptx=EXCLUDED.available_pptx;

DELETE FROM public.lecture_document_variant_catalog c
WHERE NOT EXISTS (
  SELECT 1 FROM public.lecture_document_variants s
  WHERE s.lecture_id=c.lecture_id AND s.variant_key=c.variant_key
);

-- Preserve the existing API view name and columns used in the React hook.
-- Crucially, all invoker-accessible columns are public-safe projection columns.
CREATE OR REPLACE VIEW public.lecture_document_variants_public
WITH (security_invoker = true)
AS SELECT lecture_id, variant_key, label, description, sort_order,
          published, available_pdf, available_pptx
FROM public.lecture_document_variant_catalog
WHERE published IS TRUE;

REVOKE ALL ON public.lecture_document_variants_public FROM PUBLIC;
GRANT SELECT ON public.lecture_document_variants_public TO anon, authenticated;

-- Fail closed if the view somehow did not become invoker-owned.
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='lecture_document_variants_public'
      AND 'security_invoker=true'=ANY(COALESCE(c.reloptions,ARRAY[]::text[]))
  ) THEN
    RAISE EXCEPTION 'Expected security_invoker=true on public variants view';
  END IF;
END $check$;

COMMIT;

-- Post-deployment checks (run separately, with role-aware test identities):
-- (a) anon: SELECT public.lecture_document_variants_public works for published rows.
-- (b) anon: SELECT public.lecture_document_variants rejects.
-- (c) student: only published variants, with no private storage path fields.
-- (d) admin: original table remains readable, including draft records.
-- (e) after an admin update/delete, public view reflects it immediately.
-- (f) rerun Supabase security advisors; inspect access logs and app viewer.
