-- Saved search alerts for educational demand signals.
-- Keeps the marketplace lightweight while letting users ask Wetudy to notify them
-- when a missing book/material appears later.

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text,
  isbn_query text,
  category text,
  grade_level text,
  listing_type text,
  condition text,
  only_my_community boolean not null default false,
  school_id uuid references public.schools(id) on delete set null,
  results_count integer not null default 0,
  source_path text not null default '/marketplace',
  notifications_enabled boolean not null default true,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_searches_has_intent check (
    nullif(trim(coalesce(query, '')), '') is not null
    or nullif(trim(coalesce(isbn_query, '')), '') is not null
    or nullif(trim(coalesce(category, '')), '') is not null
    or nullif(trim(coalesce(grade_level, '')), '') is not null
  )
);

create index if not exists saved_searches_user_created_idx
  on public.saved_searches(user_id, created_at desc);

create index if not exists saved_searches_school_created_idx
  on public.saved_searches(school_id, created_at desc)
  where school_id is not null;

create index if not exists saved_searches_category_grade_idx
  on public.saved_searches(category, grade_level, created_at desc);

alter table public.saved_searches enable row level security;

create policy if not exists saved_searches_select_own
  on public.saved_searches
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy if not exists saved_searches_insert_own
  on public.saved_searches
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy if not exists saved_searches_update_own
  on public.saved_searches
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists saved_searches_delete_own
  on public.saved_searches
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy if not exists saved_searches_admin_read
  on public.saved_searches
  for select
  to authenticated
  using (public.is_superadmin());

create or replace view public.saved_search_demand_summary as
select
  coalesce(nullif(category, ''), 'Sin categoría') as category,
  coalesce(nullif(grade_level, ''), 'Sin curso') as grade_level,
  coalesce(nullif(isbn_query, ''), 'Sin ISBN') as isbn_query,
  count(*)::integer as saved_count,
  count(*) filter (where results_count = 0)::integer as zero_result_saved_count,
  max(created_at) as last_saved_at
from public.saved_searches
where notifications_enabled = true
group by 1, 2, 3;

grant select on public.saved_search_demand_summary to authenticated;
