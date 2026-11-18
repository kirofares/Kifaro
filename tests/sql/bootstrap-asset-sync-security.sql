-- Exercise the later invoker view and trigger, not just the earlier owner view.
BEGIN;
INSERT INTO public.lecture_assets(lecture_id,video_provider,video_path,pdf_path,pptx_path)
VALUES ('sync-local','supabase','private/video','private/pdf',NULL),
       ('sync-empty','supabase',NULL,' ',NULL);
INSERT INTO public.lecture_assets(lecture_id,pdf_path) VALUES ('sync-pdf-only','private/pdf');
INSERT INTO public.lecture_assets(lecture_id,video_provider,bunny_video_id,bunny_status)
VALUES ('sync-bunny','bunny','synthetic-bunny-id','ready');
DO $$ BEGIN
  IF NOT (SELECT reloptions @> ARRAY['security_invoker=true'] FROM pg_class
          WHERE oid='public.lecture_asset_readiness'::regclass) THEN
    RAISE EXCEPTION 'Readiness view must be security invoker';
  END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF EXISTS (SELECT FROM public.lecture_assets WHERE lecture_id LIKE 'sync-%') THEN
    RAISE EXCEPTION 'Raw asset paths exposed to anon';
  END IF;
  IF NOT EXISTS (SELECT FROM public.lecture_asset_readiness WHERE lecture_id='sync-local'
      AND has_video AND has_pdf AND NOT has_pptx) OR
     NOT EXISTS (SELECT FROM public.lecture_asset_readiness WHERE lecture_id='sync-empty'
      AND NOT has_video AND NOT has_pdf AND NOT has_pptx) OR
     NOT EXISTS (SELECT FROM public.lecture_asset_readiness WHERE lecture_id='sync-pdf-only'
      AND NOT has_video AND has_pdf AND NOT has_pptx) OR
     NOT EXISTS (SELECT FROM public.get_lecture_asset_readiness() WHERE lecture_id='sync-bunny' AND has_video) THEN
    RAISE EXCEPTION 'Synced flags incorrect';
  END IF;
  BEGIN
    UPDATE public.lecture_asset_readiness_public SET has_video=false WHERE lecture_id='sync-local';
    RAISE EXCEPTION 'Anon can write readiness';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000099';
DO $$ BEGIN
  IF EXISTS (SELECT FROM public.lecture_assets WHERE lecture_id LIKE 'sync-%') THEN
    RAISE EXCEPTION 'Raw asset paths exposed to student';
  END IF;
  BEGIN
    UPDATE public.lecture_asset_readiness SET has_video=false WHERE lecture_id='sync-local';
    RAISE EXCEPTION 'Student can write through readiness view';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.lecture_assets SET video_path=NULL,pdf_path=NULL WHERE lecture_id='sync-local';
DELETE FROM public.lecture_assets WHERE lecture_id='sync-bunny';
DO $$ BEGIN
  IF EXISTS (SELECT FROM public.lecture_asset_readiness WHERE lecture_id='sync-local' AND (has_video OR has_pdf))
    OR EXISTS (SELECT FROM public.lecture_asset_readiness WHERE lecture_id='sync-bunny') THEN
    RAISE EXCEPTION 'Update/delete readiness sync failed';
  END IF;
END $$;
ROLLBACK;
\echo PASS: later invoker view, role protection and readiness synchronization
