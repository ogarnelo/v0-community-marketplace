-- Pilot-only manual confirmation of provider-accepted mail.
-- No retry or HTTP/API call is performed by this migration.
-- Requires the earlier marketplace_alert_email_intents table.
alter table public.marketplace_alert_email_intents
  add column if not exists reconciled_at timestamptz;
alter table public.marketplace_alert_email_intents
  add column if not exists reconciliation_evidence_sha256 text;
alter table public.marketplace_alert_email_intents
  add column if not exists reconciliation_source text;

-- Only a server-side privileged operator WITH independently verified Resend
-- evidence may mark an ambiguous/sending intent accepted. A hash is an audit
-- fingerprint, NOT verification of authenticity. No path returns to prepared.
create or replace function public.marketplace_alert_reconcile_accepted_v1(
  p_event_key text,
  p_provider_message_id text,
  p_evidence_sha256 text,
  p_source text
) returns boolean
language sql security invoker set search_path = ''
as $$
  with confirmed as (
    update public.marketplace_alert_email_intents as i
       set state='accepted',
           accepted_at=now(),
           provider_message_id=p_provider_message_id,
           reconciled_at=now(),
           reconciliation_evidence_sha256=p_evidence_sha256,
           reconciliation_source=p_source
     where i.event_key=p_event_key
       and i.state in ('sending','ambiguous')
       and i.started_at is not null
       and p_provider_message_id is not null
       and length(trim(p_provider_message_id)) between 1 and 200
       and p_provider_message_id=trim(p_provider_message_id)
       and p_evidence_sha256 ~ '^[0-9a-f]{64}$'
       and p_source in ('resend_api','resend_dashboard')
    returning 1
  )
  select exists(select 1 from confirmed);
$$;

revoke all on function public.marketplace_alert_reconcile_accepted_v1(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.marketplace_alert_reconcile_accepted_v1(text,text,text,text)
  to service_role;

-- Minimal private totals for operational review; never return recipient IDs.
create or replace function public.marketplace_alert_reconciliation_health_v1()
returns table (
  confirmed_manually bigint,
  unresolved_sending bigint,
  unresolved_ambiguous bigint
)
language sql security invoker set search_path = ''
as $$
 select
   count(*) filter (where state='accepted' and reconciled_at is not null)::bigint,
   count(*) filter (where state='sending')::bigint,
   count(*) filter (where state='ambiguous')::bigint
 from public.marketplace_alert_email_intents;
$$;
revoke all on function public.marketplace_alert_reconciliation_health_v1()
  from public, anon, authenticated;
grant execute on function public.marketplace_alert_reconciliation_health_v1()
  to service_role;
notify pgrst, 'reload schema';
