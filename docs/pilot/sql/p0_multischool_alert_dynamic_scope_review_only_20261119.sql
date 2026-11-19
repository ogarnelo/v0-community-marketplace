-- REVIEW ONLY — do not apply without a separate, explicit Supabase DDL authorization.
-- One saved search can follow ALL CURRENT authorized family schools without
-- creating N subscriptions. No historical search, match, or delivery is touched.
-- All dynamic scopes are resolved again in the signed worker from account_students
-- and verified schools/directory; a client cannot grant itself new school access.
ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS community_scope_mode text NOT NULL DEFAULT 'single';

ALTER TABLE public.saved_searches
  ADD CONSTRAINT saved_searches_community_scope_mode_chk
  CHECK (
    community_scope_mode = 'single'
    OR (
      community_scope_mode = 'active_family'
      AND only_my_community IS TRUE
      AND school_id IS NULL
      AND directory_school_code IS NULL
    )
  ) NOT VALID;

ALTER TABLE public.saved_searches
  VALIDATE CONSTRAINT saved_searches_community_scope_mode_chk;

-- No GRANT/REVOKE, no new RLS policy, no table recreation and no data changes.
-- Existing RLS remains owner-bound. No direct client request is trusted as an
-- assertion of membership: both discovery and delivery re-authorize live.
