-- Preserve authenticated playback access after removing anonymous privileges.
GRANT EXECUTE ON FUNCTION private.consume_bunny_video(text) TO authenticated, service_role;
