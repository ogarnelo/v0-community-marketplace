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
  (to_regprocedure('public.marketplace_alert_review_count_v1()') is not null) as review_count_exists;

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
