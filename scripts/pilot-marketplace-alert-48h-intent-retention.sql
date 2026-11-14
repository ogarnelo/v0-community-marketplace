-- WETUDY pilot. LOCAL disposable PG17 ONLY, no external calls, PII or secrets.
-- Run after marketplace_alert_email_send_intents_v1 has been installed by CI.
-- Simulate time passing by ageing ONLY synthetic fixture records.
DO $$
DECLARE
  h text := repeat('a',64);
  other_h text := repeat('b',64);
  k_send text := 'saved-search-match/qa-48h-sending';
  k_amb text := 'saved-search-match/qa-48h-ambiguous';
  k_ok text := 'saved-search-match/qa-48h-accepted';
  token uuid;
  observed text;
  got uuid;
BEGIN
  SELECT outcome,intent_token INTO observed,token
    FROM public.marketplace_alert_email_prepare_v1(k_send,h);
  IF observed <> 'prepared' OR token IS NULL THEN
    RAISE EXCEPTION '48h sending fixture could not prepare';
  END IF;
  IF NOT public.marketplace_alert_email_begin_v1(k_send,h,token) THEN
    RAISE EXCEPTION '48h sending fixture could not begin';
  END IF;
  UPDATE public.marketplace_alert_email_intents SET
    started_at = now()-interval '49 hours',
    created_at = now()-interval '49 hours'
  WHERE event_key=k_send;
  SELECT outcome,intent_token INTO observed,got
    FROM public.marketplace_alert_email_prepare_v1(k_send,h);
  IF observed<>'sending' OR got IS DISTINCT FROM token THEN
    RAISE EXCEPTION 'Sending state reset automatically after 49h';
  END IF;
  IF public.marketplace_alert_email_begin_v1(k_send,h,token) THEN
    RAISE EXCEPTION 'Old sending intent allowed a second provider attempt';
  END IF;
  SELECT outcome INTO observed FROM public.marketplace_alert_email_prepare_v1(k_send,other_h);
  IF observed<>'payload_conflict' THEN
    RAISE EXCEPTION 'Old sending intent accepted changed payload';
  END IF;

  SELECT intent_token INTO token FROM public.marketplace_alert_email_prepare_v1(k_amb,h);
  IF NOT public.marketplace_alert_email_begin_v1(k_amb,h,token)
     OR NOT public.marketplace_alert_email_ambiguous_v1(k_amb,token) THEN
    RAISE EXCEPTION 'Ambiguous fixture not prepared';
  END IF;
  UPDATE public.marketplace_alert_email_intents SET
    started_at=now()-interval '49 hours',
    created_at=now()-interval '49 hours'
  WHERE event_key=k_amb;
  SELECT outcome INTO observed FROM public.marketplace_alert_email_prepare_v1(k_amb,h);
  IF observed<>'ambiguous' OR public.marketplace_alert_email_begin_v1(k_amb,h,token) THEN
    RAISE EXCEPTION 'Ambiguous intent retried automatically after 49h';
  END IF;

  SELECT intent_token INTO token FROM public.marketplace_alert_email_prepare_v1(k_ok,h);
  IF NOT public.marketplace_alert_email_begin_v1(k_ok,h,token)
     OR NOT public.marketplace_alert_email_accept_v1(k_ok,token,'qa-provider-49h') THEN
    RAISE EXCEPTION 'Accepted fixture not prepared';
  END IF;
  UPDATE public.marketplace_alert_email_intents SET
    created_at=now()-interval '49 hours',
    started_at=now()-interval '49 hours',
    accepted_at=now()-interval '48 hours'
  WHERE event_key=k_ok;
  SELECT outcome INTO observed FROM public.marketplace_alert_email_prepare_v1(k_ok,h);
  IF observed<>'accepted' OR public.marketplace_alert_email_begin_v1(k_ok,h,token) THEN
    RAISE EXCEPTION 'Accepted intent restarted after 49h';
  END IF;
END $$;

SELECT 'PASS: after 49 hours sending/ambiguous/accepted cannot auto-retry, changed payload rejected' AS result;
