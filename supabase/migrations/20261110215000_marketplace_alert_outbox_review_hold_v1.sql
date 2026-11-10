-- Pilot-only quarantine for ambiguous provider results. Requires the
-- previously deployed outbox table. No cron, email, or user data changes.
alter table public.marketplace_alert_outbox
  drop constraint if exists marketplace_alert_outbox_state_check;
alter table public.marketplace_alert_outbox
  add constraint marketplace_alert_outbox_state_check
  check (state in ('pending','processing','completed','failed','review_required'));

-- Only the currently leased worker may quarantine its own listing. Once
-- review_required, the existing claim RPC (pending/processing only) will not
-- claim this listing again, even after 24h, 48h, or worker restart.
create or replace function public.marketplace_alert_hold_for_review_v1(
  p_listing_id uuid, p_lease_token uuid
) returns boolean
language sql security invoker set search_path = ''
as $$
  with held as (
    update public.marketplace_alert_outbox as q
       set state='review_required',
           last_error_code='email_outcome_ambiguous',
           lease_token=null,
           lease_until=null,
           next_attempt_at=q.next_attempt_at
     where q.listing_id=p_listing_id
       and q.state='processing'
       and q.lease_token=p_lease_token
       and q.lease_until>now()
       and q.expires_at>now()
    returning 1
  )
  select exists(select 1 from held);
$$;
revoke all on function public.marketplace_alert_hold_for_review_v1(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.marketplace_alert_hold_for_review_v1(uuid,uuid)
  to service_role;

-- This view-like function discloses aggregate counts only to service_role.
-- The pending review count must not reveal recipient event keys or postcodes.
create or replace function public.marketplace_alert_review_count_v1()
returns bigint language sql security invoker set search_path = ''
as $$
  select count(*)::bigint from public.marketplace_alert_outbox
  where state='review_required';
$$;
revoke all on function public.marketplace_alert_review_count_v1()
  from public, anon, authenticated;
grant execute on function public.marketplace_alert_review_count_v1()
  to service_role;
notify pgrst,'reload schema';
