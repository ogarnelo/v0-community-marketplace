alter table public.transactional_email_deliveries
  add column if not exists recipient_email_hash text;

create index if not exists transactional_email_deliveries_recipient_hash_idx
  on public.transactional_email_deliveries(recipient_email_hash, sent_at desc)
  where recipient_email_hash is not null;

create table if not exists public.transactional_email_recipient_health (
  recipient_email_hash text primary key,
  user_id uuid references auth.users(id) on delete set null,
  soft_bounce_count integer not null default 0
    check (soft_bounce_count >= 0),
  is_suppressed boolean not null default false,
  suppression_reason text,
  source_event_id text,
  source_provider_message_id text,
  last_event_type text,
  last_event_at timestamptz,
  suppressed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactional_email_recipient_health_reason_check
    check (
      suppression_reason is null
      or suppression_reason in ('hard_bounce','soft_bounce_limit','complaint','provider_suppressed')
    )
);

alter table public.transactional_email_recipient_health enable row level security;
revoke all on table public.transactional_email_recipient_health from public, anon, authenticated;
grant select, insert, update, delete on table public.transactional_email_recipient_health to service_role;

drop policy if exists transactional_email_recipient_health_service_role
  on public.transactional_email_recipient_health;
create policy transactional_email_recipient_health_service_role
  on public.transactional_email_recipient_health
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists transactional_email_recipient_health_suppressed_idx
  on public.transactional_email_recipient_health(is_suppressed, updated_at desc)
  where is_suppressed = true;
