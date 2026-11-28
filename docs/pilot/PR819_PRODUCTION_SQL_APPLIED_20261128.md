# #819 — SQL aplicado en WETUDY, 2026-11-28

Proyecto jpsljmakoscqevssimtk. Autorización expresa del propietario. Código 70124ee desplegado en www.wetudy.com, READY dpl_27gMwMjQiuVmyBVQkdB11qTgdnVf. El SQL aplicado se conserva íntegro abajo; única adaptación respecto al candidato probado: esquema privado dedicado wetudy_automation, sin ampliar USAGE del esquema wetudy_internal. Verificación: enabled=false, service_role USAGE nuevo=true y anterior=false, anon/auth USAGE nuevo=false y EXECUTE toggle=false, RPC lectura y dispatch pausado devuelven false bajo service_role, cero notificaciones. No ejecutar de nuevo. Rollback adaptado abajo, requiere pausa y retirada de flag antes de ejecutar; conserva historial. La variante de esquema fue comprobada en producción en pausa, no se ha ejecutado rollback en producción. Gate WETUDY_AUTOMATIC_SUPPLY_ENABLED pendiente, no autorizado activar todavía. Piloto NO-GO.

## SQL aplicado (evidencia, no ejecutar)

```sql
-- REVIEW ONLY; never run in production without specific authorization and verified rollback.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
CREATE SCHEMA wetudy_automation;
REVOKE ALL ON SCHEMA wetudy_automation FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA wetudy_automation TO service_role;
CREATE TABLE wetudy_automation.automatic_supply_control (
 id integer PRIMARY KEY CHECK(id=1), enabled boolean NOT NULL DEFAULT false,
 changed_at timestamptz NOT NULL DEFAULT now(), changed_by uuid
);
ALTER TABLE wetudy_automation.automatic_supply_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wetudy_automation.automatic_supply_control FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON wetudy_automation.automatic_supply_control TO service_role;
CREATE POLICY automatic_supply_service_only ON wetudy_automation.automatic_supply_control FOR ALL TO service_role USING(true) WITH CHECK(true);
INSERT INTO wetudy_automation.automatic_supply_control(id) VALUES(1);
CREATE FUNCTION public.automatic_supply_enabled_v1() RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce((SELECT enabled FROM wetudy_automation.automatic_supply_control WHERE id=1),false)
$$;
CREATE FUNCTION public.set_automatic_supply_enabled_v1(p_actor uuid,p_enabled boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_actor IS NULL OR p_enabled IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='super_admin') THEN
 RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
 UPDATE wetudy_automation.automatic_supply_control SET enabled=p_enabled,changed_at=clock_timestamp(),changed_by=p_actor WHERE id=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'control missing'; END IF;
 RETURN p_enabled;
END $$;
REVOKE ALL ON FUNCTION public.automatic_supply_enabled_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_automatic_supply_enabled_v1(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.automatic_supply_enabled_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_automatic_supply_enabled_v1(uuid,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.activate_supply_recipient_v2(
 p_actor uuid,p_target uuid,p_campaign jsonb,p_message text,p_href text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.demand_campaigns%ROWTYPE; a uuid; consent boolean; t timestamptz; k text; auto_enabled boolean;
BEGIN
 IF p_actor IS NULL THEN
  -- The singleton row serializes automatic sends, quota checks and pause.
  SELECT enabled INTO auto_enabled FROM wetudy_automation.automatic_supply_control WHERE id=1 FOR UPDATE;
  IF auto_enabled IS DISTINCT FROM true THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.demand_opportunity_actions WHERE action_type='seller_contacted'
      AND actor_id IS NULL AND role_context='system' AND sent_at>=clock_timestamp()-interval '24 hours')>=20 THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.demand_opportunity_actions WHERE action_type='seller_contacted'
      AND target_user_id=p_target AND sent_at>=clock_timestamp()-interval '7 days') THEN RETURN false; END IF;
 ELSIF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='super_admin') THEN
  RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
 END IF;
 c:=jsonb_populate_record(NULL::public.demand_campaigns,p_campaign);
 k:=c.opportunity_key;
 IF k IS NULL OR k='' OR p_target IS NULL OR p_actor=p_target OR c.families_count IS NULL OR c.supply_count IS NULL OR c.supply_count>=greatest(1,c.families_count) THEN RETURN false; END IF;
 IF p_actor IS NULL THEN
  IF NOT EXISTS (
    SELECT 1 FROM public.demand_requests d WHERE d.status='open' AND
       coalesce(c.metadata->'source_ids','[]'::jsonb) ? d.id::text
    UNION ALL
    SELECT 1 FROM public.saved_searches s WHERE s.notifications_enabled=true AND s.results_count=0
       AND s.intent_source='zero_results_prompt' AND coalesce(c.metadata->'source_ids','[]'::jsonb) ? s.id::text
  ) THEN RETURN false; END IF;
 END IF;
 -- A concurrent UPDATE/UPSERT revocation must acquire this same row lock.
 SELECT supply_outreach_opt_in INTO consent FROM public.user_marketplace_preferences
 WHERE user_id=p_target FOR UPDATE;
 IF consent IS DISTINCT FROM true THEN RETURN false; END IF;
 t:=clock_timestamp();
 IF EXISTS(SELECT 1 FROM public.demand_opportunity_actions
 WHERE opportunity_key=k AND target_user_id=p_target AND action_type='seller_contacted'
 AND sent_at>=t-interval '30 days') THEN RETURN false; END IF;
 -- Serialize against explicit campaign closure; never reopen a closed campaign.
 INSERT INTO public.demand_campaigns(title,opportunity_key,school_id,category,grade_level,isbn,specific_type,size_label,brand,model,families_count,searches_count,supply_count,first_seen_at,last_seen_at,priority,status,recommended_action,metadata,created_by,updated_at)
 VALUES(c.title,k,c.school_id,c.category,c.grade_level,c.isbn,c.specific_type,c.size_label,c.brand,c.model,c.families_count,c.searches_count,c.supply_count,c.first_seen_at,c.last_seen_at,c.priority,'sellers_contacted',CASE WHEN p_actor IS NULL THEN 'Activación automática in-app' ELSE 'Activación manual in-app' END,coalesce(c.metadata,'{}'),p_actor,t)
 ON CONFLICT(opportunity_key) DO UPDATE SET status='sellers_contacted',updated_at=t
 WHERE demand_campaigns.status NOT IN ('satisfied','closed')
 AND demand_campaigns.supply_count<greatest(1,demand_campaigns.families_count)
 RETURNING id INTO a;
 IF a IS NULL THEN RETURN false; END IF;
 INSERT INTO public.demand_opportunity_actions(opportunity_key,actor_id,target_user_id,action_type,role_context,channel,message,sent_at,metadata)
 VALUES(k,p_actor,p_target,'seller_contacted',CASE WHEN p_actor IS NULL THEN 'system' ELSE 'super_admin' END,'in_app',p_message,t,coalesce(c.metadata,'{}')) RETURNING id INTO a;
 INSERT INTO public.notifications(user_id,kind,title,body,href,metadata,event_key)
 VALUES(p_target,'supply_activation','Hay familias buscando material que quizá tengas',p_message,p_href,
 jsonb_build_object('opportunity_key',k,'category',c.category,'school_id',c.school_id),'supply-activation-v2:'||a::text);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.activate_supply_recipient_v2(uuid,uuid,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_supply_recipient_v2(uuid,uuid,jsonb,text,text) TO service_role;
COMMIT;
```

## Reversión adaptada (solo con autorización)

```sql
-- REVIEW ONLY: pause worker and remove activation flag before executing. Preserve all history.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
CREATE OR REPLACE FUNCTION public.activate_supply_recipient_v2(
 p_actor uuid,p_target uuid,p_campaign jsonb,p_message text,p_href text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.demand_campaigns%ROWTYPE; a uuid; consent boolean; t timestamptz; k text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='super_admin') THEN
  RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
 END IF;
 c:=jsonb_populate_record(NULL::public.demand_campaigns,p_campaign);
 k:=c.opportunity_key;
 IF k IS NULL OR k='' OR p_target IS NULL OR p_actor=p_target OR c.families_count IS NULL OR c.supply_count IS NULL OR c.supply_count>=greatest(1,c.families_count) THEN RETURN false; END IF;
 -- A concurrent UPDATE/UPSERT revocation must acquire this same row lock.
 SELECT supply_outreach_opt_in INTO consent FROM public.user_marketplace_preferences
 WHERE user_id=p_target FOR UPDATE;
 IF consent IS DISTINCT FROM true THEN RETURN false; END IF;
 t:=clock_timestamp();
 IF EXISTS(SELECT 1 FROM public.demand_opportunity_actions
 WHERE opportunity_key=k AND target_user_id=p_target AND action_type='seller_contacted'
 AND sent_at>=t-interval '30 days') THEN RETURN false; END IF;
 -- Serialize against explicit campaign closure; never reopen a closed campaign.
 INSERT INTO public.demand_campaigns(title,opportunity_key,school_id,category,grade_level,isbn,specific_type,size_label,brand,model,families_count,searches_count,supply_count,first_seen_at,last_seen_at,priority,status,recommended_action,metadata,created_by,updated_at)
 VALUES(c.title,k,c.school_id,c.category,c.grade_level,c.isbn,c.specific_type,c.size_label,c.brand,c.model,c.families_count,c.searches_count,c.supply_count,c.first_seen_at,c.last_seen_at,c.priority,'sellers_contacted','Activación manual in-app',coalesce(c.metadata,'{}'),p_actor,t)
 ON CONFLICT(opportunity_key) DO UPDATE SET status='sellers_contacted',updated_at=t
 WHERE demand_campaigns.status NOT IN ('satisfied','closed')
 AND demand_campaigns.supply_count<greatest(1,demand_campaigns.families_count)
 RETURNING id INTO a;
 IF a IS NULL THEN RETURN false; END IF;
 INSERT INTO public.demand_opportunity_actions(opportunity_key,actor_id,target_user_id,action_type,role_context,channel,message,sent_at,metadata)
 VALUES(k,p_actor,p_target,'seller_contacted','super_admin','in_app',p_message,t,coalesce(c.metadata,'{}')) RETURNING id INTO a;
 INSERT INTO public.notifications(user_id,kind,title,body,href,metadata,event_key)
 VALUES(p_target,'supply_activation','Hay familias buscando material que quizá tengas',p_message,p_href,
 jsonb_build_object('opportunity_key',k,'category',c.category,'school_id',c.school_id),'supply-activation-v2:'||a::text);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.activate_supply_recipient_v2(uuid,uuid,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_supply_recipient_v2(uuid,uuid,jsonb,text,text) TO service_role;
DROP FUNCTION public.set_automatic_supply_enabled_v1(uuid,boolean);
DROP FUNCTION public.automatic_supply_enabled_v1();
DROP TABLE wetudy_automation.automatic_supply_control;
DROP SCHEMA wetudy_automation RESTRICT;
COMMIT;
```
