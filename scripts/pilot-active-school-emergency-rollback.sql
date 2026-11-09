-- EMERGENCY ROLLBACK CANDIDATE ONLY. Not run automatically.
-- WARNING: removes the database-level guard and reopens the QR bypass.
-- Use only as an explicitly approved emergency action.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
DROP TRIGGER IF EXISTS active_profile_school_guard ON public.profiles;
DROP FUNCTION IF EXISTS public.enforce_active_profile_school();
COMMIT;
