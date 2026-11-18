-- Candidate-only prerequisite for the historical readiness view.
-- Reconstructed from pg_catalog / information_schema on 2026-11-11.
-- The original base table, RLS and grants come from the historical migrations.
DO $$ BEGIN
  IF current_database() <> 'kifaro_bootstrap_test'
     OR EXISTS (SELECT 1 FROM public.lecture_assets)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.lecture_assets'::regclass) THEN
    RAISE EXCEPTION 'Asset bootstrap requires the empty RLS-enabled test table';
  END IF;
END $$;

-- Fail atomically if any expected addition already exists.
ALTER TABLE public.lecture_assets
  ADD COLUMN video_path text,
  ADD COLUMN pdf_path text,
  ADD COLUMN pptx_path text;
