-- Demand B1: reuse demand_campaigns and demand_opportunity_actions for manual supply activation.

alter table public.demand_campaigns
  add column if not exists school_id uuid references public.schools(id) on delete set null,
  add column if not exists isbn text,
  add column if not exists specific_type text,
  add column if not exists size_label text,
  add column if not exists brand text,
  add column if not exists model text,
  add column if not exists families_count integer not null default 0,
  add column if not exists searches_count integer not null default 0,
  add column if not exists supply_count integer not null default 0,
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at timestamptz;

create unique index if not exists demand_campaigns_opportunity_key_uidx
  on public.demand_campaigns (opportunity_key);

create index if not exists demand_campaigns_school_status_idx
  on public.demand_campaigns (school_id, status, last_seen_at desc);

alter table public.demand_opportunity_actions
  add column if not exists target_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists channel text,
  add column if not exists message text,
  add column if not exists sent_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists response text,
  add column if not exists resulting_listing_id uuid references public.listings(id) on delete set null;

create index if not exists demand_opportunity_actions_target_idx
  on public.demand_opportunity_actions (target_user_id, created_at desc)
  where target_user_id is not null;

create index if not exists demand_opportunity_actions_result_listing_idx
  on public.demand_opportunity_actions (resulting_listing_id)
  where resulting_listing_id is not null;

-- Seller activation is server-mediated. Authenticated users do not write action rows directly.
revoke insert, update, delete on table public.demand_opportunity_actions from anon, authenticated;

drop policy if exists "Users can insert own opportunity actions"
  on public.demand_opportunity_actions;


alter table public.saved_search_matches
  add column if not exists notified_at timestamptz;

create index if not exists saved_search_matches_pending_notification_idx
  on public.saved_search_matches (listing_id, notified_at)
  where notified_at is null;
