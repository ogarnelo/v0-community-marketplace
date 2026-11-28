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
DROP TABLE wetudy_internal.automatic_supply_control;
COMMIT;
