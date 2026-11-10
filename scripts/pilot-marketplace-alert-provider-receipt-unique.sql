-- Disposable PostgreSQL 17 fixture ONLY; never execute against production.
\i supabase/migrations/20261110224500_marketplace_alert_provider_receipt_unique.sql

do $$
declare
 k1 text := 'saved-search-match/qa-provider-unique-first';
 k2 text := 'saved-search-match/qa-provider-unique-second';
 token1 uuid;
 token2 uuid;
 rejected boolean := false;
 state2 text;
begin
 select intent_token into token1 from public.marketplace_alert_email_prepare_v1(k1,repeat('c',64));
 select intent_token into token2 from public.marketplace_alert_email_prepare_v1(k2,repeat('d',64));
 if not public.marketplace_alert_email_begin_v1(k1,repeat('c',64),token1)
   or not public.marketplace_alert_email_begin_v1(k2,repeat('d',64),token2) then
   raise exception 'Could not prepare synthetic intentions';
 end if;

 if not public.marketplace_alert_email_accept_v1(k1,token1,'synthetic-shared-receipt') then
   raise exception 'First provider receipt was rejected';
 end if;
 begin
   perform public.marketplace_alert_email_accept_v1(k2,token2,'synthetic-shared-receipt');
 exception when unique_violation then
   rejected := true;
 end;
 if not rejected then
   raise exception 'Same provider receipt accepted for second event';
 end if;

 select outcome into state2 from public.marketplace_alert_email_prepare_v1(k2,repeat('d',64));
 if state2 <> 'sending' then
   raise exception 'Second event changed state despite rejected receipt';
 end if;
 if not public.marketplace_alert_email_ambiguous_v1(k2,token2) then
   raise exception 'Could not quarantine the second unverified event';
 end if;
 rejected := false;
 begin
   perform public.marketplace_alert_reconcile_accepted_v1(
     k2,'synthetic-shared-receipt',repeat('e',64),'resend_api');
 exception when unique_violation then
   rejected := true;
 end;
 if not rejected then
   raise exception 'Manual reconciliation reused another event provider receipt';
 end if;
 if (select state from public.marketplace_alert_email_intents where event_key=k2) <> 'ambiguous' then
   raise exception 'Rejected manual reconciliation did not preserve quarantine';
 end if;
 if not public.marketplace_alert_reconcile_accepted_v1(
   k2,'synthetic-second-receipt',repeat('f',64),'resend_api') then
   raise exception 'Second distinct provider receipt was rejected';
 end if;
 if (select count(*) from public.marketplace_alert_email_intents
     where provider_message_id='synthetic-shared-receipt') <> 1 then
   raise exception 'Provider receipt is not unique';
 end if;
end $$;
select 'PASS: external message receipt cannot confirm two distinct alerts' as result;
