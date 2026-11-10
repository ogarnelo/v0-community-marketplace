-- A listing may be inserted before its photos are uploaded.
-- Waiting for photos is normal publishing progress, not a failed email attempt.
-- Defer with a fenced lease and a bounded 5-minute retry; preserve the 48h TTL.
-- Only service_role may invoke this function. It does not send any email.
create or replace function public.marketplace_alert_defer_readiness_v1(
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
    set state = 'pending',
        attempts = greatest(0, q.attempts - 1),
        next_attempt_at = now() + interval '5 minutes',
        lease_token = null,
        lease_until = null,
        last_error_code = null
    where q.listing_id = p_listing_id
      and q.state = 'processing'
      and q.lease_token = p_lease_token
      and q.expires_at > now()
    returning q.listing_id
  )
  select exists(select 1 from updated);
$$;

revoke all on function public.marketplace_alert_defer_readiness_v1(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.marketplace_alert_defer_readiness_v1(uuid,uuid)
  to service_role;

notify pgrst, 'reload schema';
