-- Pilot-only hardening for the existing send-intent ledger.
-- A Resend message ID is a unique provider receipt, never evidence that two
-- different saved-search events were both accepted.
-- Safe to apply only AFTER the intent and manual-reconciliation migrations.
-- Production migrations are NOT applied by adding this file to GitHub.
create unique index if not exists marketplace_alert_email_intents_provider_receipt_uq
  on public.marketplace_alert_email_intents(provider_message_id)
  where provider_message_id is not null;

-- No new grants or RLS policies. Both the normal accept RPC and the manual
-- reconciliation RPC inherit the uniqueness constraint automatically.
