-- This test runs ONLY inside the disposable PostgreSQL 17 GitHub runner.
-- Database URL must be local wetudy_ci; the workflow checks this explicitly.
\i supabase/migrations/20261110211000_marketplace_alert_email_send_intents_v1.sql

do $$
declare
  k text := 'saved-search-match/qa-synthetic-only';
  h text := repeat('a',64);
  tok uuid;
  status text;
begin
  select outcome,intent_token into status,tok
    from public.marketplace_alert_email_prepare_v1(k,h);
  if status <> 'prepared' or tok is null then
    raise exception 'New email intent not prepared';
  end if;
  select outcome into status
    from public.marketplace_alert_email_prepare_v1(k,repeat('b',64));
  if status <> 'payload_conflict' then
    raise exception 'Changed provider payload was accepted';
  end if;
  if public.marketplace_alert_email_begin_v1(k,h,gen_random_uuid()) then
    raise exception 'Wrong token started sending';
  end if;
  if not public.marketplace_alert_email_begin_v1(k,h,tok) then
    raise exception 'Prepared intent was not claimed';
  end if;
  if public.marketplace_alert_email_begin_v1(k,h,tok) then
    raise exception 'Second worker started same send';
  end if;
  select outcome into status from public.marketplace_alert_email_prepare_v1(k,h);
  if status <> 'sending' then
    raise exception 'Uncertain sending intent reset automatically';
  end if;
  if public.marketplace_alert_email_accept_v1(k,gen_random_uuid(),'provider-1') then
    raise exception 'Wrong token acknowledged provider';
  end if;
  if not public.marketplace_alert_email_ambiguous_v1(k,tok) then
    raise exception 'Unknown result could not be quarantined';
  end if;
  if public.marketplace_alert_email_begin_v1(k,h,tok) then
    raise exception 'Ambiguous request retried automatically';
  end if;
  select outcome into status from public.marketplace_alert_email_prepare_v1(k,h);
  if status <> 'ambiguous' then
    raise exception 'Ambiguity did not persist';
  end if;
  if public.marketplace_alert_email_accept_v1(k,tok,'provider-1') then
    raise exception 'Ambiguous intent accepted without reconciliation';
  end if;

  k := 'saved-search-match/qa-success';
  select intent_token into tok from public.marketplace_alert_email_prepare_v1(k,h);
  if not public.marketplace_alert_email_begin_v1(k,h,tok) then
    raise exception 'Second prepared intent not started';
  end if;
  if not public.marketplace_alert_email_accept_v1(k,tok,'provider-synthetic') then
    raise exception 'Provider acceptance not recorded';
  end if;
  select outcome into status from public.marketplace_alert_email_prepare_v1(k,h);
  if status <> 'accepted' then raise exception 'Accepted state not durable'; end if;
  if public.marketplace_alert_email_begin_v1(k,h,tok) then
    raise exception 'Accepted intent sent twice';
  end if;
end $$;

do $permission_test$
begin
  if has_table_privilege('anon','public.marketplace_alert_email_intents','SELECT') then
    raise exception 'Anon can read email send intent';
  end if;
  if has_table_privilege('authenticated','public.marketplace_alert_email_intents','INSERT') then
    raise exception 'Authenticated can write email send intent';
  end if;
  if has_function_privilege('anon','public.marketplace_alert_email_prepare_v1(text,text)','EXECUTE') then
    raise exception 'Anon can reserve email send intent';
  end if;
  if has_function_privilege('authenticated','public.marketplace_alert_email_begin_v1(text,text,uuid)','EXECUTE') then
    raise exception 'Authenticated can call send begin';
  end if;
end $permission_test$;
do $health_test$
declare m record;
begin
  select * into m from public.marketplace_alert_email_intent_health_v1();
  if m.total <> 2 or m.ambiguous <> 1 or m.accepted <> 1
    or m.sending <> 0 or m.prepared <> 0 then
    raise exception 'Incorrect aggregate email intent health';
  end if;
  if has_function_privilege('anon',
    'public.marketplace_alert_email_intent_health_v1()','EXECUTE') then
    raise exception 'Anon can execute private email intent health';
  end if;
end $health_test$;

select 'PASS: durable, fenced, immutable send intents; ambiguous states fail closed' as result;
