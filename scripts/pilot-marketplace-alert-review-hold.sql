-- Disposable PostgreSQL17-only fixture, never a Supabase production query.
\i supabase/migrations/20261110215000_marketplace_alert_outbox_review_hold_v1.sql
insert into public.listings(id,seller_id,status,is_demo)
values ('90000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001','available',false);

do $$
declare
 k uuid := '90000000-0000-4000-8000-000000000001';
 t uuid;
 c bigint;
begin
 select lease_token into t from public.marketplace_alert_claim_outbox_v1(2,240)
 where listing_id=k;
 if t is null then raise exception 'Synthetic review listing not leased'; end if;
 if public.marketplace_alert_hold_for_review_v1(k,gen_random_uuid()) then
   raise exception 'Stale token was able to quarantine';
 end if;
 if not public.marketplace_alert_hold_for_review_v1(k,t) then
   raise exception 'Current lease could not quarantine';
 end if;
 if (select state from public.marketplace_alert_outbox where listing_id=k)<>'review_required' then
   raise exception 'Ambiguous event requeued instead of quarantined';
 end if;
 if (select lease_token from public.marketplace_alert_outbox where listing_id=k) is not null then
   raise exception 'Quarantined lease token retained';
 end if;
 if public.marketplace_alert_hold_for_review_v1(k,t) then
   raise exception 'Completed quarantine allowed a second transition';
 end if;
 if public.marketplace_alert_settle_outbox_v1(k,t,true) then
   raise exception 'Stale worker falsely completed review-required listing';
 end if;
 if public.marketplace_alert_requeue_progress_v1(k,t) then
   raise exception 'Quarantined listing was requeued';
 end if;
 if (select count(*) from public.marketplace_alert_claim_outbox_v1(2,240)
      where listing_id=k)<>0 then
   raise exception 'Quarantined listing was reclaimed';
 end if;
 select public.marketplace_alert_review_count_v1() into c;
 if c<1 then raise exception 'Private aggregate review count does not include hold'; end if;
end $$;

do $$
begin
 if has_function_privilege('anon','public.marketplace_alert_hold_for_review_v1(uuid,uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.marketplace_alert_review_count_v1()','EXECUTE')
  or not has_function_privilege('service_role','public.marketplace_alert_hold_for_review_v1(uuid,uuid)','EXECUTE') then
    raise exception 'Review quarantine RPC permissions are unsafe';
 end if;
end $$;
select 'PASS: ambiguous email quarantined with fencing, private count, no retries' as result;
