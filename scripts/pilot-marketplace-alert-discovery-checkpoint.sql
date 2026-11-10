-- Disposable PostgreSQL17 fixture: only run AFTER the other alert outbox
-- fixtures, in the GitHub Actions local-only service. NO production writes.
\i supabase/migrations/20261110155518_marketplace_alert_discovery_checkpoint_v1.sql

do $$
begin
  if has_function_privilege('anon',
       'public.marketplace_alert_advance_discovery_v1(uuid,uuid,uuid,uuid,boolean)', 'execute')
     or has_function_privilege('authenticated',
       'public.marketplace_alert_advance_discovery_v1(uuid,uuid,uuid,uuid,boolean)', 'execute')
     or not has_function_privilege('service_role',
       'public.marketplace_alert_advance_discovery_v1(uuid,uuid,uuid,uuid,boolean)', 'execute')
  then raise exception 'Discovery RPC exposed to browser roles'; end if;
end $$;

insert into public.listings(id,seller_id,status,is_demo)
values('00000000-0000-4000-8000-000000000011',
       '10000000-0000-4000-8000-000000000001','available',false);

do $$
declare
  id uuid := '00000000-0000-4000-8000-000000000011';
  token uuid := gen_random_uuid();
  oldtoken uuid := gen_random_uuid();
  cursor1 uuid := '00000000-0000-4000-8000-000000000020';
  cursor2 uuid := '00000000-0000-4000-8000-000000000040';
begin
  update public.marketplace_alert_outbox
  set state='processing', attempts=1,lease_token=token,
      lease_until=now()+interval '3 minutes'
  where listing_id=id;

  if public.marketplace_alert_advance_discovery_v1(id,oldtoken,null,cursor1,false) then
    raise exception 'Wrong lease advanced discovery';
  end if;
  if public.marketplace_alert_advance_discovery_v1(id,token,null,null,false) then
    raise exception 'Non-final empty cursor advanced discovery';
  end if;
  if not public.marketplace_alert_advance_discovery_v1(id,token,null,cursor1,false) then
    raise exception 'First discovery page failed';
  end if;
  if public.marketplace_alert_advance_discovery_v1(id,token,null,cursor2,false) then
    raise exception 'Stale expected cursor was accepted';
  end if;
  if public.marketplace_alert_advance_discovery_v1(id,token,cursor1,cursor1,false) then
    raise exception 'Non-monotonic cursor accepted';
  end if;
  if not public.marketplace_alert_advance_discovery_v1(id,token,cursor1,cursor2,false) then
    raise exception 'Second discovery page failed';
  end if;
  if (select discovery_cursor from public.marketplace_alert_outbox where listing_id=id) <> cursor2 then
    raise exception 'Discovery cursor not durably persisted';
  end if;

  -- Emulate server interruption: current lease expires, another worker claims
  -- the same listing. The old token must fail and the new token can continue.
  update public.marketplace_alert_outbox set lease_until=now()-interval '1 minute'
   where listing_id=id;
  if public.marketplace_alert_advance_discovery_v1(id,token,cursor2,null,true) then
    raise exception 'Expired worker completed discovery';
  end if;
  update public.marketplace_alert_outbox set lease_token=oldtoken,
      lease_until=now()+interval '3 minutes',attempts=2
    where listing_id=id;
  if public.marketplace_alert_advance_discovery_v1(id,token,cursor2,null,true) then
    raise exception 'Reclaimed lease accepted obsolete worker token';
  end if;
  if not public.marketplace_alert_advance_discovery_v1(id,oldtoken,cursor2,null,true) then
    raise exception 'Second worker could not complete from persisted cursor';
  end if;
  if (select discovery_completed_at from public.marketplace_alert_outbox
      where listing_id=id) is null then
    raise exception 'Completed scan not persisted';
  end if;
  if public.marketplace_alert_advance_discovery_v1(id,oldtoken,cursor2,cursor2,true) then
    raise exception 'Completed discovery was modified again';
  end if;
end $$;

-- Listing past absolute TTL cannot be marked complete by any worker.
insert into public.listings(id,seller_id,status,is_demo)
values('00000000-0000-4000-8000-000000000012',
       '10000000-0000-4000-8000-000000000001','available',false);
do $$
declare
  id uuid := '00000000-0000-4000-8000-000000000012';
  token uuid := gen_random_uuid();
begin
  update public.marketplace_alert_outbox
  set state='processing',lease_token=token,
      lease_until=now()+interval '3 minutes',
      expires_at=now()-interval '1 minute'
  where listing_id=id;
  if public.marketplace_alert_advance_discovery_v1(id,token,null,null,true) then
    raise exception 'Expired listing discovery was incorrectly completed';
  end if;
end $$;

select 'PASS: fenced discovery cursor, monotonic progress, recovery, 48-hour TTL, RLS privileges' as result;
