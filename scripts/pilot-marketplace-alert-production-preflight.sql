-- WETUDY PILOT / SAFE READ-ONLY PREFLIGHT.
-- No DDL, DML, RPC mutations, email, PII export or worker activation.
-- Review target project ID before execution. Never pass credentials here.
begin transaction read only;

select
  current_setting('server_version') as postgres_version,
  (to_regclass('public.marketplace_alert_outbox') is not null) as outbox_exists,
  (to_regclass('public.marketplace_alert_email_intents') is not null) as intents_exists,
  (to_regprocedure('public.marketplace_alert_email_prepare_v1(text,text)') is not null) as intent_prepare_exists,
  (to_regprocedure('public.marketplace_alert_email_begin_v1(text,text,uuid)') is not null) as intent_begin_exists,
  (to_regprocedure('public.marketplace_alert_email_accept_v1(text,uuid,text)') is not null) as intent_accept_exists,
  (to_regprocedure('public.marketplace_alert_email_ambiguous_v1(text,uuid)') is not null) as intent_ambiguous_exists,
  (to_regprocedure('public.marketplace_alert_hold_for_review_v1(uuid,uuid)') is not null) as review_hold_exists,
  (to_regprocedure('public.marketplace_alert_review_count_v1()') is not null) as review_count_exists,
  (to_regprocedure('public.marketplace_alert_reconciliation_health_v1()') is not null) as reconciliation_health_exists,
  (to_regprocedure('public.marketplace_alert_reconcile_accepted_v1(text,text,text,text)') is not null) as reconciliation_rpc_exists;

select
  count(*) as total_outbox,
  count(*) filter (where state='pending') as pending_outbox,
  count(*) filter (where state='processing') as processing_outbox,
  count(*) filter (where state='review_required') as review_outbox,
  count(*) filter (where state='failed') as failed_outbox
from public.marketplace_alert_outbox;

select
  coalesce((
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    where c.conrelid = to_regclass('public.marketplace_alert_outbox')
      and c.conname='marketplace_alert_outbox_state_check'
    limit 1
  ), 'missing') as outbox_state_constraint;

-- Read-only catalog inspection of the provider ID uniqueness guard.
select exists (
  select 1 from pg_indexes
  where schemaname='public' and tablename='marketplace_alert_email_intents'
    and indexname='marketplace_alert_email_intents_provider_receipt_uq'
    and indexdef ilike '%UNIQUE INDEX%'
    and indexdef ilike '%provider_message_id%'
) as provider_receipt_unique_index_exists;

-- Verify that SQL functions actually include expiry fencing after migration.
-- Do not call the state-changing RPCs during a production preflight.
select p.proname,
  pg_get_functiondef(p.oid) like '%lease_until > now()%' as checks_lease_expiry,
  pg_get_functiondef(p.oid) like '%expires_at > now()%' as checks_job_expiry
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'marketplace_alert_settle_outbox_v1',
  'marketplace_alert_requeue_progress_v1',
  'marketplace_alert_defer_readiness_v1'
)
order by p.proname;

select
  relname,
  relrowsecurity as rls_enabled
from pg_class
where oid in (
  to_regclass('public.marketplace_alert_outbox'),
  to_regclass('public.marketplace_alert_email_intents')
)
order by relname;

select
  (select count(*) from public.listings where is_demo=true) as demo_listing_count;

commit;
