-- Disposable PostgreSQL17 fixture. Run ONLY after the pilot outbox,
-- postcode, monitoring and partial-delivery fixtures in isolated GitHub CI.
-- NEVER run on production or a populated Wetudy database.
\i supabase/migrations/20261110145531_marketplace_alert_defer_photos_v1.sql

do $$
begin
  if has_function_privilege('anon',
       'public.marketplace_alert_defer_readiness_v1(uuid,uuid)','execute')
     or has_function_privilege('authenticated',
       'public.marketplace_alert_defer_readiness_v1(uuid,uuid)','execute')
     or not has_function_privilege('service_role',
       'public.marketplace_alert_defer_readiness_v1(uuid,uuid)','execute') then
    raise exception 'Readiness deferral RPC has unsafe privileges';
  end if;
end $$;

-- Clear prior synthetic jobs only in the disposable CI fixture to make claim
-- order deterministic; use a brand-new mock listing ID.
update public.marketplace_alert_outbox
  set state='completed', completed_at=now(), lease_token=null,
      lease_until=null
  where state <> 'completed';
insert into public.listings(id,seller_id,status,is_demo) values
 ('00000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000001','available',false);

do $$
declare
  claimed_id uuid;
  token_one uuid;
  token_two uuid;
  attempts_one integer;
  attempts_two integer;
  deferred boolean;
begin
  select x.listing_id,x.lease_token,x.attempts
    into claimed_id,token_one,attempts_one
  from public.marketplace_alert_claim_outbox_v1(1,240) x;
  if claimed_id <> '00000000-0000-4000-8000-000000000099'::uuid
     or attempts_one <> 1 then
    raise exception 'Expected queued listing with initial claim';
  end if;
  if public.marketplace_alert_defer_readiness_v1(claimed_id,gen_random_uuid()) then
    raise exception 'Unrelated worker deferred job with a forged lease token';
  end if;
  if not public.marketplace_alert_defer_readiness_v1(claimed_id,token_one) then
    raise exception 'Current lease cannot defer an incomplete listing';
  end if;

  if exists (
    select 1 from public.marketplace_alert_outbox q
    where q.listing_id=claimed_id
      and (q.state<>'pending'
           or q.attempts<>0
           or q.next_attempt_at <= now()+interval '4 minutes'
           or q.next_attempt_at > now()+interval '6 minutes'
           or q.lease_token is not null
           or q.last_error_code is not null)
  ) then
    raise exception 'Deferral must release lease and keep failure budget intact';
  end if;

  if public.marketplace_alert_defer_readiness_v1(claimed_id,token_one) then
    raise exception 'Deferred lease was reused twice';
  end if;

  if (select count(*) from public.marketplace_alert_claim_outbox_v1(1,240))<>0 then
    raise exception 'Photos pending job was reclaimed before five-minute backoff';
  end if;

  -- Simulate completing the photos and the worker's next scheduled call.
  update public.marketplace_alert_outbox
    set next_attempt_at=now()-interval '1 minute'
  where listing_id=claimed_id;

  select x.lease_token,x.attempts
    into token_two,attempts_two
  from public.marketplace_alert_claim_outbox_v1(1,240) x;
  if token_two=token_one or attempts_two<>1 then
    raise exception 'Ready listing did not retain its full failure budget';
  end if;
  if public.marketplace_alert_defer_readiness_v1(claimed_id,token_one) then
    raise exception 'Stale worker changed the new lease';
  end if;

  -- Expiry wins over all attempts; no late mail after the TTL.
  update public.marketplace_alert_outbox
    set expires_at=now()-interval '1 minute'
  where listing_id=claimed_id;
  if public.marketplace_alert_defer_readiness_v1(claimed_id,token_two) then
    raise exception 'Expired job was rescheduled after its 48-hour expiry';
  end if;
  if (select attempts from public.marketplace_alert_outbox
      where listing_id=claimed_id)<>1 then
    raise exception 'Expired task attempt count changed unexpectedly';
  end if;
end $$;

select 'PASS: missing photos defer 5m, preserve failure budget, fencing and TTL' as result;
