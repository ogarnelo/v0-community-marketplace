create table if not exists public.super_admin_report_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  enabled boolean not null default false,
  frequency_days smallint not null default 30
    check (frequency_days in (7, 15, 30)),
  report_range text not null default '90d'
    check (report_range in ('30d', '90d', '365d', 'total')),
  report_format text not null default 'both'
    check (report_format in ('pdf', 'csv', 'both')),
  last_sent_at timestamptz,
  next_send_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.super_admin_report_subscriptions enable row level security;

revoke all on public.super_admin_report_subscriptions from anon, authenticated;
grant all on public.super_admin_report_subscriptions to service_role;

create index if not exists super_admin_report_subscriptions_due_idx
  on public.super_admin_report_subscriptions(enabled, next_send_at)
  where enabled = true;
