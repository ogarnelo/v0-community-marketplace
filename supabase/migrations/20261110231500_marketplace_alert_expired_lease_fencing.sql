-- Safety hardening: only a CURRENT unexpired lease may settle, requeue or defer.
-- Existing signatures remain unchanged. No activation, cron, or email sends.
create or replace function public.marketplace_alert_settle_outbox_v1(
  p_listing_id uuid,
  p_lease_token uuid,
  p_success boolean,
  p_error_code text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.marketplace_alert_outbox as q
  set state = case
        when p_success then 'completed'
        when q.attempts >= 4 or q.expires_at <= now() then 'failed'
        else 'pending'
      end,
      next_attempt_at = case when p_success then q.next_attempt_at
        else now() + case
          when q.attempts <= 1 then interval '2 minutes'
          when q.attempts = 2 then interval '5 minutes'
          else interval '15 minutes'
        end
      end,
      completed_at = case when p_success then now() else null end,
      last_error_code = case when p_success then null
        else left(regexp_replace(coalesce(p_error_code, 'unknown'), '[^a-z0-9_-]', '', 'g'), 64)
      end,
      lease_token = null,
      lease_until = null
  where q.listing_id = p_listing_id
    and q.state = 'processing'
    and q.lease_token = p_lease_token
      and q.lease_until > now()
      and q.expires_at > now();
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

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
      and q.lease_until > now()
      and q.expires_at>now()
    returning q.listing_id
  )
  select exists(select 1 from updated);
$$;

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
      and q.lease_until > now()
      and q.expires_at > now()
    returning q.listing_id
  )
  select exists(select 1 from updated);
$$;

revoke all on function public.marketplace_alert_settle_outbox_v1(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.marketplace_alert_settle_outbox_v1(uuid,uuid,boolean,text) to service_role;
revoke all on function public.marketplace_alert_requeue_progress_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.marketplace_alert_requeue_progress_v1(uuid,uuid) to service_role;
revoke all on function public.marketplace_alert_defer_readiness_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.marketplace_alert_defer_readiness_v1(uuid,uuid) to service_role;
notify pgrst, 'reload schema';
