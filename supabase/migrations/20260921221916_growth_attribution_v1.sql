-- Privacy-minimal acquisition attribution for growth experiments.
-- Stores campaign/referral labels and conversion events without IP/device identifiers.

create table if not exists public.growth_acquisition_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  entity_id uuid,
  source text not null,
  medium text,
  campaign text,
  content text,
  landing_path text,
  referrer_host text,
  created_at timestamptz not null default now(),
  constraint growth_acquisition_events_type_allowed
    check (event_type in (
      'landing',
      'attributed_user',
      'listing_published',
      'agreement_confirmed',
      'school_joined'
    )),
  constraint growth_acquisition_events_source_length
    check (char_length(source) between 1 and 120),
  constraint growth_acquisition_events_medium_length
    check (medium is null or char_length(medium) <= 120),
  constraint growth_acquisition_events_campaign_length
    check (campaign is null or char_length(campaign) <= 160),
  constraint growth_acquisition_events_content_length
    check (content is null or char_length(content) <= 160),
  constraint growth_acquisition_events_landing_path_length
    check (landing_path is null or char_length(landing_path) <= 500),
  constraint growth_acquisition_events_referrer_host_length
    check (referrer_host is null or char_length(referrer_host) <= 255)
);

comment on table public.growth_acquisition_events is
  'Privacy-minimal first-touch attribution and downstream conversion events for Wetudy growth analysis.';

alter table public.growth_acquisition_events enable row level security;

revoke all on table public.growth_acquisition_events from public;
revoke all on table public.growth_acquisition_events from anon;
revoke all on table public.growth_acquisition_events from authenticated;
grant select on table public.growth_acquisition_events to authenticated;
grant all on table public.growth_acquisition_events to service_role;

drop policy if exists growth_acquisition_events_superadmin_read
  on public.growth_acquisition_events;

create policy growth_acquisition_events_superadmin_read
  on public.growth_acquisition_events
  for select
  to authenticated
  using (public.is_superadmin());

create index if not exists growth_acquisition_events_created_at_idx
  on public.growth_acquisition_events (created_at desc);

create index if not exists growth_acquisition_events_source_idx
  on public.growth_acquisition_events (source, medium, campaign, created_at desc);

create index if not exists growth_acquisition_events_user_id_idx
  on public.growth_acquisition_events (user_id, created_at desc)
  where user_id is not null;

create unique index if not exists growth_acquisition_events_first_touch_user_idx
  on public.growth_acquisition_events (user_id)
  where event_type = 'attributed_user' and user_id is not null;

create unique index if not exists growth_acquisition_events_conversion_entity_idx
  on public.growth_acquisition_events (event_type, entity_id, user_id)
  where entity_id is not null and user_id is not null;
