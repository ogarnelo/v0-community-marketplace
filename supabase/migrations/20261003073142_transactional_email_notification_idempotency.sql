alter table public.notifications
  add column if not exists event_key text;

create unique index if not exists notifications_event_key_uidx
  on public.notifications(event_key)
  where event_key is not null;

create table if not exists public.transactional_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,
  provider text not null default 'resend',
  provider_message_id text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint transactional_email_deliveries_event_key_check
    check (char_length(event_key) between 1 and 200)
);

alter table public.transactional_email_deliveries enable row level security;

revoke all on table public.transactional_email_deliveries from anon, authenticated;
grant select, insert, update, delete on table public.transactional_email_deliveries to service_role;

drop policy if exists transactional_email_deliveries_service_role
  on public.transactional_email_deliveries;
create policy transactional_email_deliveries_service_role
  on public.transactional_email_deliveries
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists transactional_email_deliveries_user_sent_idx
  on public.transactional_email_deliveries(user_id, sent_at desc)
  where user_id is not null;
