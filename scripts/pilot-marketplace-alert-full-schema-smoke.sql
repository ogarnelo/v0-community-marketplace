-- Disposable PostgreSQL17 only. Final end-to-end schema smoke after ALL
-- alert SQL fixtures ran, in the same temporary CI database.
-- Read-only: never run state-changing functions here.
begin transaction read only;

do $$
declare n int;
begin
 if to_regclass('public.marketplace_alert_email_intents') is null
    or to_regprocedure('public.marketplace_alert_email_prepare_v1(text,text)') is null
    or to_regprocedure('public.marketplace_alert_email_begin_v1(text,text,uuid)') is null
    or to_regprocedure('public.marketplace_alert_email_accept_v1(text,uuid,text)') is null
    or to_regprocedure('public.marketplace_alert_email_ambiguous_v1(text,uuid)') is null
    or to_regprocedure('public.marketplace_alert_email_intent_health_v1()') is null
 then raise exception 'Incomplete intent migration'; end if;

 if to_regprocedure('public.marketplace_alert_hold_for_review_v1(uuid,uuid)') is null
    or to_regprocedure('public.marketplace_alert_review_count_v1()') is null
 then raise exception 'Incomplete quarantine migration'; end if;

 if to_regprocedure('public.marketplace_alert_reconciliation_health_v1()') is null
    or to_regprocedure('public.marketplace_alert_reconcile_accepted_v1(text,text,text,text)') is null
 then raise exception 'Incomplete manual reconciliation migration'; end if;

 select count(*) into n from pg_indexes where schemaname='public'
   and tablename='marketplace_alert_email_intents'
   and indexname='marketplace_alert_email_intents_provider_receipt_uq'
   and indexdef ilike '%UNIQUE INDEX%'
   and indexdef ilike '%provider_message_id%';
 if n<>1 then raise exception 'Provider message id not uniquely fenced'; end if;

 select count(*) into n
 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
 where ns.nspname='public'
   and p.proname in (
       'marketplace_alert_settle_outbox_v1',
       'marketplace_alert_requeue_progress_v1',
       'marketplace_alert_defer_readiness_v1'
   )
   and regexp_replace(pg_get_functiondef(p.oid),'[[:space:]]+','','g') like '%lease_until>now()%'
   and regexp_replace(pg_get_functiondef(p.oid),'[[:space:]]+','','g') like '%expires_at>now()%';
 if n<>3 then raise exception 'Expired lease fencing incomplete'; end if;

 if has_table_privilege('anon','public.marketplace_alert_email_intents','SELECT')
   or has_table_privilege('authenticated','public.marketplace_alert_email_intents','INSERT')
   or has_function_privilege('anon','public.marketplace_alert_review_count_v1()','EXECUTE')
   or has_function_privilege('authenticated','public.marketplace_alert_reconciliation_health_v1()','EXECUTE')
 then raise exception 'Unauthorized client can inspect or change alert state'; end if;

end $$;

commit;
select 'PASS: all five pending migrations cooperate safely in disposable PostgreSQL17' as result;
