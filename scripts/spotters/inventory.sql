-- Read-only operator export. Contains paid question content: keep outside the
-- public repository, public assets and CI logs. Do not export student data.
SELECT id, assessment_type, published, year, module_code, lecture_id, title,
       stem, instructions, content, media_url, media_alt, quality_status,
       image_status, updated_at
FROM public.assessment_items
WHERE assessment_type = 'spotter' AND published
ORDER BY year, module_code, id;
