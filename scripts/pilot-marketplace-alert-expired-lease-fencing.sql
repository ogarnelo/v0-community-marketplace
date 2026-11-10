-- ONLY disposable PostgreSQL17 GitHub CI database. Never run in production.
\i supabase/migrations/20261110231500_marketplace_alert_expired_lease_fencing.sql

insert into public.listings(id,seller_id,status,is_demo) values
 ('91000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','available',false),
 ('91000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','available',false),
 ('91000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','available',false);

do $$
declare
 ids uuid[]:=array[
 '91000000-0000-4000-8000-000000000001'::uuid,
 '91000000-0000-4000-8000-000000000002'::uuid,
 '91000000-0000-4000-8000-000000000003'::uuid];
 tokens uuid[];
 current_token uuid;
 idx int;
begin
  for idx in 1..3 loop
    update public.marketplace_alert_outbox set state='processing',
      lease_token=gen_random_uuid(),lease_until=now()-interval '5 seconds',
      expires_at=now()+interval '1 hour',attempts=1
    where listing_id=ids[idx];
    select lease_token into current_token from public.marketplace_alert_outbox
      where listing_id=ids[idx];
    if idx=1 then
      if public.marketplace_alert_settle_outbox_v1(ids[idx],current_token,true) then
        raise exception 'Expired lease settled job';
      end if;
    elsif idx=2 then
      if public.marketplace_alert_requeue_progress_v1(ids[idx],current_token) then
        raise exception 'Expired lease requeued progress';
      end if;
    else
      if public.marketplace_alert_defer_readiness_v1(ids[idx],current_token) then
        raise exception 'Expired lease deferred photo readiness';
      end if;
    end if;
    if (select state from public.marketplace_alert_outbox where listing_id=ids[idx]) <> 'processing' then
      raise exception 'Expired lease changed job';
    end if;

    update public.marketplace_alert_outbox set lease_until=now()+interval '90 seconds'
      where listing_id=ids[idx];
    if idx=1 then
      if not public.marketplace_alert_settle_outbox_v1(ids[idx],current_token,true) then
        raise exception 'Valid lease could not settle';
      end if;
    elsif idx=2 then
      if not public.marketplace_alert_requeue_progress_v1(ids[idx],current_token) then
        raise exception 'Valid lease could not requeue progress';
      end if;
    else
      if not public.marketplace_alert_defer_readiness_v1(ids[idx],current_token) then
        raise exception 'Valid lease could not defer readiness';
      end if;
    end if;
  end loop;
end $$;

do $$
declare
 id uuid:='91000000-0000-4000-8000-000000000001';
 token uuid;
begin
 update public.marketplace_alert_outbox
 set state='processing',lease_token=gen_random_uuid(),
   lease_until=now()+interval '1 hour',expires_at=now()-interval '1 second'
 where listing_id=id;
 select lease_token into token from public.marketplace_alert_outbox where listing_id=id;
 if public.marketplace_alert_settle_outbox_v1(id,token,true) then
   raise exception 'Expired TTL settled despite live lease';
 end if;
 if has_function_privilege('anon','public.marketplace_alert_settle_outbox_v1(uuid,uuid,boolean,text)','EXECUTE')
    or has_function_privilege('authenticated','public.marketplace_alert_requeue_progress_v1(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.marketplace_alert_defer_readiness_v1(uuid,uuid)','EXECUTE') then
   raise exception 'Unsafe public RPC grant';
 end if;
end $$;

select 'PASS: settle/requeue/defer reject expired leases and TTL, keep valid operations working' as result;
