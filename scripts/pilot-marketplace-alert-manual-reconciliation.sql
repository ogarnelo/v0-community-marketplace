-- Disposable PostgreSQL 17 fixture; never execute against real Supabase.
\i supabase/migrations/20261110223000_marketplace_alert_reconcile_accepted_v1.sql

do $$
declare
 eventkey text := 'saved-search-match/manual-synthetic-accepted';
 payloadhash text := repeat('a',64);
 token uuid;
 state text;
 manualcount bigint;
 unresolvedcount bigint;
begin
 select intent_token into token from public.marketplace_alert_email_prepare_v1(eventkey,payloadhash);
 if token is null or not public.marketplace_alert_email_begin_v1(eventkey,payloadhash,token) then
   raise exception 'Synthetic intent did not begin';
 end if;
 if not public.marketplace_alert_email_ambiguous_v1(eventkey,token) then
   raise exception 'Synthetic ambiguity not recorded';
 end if;
 if public.marketplace_alert_reconcile_accepted_v1(
    eventkey,'provider-id-synthetic',repeat('b',64),'unverified'
 ) then
   raise exception 'Unapproved evidence source passed';
 end if;
 if public.marketplace_alert_reconcile_accepted_v1(
    eventkey,'provider-id-synthetic','not-sha','resend_api'
 ) then
   raise exception 'Unverifiable digest passed';
 end if;
 if public.marketplace_alert_reconcile_accepted_v1(
    eventkey,'',repeat('b',64),'resend_api'
 ) then
   raise exception 'Missing provider ID passed';
 end if;
 select outcome into state from public.marketplace_alert_email_prepare_v1(eventkey,payloadhash);
 if state<>'ambiguous' then
   raise exception 'Invalid manual evidence released uncertain email';
 end if;
 if not public.marketplace_alert_reconcile_accepted_v1(
    eventkey,'provider-id-synthetic',repeat('b',64),'resend_api'
 ) then
   raise exception 'Verified synthetic provider receipt could not be recorded';
 end if;
 if public.marketplace_alert_reconcile_accepted_v1(
    eventkey,'provider-id-other',repeat('c',64),'resend_dashboard'
 ) then
   raise exception 'Accepted receipt was overwritten by a later reconciliation';
 end if;
 if (select provider_message_id from public.marketplace_alert_email_intents
       where event_key=eventkey)<>'provider-id-synthetic' then
   raise exception 'Original provider receipt changed';
 end if;
 if public.marketplace_alert_email_begin_v1(eventkey,payloadhash,token) then
   raise exception 'Manually accepted email was resent';
 end if;
 select outcome into state from public.marketplace_alert_email_prepare_v1(eventkey,payloadhash);
 if state<>'accepted' then raise exception 'Manual acceptance did not persist'; end if;
 select confirmed_manually,unresolved_ambiguous
 into manualcount,unresolvedcount
 from public.marketplace_alert_reconciliation_health_v1();
 if manualcount<1 then raise exception 'No manual acceptance in private counts'; end if;
 if unresolvedcount is null then raise exception 'Missing unresolved counts'; end if;
end $$;

do $$
begin
 if has_function_privilege('anon',
       'public.marketplace_alert_reconcile_accepted_v1(text,text,text,text)','EXECUTE')
    or has_function_privilege('authenticated',
       'public.marketplace_alert_reconciliation_health_v1()','EXECUTE')
    or not has_function_privilege('service_role',
       'public.marketplace_alert_reconcile_accepted_v1(text,text,text,text)','EXECUTE')
 then raise exception 'Manual reconciliation RPC privilege leak'; end if;
end $$;
select 'PASS: privileged manual confirmation without retry, with immutable provider receipt and private counts' as result;
