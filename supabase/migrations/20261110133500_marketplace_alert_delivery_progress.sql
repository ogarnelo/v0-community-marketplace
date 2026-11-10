-- Per-recipient email outcomes and bounded worker continuation.
-- The outbox worker remains OFF and without a schedule until QA.
-- Existing notifications, email delivery rows, DEMO and centres unchanged.

-- A suppressed recipient is intentionally NOT "emailed". Track that as a
-- terminal skip so retries don't query the same address indefinitely.
alter table public.saved_search_matches
  add column if not exists email_skipped_at timestamptz;

alter table public.saved_search_matches
  add column if not exists email_skip_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.saved_search_matches'::regclass
      and conname='saved_search_matches_email_skip_reason_chk'
  ) then
    alter table public.saved_search_matches
      add constraint saved_search_matches_email_skip_reason_chk
      check (email_skip_reason is null or email_skip_reason in (
        'suppressed','recipient_missing'
      ));
  end if;
end $$;

-- If the worker processed a bounded number of notifications successfully
-- but more recipients remain, release its existing lease without consuming
-- the four *failure* attempts. The next invocation resumes from persisted
-- notified_at/emailed_at/email_skipped_at markers, using the same event keys.
-- A stale token, expired job or already settled job can NEVER be released.
create or replace function public.marketplace_alert_requeue_progress_v1(
  p_listing_id uuid,
  p_lease_token uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with updated as (
    update public.marketplace_alert_outbox as q
    set state='pending',
        attempts=0,
        next_attempt_at=now()+interval '15 seconds',
        lease_token=null,
        lease_until=null,
        last_error_code=null
    where q.listing_id=p_listing_id
      and q.state='processing'
      and q.lease_token=p_lease_token
      and q.expires_at>now()
    returning q.listing_id
  )
  select exists(select 1 from updated);
$$;

revoke all on function public.marketplace_alert_requeue_progress_v1(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.marketplace_alert_requeue_progress_v1(uuid,uuid)
  to service_role;

notify pgrst, 'reload schema';
