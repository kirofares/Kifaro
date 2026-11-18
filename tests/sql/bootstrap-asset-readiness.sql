-- Run just after the original view is created. All identities and paths are synthetic.
BEGIN;
DO $$ BEGIN
  IF (SELECT array_agg(attname::text ORDER BY attnum) FROM pg_attribute
      WHERE attrelid = 'public.lecture_asset_readiness'::regclass AND attnum > 0 AND NOT attisdropped)
     IS DISTINCT FROM ARRAY['lecture_id','has_video','has_datashow','has_pdf','has_pptx'] THEN
    RAISE EXCEPTION 'Unexpected public readiness projection';
  END IF;
END $$;

INSERT INTO auth.users(id) VALUES
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
-- Replace the auto-created student fixture with the administrator fixture as owner.
DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002';
INSERT INTO public.profiles(id, role) VALUES ('00000000-0000-0000-0000-000000000002', 'admin');
INSERT INTO public.lecture_settings(lecture_id, access_mode) VALUES ('test-paid','paid');
INSERT INTO public.lecture_entitlements(user_id, lecture_id, price_paid_egp)
VALUES ('00000000-0000-0000-0000-000000000001','test-paid',40);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
INSERT INTO public.lecture_assets(lecture_id, video_path, pdf_path, pptx_path)
VALUES ('test-paid','private/video',NULL,'  '), ('test-other',NULL,'  ','private/pptx');
UPDATE public.lecture_assets SET pdf_path = 'private/pdf' WHERE lecture_id = 'test-paid';
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM public.lecture_assets WHERE lecture_id = 'test-paid'
                 AND video_path = 'private/video' AND pdf_path = 'private/pdf') THEN
    RAISE EXCEPTION 'Administrator read/write failed';
  END IF;
END $$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF EXISTS (SELECT FROM public.lecture_assets WHERE lecture_id = 'test-paid') THEN
    RAISE EXCEPTION 'Entitled student can read the raw asset row';
  END IF;
  UPDATE public.lecture_assets SET pdf_path = NULL WHERE lecture_id = 'test-paid';
  IF FOUND THEN RAISE EXCEPTION 'Student can update the raw asset row'; END IF;
  BEGIN
    INSERT INTO public.lecture_assets(lecture_id) VALUES ('test-student-write');
    RAISE EXCEPTION 'Student can insert a raw asset row';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF NOT EXISTS (SELECT FROM public.lecture_asset_readiness WHERE lecture_id = 'test-paid'
                 AND has_video AND has_datashow AND has_pdf AND NOT has_pptx) THEN
    RAISE EXCEPTION 'Student readiness flags incorrect';
  END IF;
  IF NOT EXISTS (SELECT FROM public.lecture_asset_readiness WHERE lecture_id = 'test-other'
                 AND NOT has_video AND NOT has_datashow AND NOT has_pdf AND has_pptx) THEN
    RAISE EXCEPTION 'Missing, blank or PPTX-only readiness flags incorrect';
  END IF;
  BEGIN
    PERFORM * FROM public.consume_lecture_asset('test-other','video');
    RAISE EXCEPTION 'Unentitled video request unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'No active access' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.consume_lecture_asset('test-paid','pptx');
    RAISE EXCEPTION 'Student can request an original PPTX';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Original files are admin only' THEN RAISE; END IF;
  END;
END $$;

SET LOCAL request.jwt.claim.sub = '';
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF EXISTS (SELECT FROM public.lecture_assets WHERE lecture_id = 'test-paid') THEN
    RAISE EXCEPTION 'Anonymous raw row visible';
  END IF;
  IF NOT EXISTS (SELECT FROM public.lecture_asset_readiness WHERE lecture_id = 'test-paid'
                 AND has_video AND has_datashow AND has_pdf AND NOT has_pptx) THEN
    RAISE EXCEPTION 'Anonymous readiness flags incorrect';
  END IF;
END $$;
ROLLBACK;
\echo PASS: bootstrap asset readiness and role checks
