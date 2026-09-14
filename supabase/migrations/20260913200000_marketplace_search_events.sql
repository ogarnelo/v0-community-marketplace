create table if not exists public.marketplace_search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  query text,
  isbn_query text,
  category text,
  grade_level text,
  listing_type text,
  condition text,
  price_min numeric,
  price_max numeric,
  only_my_community boolean not null default false,
  nearby_mode boolean not null default false,
  radius_km numeric,
  results_count integer,
  source_path text not null default '/marketplace',
  created_at timestamptz not null default now()
);

comment on table public.marketplace_search_events is
  'Demand intelligence events generated from marketplace searches and filter usage.';

create index if not exists marketplace_search_events_created_at_idx
  on public.marketplace_search_events (created_at desc);

create index if not exists marketplace_search_events_school_id_idx
  on public.marketplace_search_events (school_id);

create index if not exists marketplace_search_events_category_idx
  on public.marketplace_search_events (category);

alter table public.marketplace_search_events enable row level security;

drop policy if exists marketplace_search_events_admin_read on public.marketplace_search_events;
create policy marketplace_search_events_admin_read
  on public.marketplace_search_events
  for select
  to authenticated
  using (public.is_superadmin());

create or replace view public.marketplace_demand_summary as
select
  coalesce(nullif(category, ''), 'Sin categoría') as category,
  coalesce(nullif(grade_level, ''), 'Sin curso') as grade_level,
  count(*)::integer as searches_count,
  count(*) filter (where coalesce(results_count, 0) = 0)::integer as zero_result_searches,
  max(created_at) as last_seen_at
from public.marketplace_search_events
group by 1, 2;
