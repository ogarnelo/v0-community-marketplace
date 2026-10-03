create table if not exists public.transactional_email_health_daily_snapshots (
  snapshot_date date primary key,
  window_days smallint not null default 30
    check (window_days between 1 and 365),
  total integer not null default 0 check (total >= 0),
  delivered integer not null default 0 check (delivered >= 0),
  delayed integer not null default 0 check (delayed >= 0),
  bounced integer not null default 0 check (bounced >= 0),
  complained integer not null default 0 check (complained >= 0),
  failed integer not null default 0 check (failed >= 0),
  provider_suppressed integer not null default 0 check (provider_suppressed >= 0),
  pending integer not null default 0 check (pending >= 0),
  delivery_rate numeric(9,4),
  bounce_rate numeric(9,4),
  complaint_rate numeric(9,4),
  active_suppressions integer not null default 0 check (active_suppressions >= 0),
  provider_unsuppressed integer not null default 0 check (provider_unsuppressed >= 0),
  alert_keys text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactional_email_health_daily_snapshots enable row level security;
revoke all on table public.transactional_email_health_daily_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.transactional_email_health_daily_snapshots to service_role;

drop policy if exists transactional_email_health_daily_snapshots_service_role
  on public.transactional_email_health_daily_snapshots;
create policy transactional_email_health_daily_snapshots_service_role
  on public.transactional_email_health_daily_snapshots
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.transactional_email_health_alert_states (
  metric text primary key
    check (metric in ('bounce_rate','complaint_rate')),
  threshold_percent numeric(9,4) not null check (threshold_percent >= 0),
  is_active boolean not null default false,
  generation integer not null default 0 check (generation >= 0),
  last_value_percent numeric(9,4),
  crossed_at timestamptz,
  recovered_at timestamptz,
  last_evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactional_email_health_alert_states enable row level security;
revoke all on table public.transactional_email_health_alert_states from public, anon, authenticated;
grant select, insert, update, delete on table public.transactional_email_health_alert_states to service_role;

drop policy if exists transactional_email_health_alert_states_service_role
  on public.transactional_email_health_alert_states;
create policy transactional_email_health_alert_states_service_role
  on public.transactional_email_health_alert_states
  for all
  to service_role
  using (true)
  with check (true);
