-- Disposable PostgreSQL17 exercise for retrying partial recipient batches.
-- This file is never executed on the real Wetudy Supabase project.
create table public.saved_search_matches (
  id uuid primary key
);
\i supabase/migrations/20261110133500_marketplace_alert_delivery_progress.sql

do $$
begin
  if has_function_privilege('anon',
       'public.marketplace_alert_requeue_progress_v1(uuid,uuid)','execute')
     or has_function_privilege('authenticated',
       'public.marketplace_alert_requeue_progress_v1(uuid,uuid)','execute')
     or not has_function_privilege('service_role',
       'public.marketplace_alert_requeue_progress_v1(uuid,uuid)','execute') then
    raise exception 'Progress requeue RPC leaked execute rights';
  end if;
  if (select not relrowsecurity from pg_class where
      oid='public.marketplace_alert_outbox'::regclass) then
    raise exception 'Original outbox RLS unexpectedly disabled';
  end if;
end $$;

insert into public.saved_search_matches(id,email_skipped_at,email_skip_reason)
values
 ('10000000-0000-4000-8000-000000000011',now(),'suppressed'),
 ('10000000-0000-4000-8000-000000000012',now(),'recipient_missing');

do $$
begin
  if (select count(*) from public.saved_search_matches
      where email_skipped_at is not null) <> 2 then
    raise exception 'Terminal email skip columns not persisted';
  end if;
end $$;

-- The prior fixture left one stale lease at 00010. Make it the oldest
-- available job to select deterministically in this synthetic database.
update public.marketplace_alert_outbox
set next_attempt_at=now()-interval '4 hours',
    lease_until=now()-interval '2 minutes',
    state='processing',
    attempts=2
where listing_id='00000000-0000-4000-8000-000000000010';

do $$
declare
  claimed_id uuid;
  token uuid;
  new_token uuid;
  tries integer;
begin
  select x.listing_id,x.lease_token,x.attempts
    into claimed_id,token,tries
  from public.marketplace_alert_claim_outbox_v1(1,240) x;
  if claimed_id is distinct from '00000000-0000-4000-8000-000000000010'::uuid
     or tries <> 3 then
    raise exception 'Expected reclaimed stale lease on the targeted listing';
  end if;

  if public.marketplace_alert_requeue_progress_v1(claimed_id,gen_random_uuid()) then
    raise exception 'Wrong fencing token released someone else''s lease';
  end if;

  if not public.marketplace_alert_requeue_progress_v1(claimed_id,token) then
    raise exception 'Correct progress token failed to requeue';
  end if;
  if (select state from public.marketplace_alert_outbox where listing_id=claimed_id) <> 'pending'
     or (select attempts from public.marketplace_alert_outbox where listing_id=claimed_id) <> 0
     or (select lease_token from public.marketplace_alert_outbox where listing_id=claimed_id) is not null
     or (select next_attempt_at from public.marketplace_alert_outbox where listing_id=claimed_id) <= now() then
    raise exception 'Partial work did not release the lease with a short delay';
  end if;

  -- This synthetic fast-forward emulates the next scheduled invocation.
  update public.marketplace_alert_outbox
    set next_attempt_at=now()-interval '1 minute'
  where listing_id=claimed_id;

  select x.lease_token,x.attempts into new_token,tries
    from public.marketplace_alert_claim_outbox_v1(1,240) x;
  if tries <> 1 or new_token=token then
    raise exception 'Partial progress should resume with fresh lease and attempt budget';
  end if;

  if public.marketplace_alert_requeue_progress_v1(claimed_id,token) then
    raise exception 'Stale lease was allowed to requeue after a new claim';
  end if;

  if not public.marketplace_alert_settle_outbox_v1(claimed_id,new_token,true) then
    raise exception 'Current lease cannot mark completed after progress';
  end if;
  if public.marketplace_alert_requeue_progress_v1(claimed_id,new_token) then
    raise exception 'Completed job was incorrectly revived';
  end if;
end $$;

select 'PASS: progress safe requeue, fencing tokens, bounded retries, terminal skips and RLS' as result;
