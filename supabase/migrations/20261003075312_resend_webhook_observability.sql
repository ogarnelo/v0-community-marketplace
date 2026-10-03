alter table public.transactional_email_deliveries
  add column if not exists delivery_status text not null default 'sent',
  add column if not exists last_provider_event_type text,
  add column if not exists last_provider_event_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_delayed_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists complained_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists suppressed_at timestamptz;

alter table public.transactional_email_deliveries
  drop constraint if exists transactional_email_deliveries_delivery_status_check;

alter table public.transactional_email_deliveries
  add constraint transactional_email_deliveries_delivery_status_check
  check (delivery_status in ('sent','delivered','delayed','bounced','complained','failed','suppressed'));

create unique index if not exists transactional_email_deliveries_provider_message_uidx
  on public.transactional_email_deliveries(provider_message_id)
  where provider_message_id is not null;

create table if not exists public.resend_webhook_events (
  event_id text primary key,
  event_type text not null,
  provider_message_id text,
  event_created_at timestamptz not null,
  processed_at timestamptz,
  processing_result text,
  received_at timestamptz not null default now()
);

alter table public.resend_webhook_events enable row level security;
revoke all on table public.resend_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on table public.resend_webhook_events to service_role;

drop policy if exists resend_webhook_events_service_role on public.resend_webhook_events;
create policy resend_webhook_events_service_role
  on public.resend_webhook_events
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists resend_webhook_events_provider_message_idx
  on public.resend_webhook_events(provider_message_id, received_at desc)
  where provider_message_id is not null;

create table if not exists public.resend_webhook_secrets (
  id uuid primary key default gen_random_uuid(),
  webhook_id text not null,
  signing_secret text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  unique(webhook_id, signing_secret),
  constraint resend_webhook_secrets_format_check
    check (signing_secret like 'whsec_%')
);

alter table public.resend_webhook_secrets enable row level security;
revoke all on table public.resend_webhook_secrets from public, anon, authenticated;
grant select on table public.resend_webhook_secrets to service_role;

drop policy if exists resend_webhook_secrets_service_role_select on public.resend_webhook_secrets;
create policy resend_webhook_secrets_service_role_select
  on public.resend_webhook_secrets
  for select
  to service_role
  using (true);

create index if not exists resend_webhook_secrets_active_idx
  on public.resend_webhook_secrets(is_active, created_at desc)
  where is_active = true and retired_at is null;
