-- Allow a second, PII-free terminal invalidation reason when a directory
-- school↔operational community mapping changes after match discovery.
-- No existing matches are modified; worker stays disabled for pilot QA.
alter table public.saved_search_matches
  drop constraint if exists saved_search_matches_invalidation_reason_v1_chk;

alter table public.saved_search_matches
  add constraint saved_search_matches_invalidation_reason_v2_chk
  check (
    invalidation_reason is null
    or invalidation_reason in ('radius_changed', 'school_link_changed')
  );

-- Existing RLS and owner policies are not changed. The service role alone
-- may update technical invalidation markers while reconciling alerts.
