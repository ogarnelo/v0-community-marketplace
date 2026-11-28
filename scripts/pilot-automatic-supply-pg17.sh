#!/usr/bin/env bash
set -euo pipefail
# Local synthetic PostgreSQL only; never accept a remote connection.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=wetudy_synthetic_pg17 PGCONNECT_TIMEOUT=5
unset PGDATABASE PGSERVICE PGSERVICEFILE PGOPTIONS
db=wetudy_automatic_supply_synthetic
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
createdb "$db"
q(){ psql -XAt -v ON_ERROR_STOP=1 -d "$db" "$@"; }
q <<'SQL'
CREATE TABLE public.user_roles(user_id uuid,role text);
CREATE TABLE public.user_marketplace_preferences(user_id uuid PRIMARY KEY,supply_outreach_opt_in boolean NOT NULL DEFAULT false);
CREATE TABLE public.demand_campaigns(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,opportunity_key text UNIQUE NOT NULL,school_id uuid,category text,grade_level text,isbn text,specific_type text,size_label text,brand text,model text,families_count integer NOT NULL,searches_count integer NOT NULL,supply_count integer NOT NULL,first_seen_at timestamptz,last_seen_at timestamptz,priority text NOT NULL,status text NOT NULL,recommended_action text,metadata jsonb,created_by uuid,updated_at timestamptz);
CREATE TABLE public.demand_opportunity_actions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),opportunity_key text,target_user_id uuid,actor_id uuid,action_type text,role_context text,channel text,message text,sent_at timestamptz,metadata jsonb);
CREATE UNIQUE INDEX demand_outreach_recipient_once_idx ON public.demand_opportunity_actions(opportunity_key,target_user_id) WHERE action_type='seller_contacted' AND target_user_id IS NOT NULL;
CREATE TABLE public.notifications(user_id uuid,kind text,title text,body text,href text,metadata jsonb,event_key text UNIQUE);
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
INSERT INTO user_roles VALUES('11111111-1111-4111-8111-111111111111','super_admin');
INSERT INTO user_marketplace_preferences VALUES('22222222-2222-4222-8222-222222222222',true);
SQL
q -f scripts/review_only/p816_atomic_supply_outreach_v2_candidate.sql
q <<'SQL'
CREATE SCHEMA wetudy_internal;
GRANT USAGE ON SCHEMA wetudy_internal TO service_role;
CREATE TABLE public.demand_requests(id uuid PRIMARY KEY,status text);
CREATE TABLE public.saved_searches(id uuid PRIMARY KEY,notifications_enabled boolean,results_count integer,intent_source text);
GRANT SELECT ON public.demand_requests,public.saved_searches TO service_role;
INSERT INTO demand_requests VALUES('33333333-3333-4333-8333-333333333333','open');
SQL
q -f scripts/review_only/p819_automatic_supply_control_candidate.sql
q <<'SQL'
SET ROLE service_role;
DO $$
DECLARE actor uuid:='11111111-1111-4111-8111-111111111111'; target uuid:='22222222-2222-4222-8222-222222222222';
c jsonb:='{"opportunity_key":"qa","title":"QA","families_count":3,"supply_count":0,"searches_count":3,"priority":"medium","metadata":{"source_ids":["33333333-3333-4333-8333-333333333333"]}}';
BEGIN
 IF automatic_supply_enabled_v1() OR activate_supply_recipient_v2(NULL,target,c,'QA','/qa') THEN RAISE EXCEPTION 'default not paused'; END IF;
 IF NOT set_automatic_supply_enabled_v1(actor,true) THEN RAISE EXCEPTION 'enable failed'; END IF;
 IF NOT activate_supply_recipient_v2(NULL,target,c,'QA','/qa') THEN RAISE EXCEPTION 'send failed'; END IF;
 IF activate_supply_recipient_v2(NULL,target,c,'QA','/qa') THEN RAISE EXCEPTION 'duplicate'; END IF;
 IF activate_supply_recipient_v2(NULL,target,jsonb_set(c,'{opportunity_key}','"other"'),'QA','/qa') THEN RAISE EXCEPTION 'recipient quota'; END IF;
 IF set_automatic_supply_enabled_v1(actor,false) THEN RAISE EXCEPTION 'pause failed'; END IF;
 IF activate_supply_recipient_v2(NULL,target,c,'QA','/qa') THEN RAISE EXCEPTION 'pause ignored'; END IF;
 IF (SELECT count(*) FROM notifications)<>1 THEN RAISE EXCEPTION 'notification mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM demand_opportunity_actions WHERE actor_id IS NULL AND role_context='system') THEN RAISE EXCEPTION 'actor mismatch'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','public.set_automatic_supply_enabled_v1(uuid,boolean)','execute') OR has_function_privilege('authenticated','public.automatic_supply_enabled_v1()','execute') THEN RAISE EXCEPTION 'ACL'; END IF;
END $$;
SQL
echo 'PASS automatic control, recipient quota, system identity and pause'
