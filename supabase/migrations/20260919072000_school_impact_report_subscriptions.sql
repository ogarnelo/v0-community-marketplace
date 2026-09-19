create table if not exists public.school_impact_report_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  enabled boolean not null default true,
  day_of_month smallint not null default 1 check (day_of_month between 1 and 28),
  last_sent_month text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create index if not exists school_impact_report_subscriptions_due_idx
  on public.school_impact_report_subscriptions (enabled, day_of_month);

alter table public.school_impact_report_subscriptions enable row level security;

revoke all on table public.school_impact_report_subscriptions from public;
revoke all on table public.school_impact_report_subscriptions from anon;
revoke all on table public.school_impact_report_subscriptions from authenticated;
grant select, insert, update, delete on table public.school_impact_report_subscriptions to service_role;
