-- A durable keyset cursor for the OUTBOX WORKER ONLY.
-- A page of saved searches is fully evaluated and its matches committed
-- before the cursor advances. Browser-originated matching is unchanged.
-- No email is sent and the worker stays feature-flagged OFF.
alter table public.marketplace_alert_outbox
  add column if not exists discovery_cursor uuid,
  add column if not exists discovery_completed_at timestamptz;

-- Strict fencing, monotonic pagination and atomic completion marker.
-- A failed RPC must never advance a cursor or mark a scan as complete.
create or replace function public.marketplace_alert_advance_discovery_v1(
  p_listing_id uuid,
  p_lease_token uuid,
  p_expected_cursor uuid,
  p_next_cursor uuid,
  p_complete boolean
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer;
begin
  if p_complete is null then return false; end if;
  if p_next_cursor is not null
     and p_expected_cursor is not null
     and p_next_cursor <= p_expected_cursor then
    return false;
  end if;
  if not p_complete and p_next_cursor is null then
    return false;
  end if;
  update public.marketplace_alert_outbox as q
  set discovery_cursor = coalesce(p_next_cursor, q.discovery_cursor),
      discovery_completed_at = case when p_complete then now()
        else q.discovery_completed_at end
  where q.listing_id = p_listing_id
    and q.state = 'processing'
    and q.lease_token = p_lease_token
    and q.lease_until > now()
    and q.expires_at > now()
    and q.discovery_cursor is not distinct from p_expected_cursor
    and q.discovery_completed_at is null;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.marketplace_alert_advance_discovery_v1(uuid,uuid,uuid,uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.marketplace_alert_advance_discovery_v1(uuid,uuid,uuid,uuid,boolean)
  to service_role;

notify pgrst, 'reload schema';
