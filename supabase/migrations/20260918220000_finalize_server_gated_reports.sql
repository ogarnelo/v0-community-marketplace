-- Keep moderation report creation behind the validated server endpoint.
-- This is an idempotent drift guard for environments where an older policy
-- or table grant survived after the server-gated report rollout.

drop policy if exists reports_insert_authenticated on public.reports;

revoke insert, delete, truncate, references, trigger
  on public.reports from anon, authenticated;

revoke select, update
  on public.reports from anon;
