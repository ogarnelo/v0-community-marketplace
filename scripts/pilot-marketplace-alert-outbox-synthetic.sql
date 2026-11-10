-- Disposable PostgreSQL 17 fixture. Never run against Supabase production.
-- The tables, users and listings here exist only in a GitHub Actions service.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create table public.listings(
  id uuid primary key,
  seller_id uuid,
  user_id uuid,
  status text,
  is_demo boolean
);

\i supabase/migrations/20261110111353_marketplace_alert_outbox_v1.sql

do $$
begin
  if has_table_privilege('anon', 'public.marketplace_alert_outbox', 'select') or
     has_table_privilege('authenticated', 'public.marketplace_alert_outbox', 'insert') or
     has_function_privilege('anon', 'public.marketplace_alert_claim_outbox_v1(integer,integer)', 'execute') or
     has_function_privilege('authenticated', 'public.marketplace_alert_settle_outbox_v1(uuid,uuid,boolean,text)', 'execute') or
     has_schema_privilege('anon','wetudy_internal','usage') or
     not has_function_privilege('service_role','public.marketplace_alert_claim_outbox_v1(integer,integer)','execute') then
    raise exception 'Outbox privileges are not restricted';
  end if;
  if (select not relrowsecurity from pg_class where oid='public.marketplace_alert_outbox'::regclass) then
    raise exception 'RLS is not enabled';
  end if;
end $$;

insert into public.listings(id,seller_id,status,is_demo) values
 ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','available',false),
 ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','available',true),
 ('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','reserved',false);

do $$
declare
  initial_id uuid;
  correct_token uuid;
  got_attempts integer;
  claimed_count integer;
begin
  if (select count(*) from public.marketplace_alert_outbox) <> 1 then
    raise exception 'Expected one outbox row (not DEMO or reserved)';
  end if;
  select q.listing_id,q.lease_token,q.attempts
    into initial_id,correct_token,got_attempts
    from public.marketplace_alert_claim_outbox_v1(1,240) q;
  if initial_id is distinct from '00000000-0000-4000-8000-000000000001'::uuid or
     correct_token is null or got_attempts <> 1 then
    raise exception 'Initial claim failed';
  end if;
  select count(*) into claimed_count from public.marketplace_alert_claim_outbox_v1(1,240);
  if claimed_count <> 0 then
    raise exception 'Leased job must not be claimed twice';
  end if;
  if public.marketplace_alert_settle_outbox_v1(initial_id,gen_random_uuid(),true) then
    raise exception 'Wrong fencing token can settle a job';
  end if;
  if not public.marketplace_alert_settle_outbox_v1(initial_id,correct_token,true) then
    raise exception 'Correct lease cannot settle job';
  end if;
  if (select state from public.marketplace_alert_outbox where listing_id=initial_id) <> 'completed' then
    raise exception 'Successful job not completed';
  end if;
end $$;

-- Real listing with no seller_id but an owner user_id must also enter queue.
insert into public.listings(id,user_id,status,is_demo) values
 ('00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','available',null);

do $$
declare
  id uuid;
  first_token uuid;
  second_token uuid;
  third_token uuid;
  tries integer;
  claimed_count integer;
begin
  select q.listing_id,q.lease_token,q.attempts into id,first_token,tries
    from public.marketplace_alert_claim_outbox_v1(1,240) q;
  if tries <> 1 then raise exception 'Missing first attempt'; end if;
  if not public.marketplace_alert_settle_outbox_v1(id,first_token,false,'worker_5xx') then
    raise exception 'Could not defer failed attempt';
  end if;
  if (select state from public.marketplace_alert_outbox where listing_id=id) <> 'pending'
    or (select next_attempt_at from public.marketplace_alert_outbox where listing_id=id) <= now() then
    raise exception 'Failed jobs must back off';
  end if;
  select count(*) into claimed_count from public.marketplace_alert_claim_outbox_v1(1,240);
  if claimed_count <> 0 then raise exception 'Backoff ignored'; end if;
  update public.marketplace_alert_outbox set next_attempt_at=now()-interval '1 minute'
    where listing_id=id;
  select q.lease_token,q.attempts into second_token,tries
    from public.marketplace_alert_claim_outbox_v1(1,240) q;
  if tries <> 2 or second_token=first_token then
    raise exception 'Retry token/attempt not advanced';
  end if;
  update public.marketplace_alert_outbox set lease_until=now()-interval '1 minute'
    where listing_id=id;
  select q.lease_token,q.attempts into third_token,tries
    from public.marketplace_alert_claim_outbox_v1(1,240) q;
  if tries <> 3 or third_token=second_token then
    raise exception 'Reclaim token/attempt not advanced';
  end if;
  if public.marketplace_alert_settle_outbox_v1(id,second_token,true) then
    raise exception 'Stale worker overwrote reclaimed lease';
  end if;
  if not public.marketplace_alert_settle_outbox_v1(id,third_token,true) then
    raise exception 'Current worker could not finish';
  end if;
end $$;

-- No expired work may ever be revived and email families long after listing.
insert into public.listings(id,seller_id,status,is_demo) values
 ('00000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','available',false);
update public.marketplace_alert_outbox set expires_at=now()-interval '1 minute'
 where listing_id='00000000-0000-4000-8000-000000000005';
do $$
begin
  if (select count(*) from public.marketplace_alert_claim_outbox_v1(1,240)) <> 0 then
    raise exception 'Expired job was claimed';
  end if;
end $$;

select 'PASS: isolated outbox captures, excludes DEMO, fences leases, backs off, and expires safely' as result;
