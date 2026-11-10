-- Protect a family's chosen distance if their PROFILE postcode changes
-- between matching a listing and recovering notification/email delivery.
-- This only records a technical skip for existing matched pairs. The worker
-- remains disabled until pilot QA, and no existing rows are rewritten.
alter table public.saved_search_matches
  add column if not exists invalidated_at timestamptz,
  add column if not exists invalidation_reason text;

-- Reasons are fixed internal values, not locations, user inputs or PII.
alter table public.saved_search_matches
  add constraint saved_search_matches_invalidation_reason_v1_chk
  check (invalidation_reason is null or invalidation_reason in ('radius_changed'));

-- Existing RLS/ownership policies remain unchanged; public access is NOT
-- granted. The service role performs the invalidation before attempting
-- either notification channel.
