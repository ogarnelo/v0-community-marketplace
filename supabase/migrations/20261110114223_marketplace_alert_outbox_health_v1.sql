-- Read-only, compact outbox health counters for the EXISTING daily
-- email-health cron. No new schedule and no job processing or email sends.
-- This RPC does not expose listing UUIDs or recipient information.
create or replace function public.marketplace_alert_outbox_health_v1()
returns table(
  total bigint,
  pending bigint,
  processing bigint,
  completed bigint,
  failed bigint,
  due bigint,
  overdue_leases bigint,
  expired_unfinished bigint,
  oldest_unfinished_minutes integer,
  max_attempts integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::bigint,
    count(*) filter (where q.state = 'pending')::bigint,
    count(*) filter (where q.state = 'processing')::bigint,
    count(*) filter (where q.state = 'completed')::bigint,
    count(*) filter (where q.state = 'failed')::bigint,
    count(*) filter (
      where q.state = 'pending' and q.next_attempt_at <= now()
        and q.expires_at > now()
    )::bigint,
    count(*) filter (
      where q.state = 'processing' and q.lease_until < now()
        and q.expires_at > now()
    )::bigint,
    count(*) filter (
      where q.state in ('pending','processing') and q.expires_at <= now()
    )::bigint,
    coalesce(
      greatest(0, floor(extract(epoch from (
        now() - min(q.created_at) filter (
          where q.state in ('pending','processing')
        )
      )) / 60))::integer,
      0
    )::integer,
    coalesce(max(q.attempts), 0)::integer
  from public.marketplace_alert_outbox as q;
$$;

revoke all on function public.marketplace_alert_outbox_health_v1()
  from public, anon, authenticated;
grant execute on function public.marketplace_alert_outbox_health_v1()
  to service_role;

notify pgrst, 'reload schema';
