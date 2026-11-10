-- Loaded ONLY in disposable CI PostgreSQL 17 service after postal snapshot fixture.
\i supabase/migrations/20261110114223_marketplace_alert_outbox_health_v1.sql

do $$
begin
  if has_function_privilege('anon',
       'public.marketplace_alert_outbox_health_v1()','execute')
     or has_function_privilege('authenticated',
       'public.marketplace_alert_outbox_health_v1()','execute')
     or not has_function_privilege('service_role',
       'public.marketplace_alert_outbox_health_v1()','execute') then
    raise exception 'Read-only outbox health function leaked privileges';
  end if;
end $$;

-- Simulate an abandoned claim in the same throwaway database.
update public.marketplace_alert_outbox
  set state='processing',
      attempts=2,
      lease_token=gen_random_uuid(),
      lease_until=now()-interval '2 minutes'
where listing_id='00000000-0000-4000-8000-000000000010';

do $$
declare
  h record;
  expected bigint;
begin
  select * into h from public.marketplace_alert_outbox_health_v1();
  select count(*) into expected from public.marketplace_alert_outbox;
  if h.total is distinct from expected
     or h.pending is distinct from (
       select count(*) from public.marketplace_alert_outbox where state='pending'
     )
     or h.processing is distinct from (
       select count(*) from public.marketplace_alert_outbox where state='processing'
     )
     or h.completed is distinct from (
       select count(*) from public.marketplace_alert_outbox where state='completed'
     )
     or h.failed is distinct from (
       select count(*) from public.marketplace_alert_outbox where state='failed'
     )
     or h.overdue_leases < 1
     or h.expired_unfinished < 1
     or h.max_attempts < 2
     or h.oldest_unfinished_minutes < 0
     or h.total <> (h.pending+h.processing+h.completed+h.failed) then
    raise exception 'Wrong outbox health aggregation: %',row_to_json(h);
  end if;
end $$;

select 'PASS: read-only outbox health aggregated counts, expired jobs, overdue leases and role guards' as result;
