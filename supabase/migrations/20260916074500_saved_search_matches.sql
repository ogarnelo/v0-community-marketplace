create table if not exists public.saved_search_matches (
  id uuid primary key default gen_random_uuid(),
  saved_search_id uuid not null references public.saved_searches(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  matched_at timestamptz not null default now(),
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(saved_search_id, listing_id)
);

alter table public.saved_search_matches enable row level security;

drop policy if exists "saved_search_matches_select_own" on public.saved_search_matches;
create policy "saved_search_matches_select_own"
  on public.saved_search_matches
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "saved_search_matches_delete_own" on public.saved_search_matches;
create policy "saved_search_matches_delete_own"
  on public.saved_search_matches
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Server-side jobs use the Supabase service role, which bypasses RLS.
-- No service_role policy is needed here.
drop policy if exists "saved_search_matches_service_manage" on public.saved_search_matches;

create index if not exists saved_search_matches_user_created_idx
  on public.saved_search_matches(user_id, created_at desc);

create index if not exists saved_search_matches_listing_idx
  on public.saved_search_matches(listing_id);
