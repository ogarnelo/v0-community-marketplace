create table if not exists public.school_impact_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  email text not null,
  period_key text not null,
  period_label text not null,
  source text not null check (source in ('manual','cron')),
  provider_message_id text null,
  sent_at timestamptz not null default now()
);

create index if not exists school_impact_report_deliveries_school_sent_idx
  on public.school_impact_report_deliveries (school_id, sent_at desc);

alter table public.school_impact_report_deliveries enable row level security;

revoke all on table public.school_impact_report_deliveries from public;
revoke all on table public.school_impact_report_deliveries from anon;
revoke all on table public.school_impact_report_deliveries from authenticated;
grant select, insert on table public.school_impact_report_deliveries to service_role;
