-- Atomic claim of two manual report delivery attempts per administrator/school/UTC day.
-- Separate table prevents concurrent requests from bypassing the quota.
-- A claimed slot remains spent even when email delivery fails: fail closed.
CREATE TABLE IF NOT EXISTS public.school_manual_report_send_claims (
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  utc_day date NOT NULL,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 2),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id,user_id,utc_day,slot)
);

ALTER TABLE public.school_manual_report_send_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_manual_report_send_claims FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.school_manual_report_send_claims TO service_role;

-- SECURITY INVOKER: this function does not bypass RLS or acquire elevated
-- rights. It can be called by the server's service role ONLY.
CREATE OR REPLACE FUNCTION public.claim_school_manual_report_slot(
  p_school_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  slot_num smallint;
  claimed smallint;
  today_utc date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF p_school_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  FOR slot_num IN 1..2 LOOP
    INSERT INTO public.school_manual_report_send_claims(
      school_id,user_id,utc_day,slot
    ) VALUES(p_school_id,p_user_id,today_utc,slot_num)
    ON CONFLICT DO NOTHING
    RETURNING slot INTO claimed;

    IF claimed IS NOT NULL THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_school_manual_report_slot(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_school_manual_report_slot(uuid,uuid)
  TO service_role;
