#!/usr/bin/env bash
set -euo pipefail
# Local synthetic PostgreSQL only; never accept a remote connection.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=wetudy_synthetic_pg17 PGCONNECT_TIMEOUT=5
unset PGDATABASE PGSERVICE PGSERVICEFILE PGOPTIONS
db=wetudy_supply_synthetic
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
createdb "$db"
q(){ psql -XAt -v ON_ERROR_STOP=1 -d "$db" "$@"; }
q <<'SQL'
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
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
actor=11111111-1111-4111-8111-111111111111
target=22222222-2222-4222-8222-222222222222
call(){ printf "SELECT public.activate_supply_recipient_v2('%s','%s','{\"opportunity_key\":\"%s\",\"title\":\"QA\",\"families_count\":3,\"supply_count\":0,\"searches_count\":3,\"priority\":\"medium\"}'::jsonb,'QA','/qa');" "$actor" "$target" "$1"; }
# Deterministic overlap: wait until the named first session holds the row lock.
wait_sleep(){ local app="$1"; for i in $(seq 1 100); do
  if [[ "$(q -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='$app' AND wait_event='PgSleep'")" == 1 ]]; then return; fi
  sleep .05
done; echo "No synchronization with $app" >&2; exit 1; }
(
 export PGAPPNAME=qa_revoke_first
 q <<SQL
BEGIN;
UPDATE user_marketplace_preferences SET supply_outreach_opt_in=false WHERE user_id='$target';
SELECT pg_sleep(2);
COMMIT;
SQL
) >"$tmp/revoke" 2>&1 &
a=$!
wait_sleep qa_revoke_first
[[ "$(q -c "$(call revoked)")" == f ]]
wait "$a"
[[ "$(q -c 'SELECT count(*) FROM notifications')" == 0 ]]
q -c "UPDATE user_marketplace_preferences SET supply_outreach_opt_in=true WHERE user_id='$target'" >/dev/null
(
 export PGAPPNAME=qa_send_first
 q <<SQL
BEGIN;
SET LOCAL ROLE service_role;
$(call race)
SELECT pg_sleep(2);
COMMIT;
SQL
) >"$tmp/send" 2>&1 &
a=$!
wait_sleep qa_send_first
[[ "$(q -c "$(call race)")" == f ]]
wait "$a"
grep -qx t "$tmp/send"
[[ "$(q -c "SELECT count(*) FROM notifications")" == 1 ]]
[[ "$(q -c "SELECT count(*) FROM demand_opportunity_actions")" == 1 ]]
q -c "UPDATE demand_opportunity_actions SET sent_at=now()-interval '31 days'" >/dev/null
[[ "$(q -c "$(call race)")" == t ]]
[[ "$(q -c "SELECT count(*) FROM notifications")" == 2 ]]
q -c "UPDATE demand_campaigns SET status='closed' WHERE opportunity_key='race'; UPDATE demand_opportunity_actions SET sent_at=now()-interval '31 days'" >/dev/null
[[ "$(q -c "$(call race)")" == f ]]
# An error inserting a notification must roll back both the action and campaign.
q -c "ALTER TABLE notifications ADD CONSTRAINT qa_failure CHECK(body<>'QA') NOT VALID" >/dev/null
if q -c "$(call rollback)" >"$tmp/error" 2>&1; then echo 'Expected notification failure' >&2; exit 1; fi
grep -q qa_failure "$tmp/error"
[[ "$(q -c "SELECT count(*) FROM demand_opportunity_actions WHERE opportunity_key='rollback'")" == 0 ]]
[[ "$(q -c "SELECT count(*) FROM demand_campaigns WHERE opportunity_key='rollback'")" == 0 ]]
[[ "$(q -c "SELECT has_function_privilege('anon','public.activate_supply_recipient_v2(uuid,uuid,jsonb,text,text)','EXECUTE') OR has_function_privilege('authenticated','public.activate_supply_recipient_v2(uuid,uuid,jsonb,text,text)','EXECUTE')")" == f ]]
echo 'PASS PG17 concurrent revoke, duplicate, 30-day cooldown, closed campaign, atomic rollback and ACL; no production.'
