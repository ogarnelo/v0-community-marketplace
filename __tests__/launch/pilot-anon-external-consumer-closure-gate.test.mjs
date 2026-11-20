import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const manifestPath="docs/pilot/ANON_FIVE_TABLE_CONSUMER_ATTESTATION_2026-11-20.json";
const scriptPath="scripts/pilot-anon-external-consumer-gate.mjs";
const m=JSON.parse(readFileSync(manifestPath,"utf8"));
const gate=readFileSync(scriptPath,"utf8");
const workflow=readFileSync(".github/workflows/contracts.yml","utf8");

test("external owner discovery is explicitly NOT attested; release remains NO-GO",()=>{
 assert.equal(m.project_ref,"jpsljmakoscqevssimtk");
 assert.equal(m.pilot_status,"NO_GO");
 assert.equal(m.external_consumer_gate,"BLOCKED");
 assert.equal(m.production_permission_change_authorized,false);
 assert.equal(m.consumers.length,8);
 assert.ok(m.consumers.every(c=>c.disposition==="pending"&&
   c.responsible_owner===null&&c.independent_reviewer===null));
 assert.ok(Object.values(m.independent_discovery).every(x=>x===false));
 assert.equal(m.independent_discovery.owner_signed_legacy_anon_grant_review,false);
 assert.deepEqual(m.evidence.anon_direct_dml_grants,
   ["demand_requests","profiles","saved_searches","schools"]);
 assert.deepEqual(m.evidence.anon_direct_maintain_grant,["agreements"]);
 assert.equal(m.evidence.anon_has_login,false);
 assert.equal(m.evidence.anon_has_bypassrls,false);
 assert.equal(m.evidence.target_tables_with_anon_or_public_rls_policies,0);
 assert.equal(m.evidence.columns_with_custom_acl_on_five_tables,0);
 for(const required of [
   "external-datapi-view-rpc","external-app-mobile-automations",
   "wetudy-browser-client","wetudy-server-ssr",
   "wetudy-privileged-server","wetudy-vercel-crons",
   "wetudy-agreement-realtime","wetudy-offline-scripts"
 ])assert.ok(m.consumers.some(c=>c.id===required));
 assert.ok(m.evidence.limits.includes("Cannot prove absence"));
 assert.equal(m.evidence.observed_direct_view_requests,0);
 assert.equal(m.evidence.known_invoker_view_at_risk,"public.demand_opportunities_30d");
});

test("aggregate REST attribution distinguishes anon API key from anon JWT role",()=>{
 assert.equal(m.evidence.rest_requests_five_tables_and_two_invoker_views,251);
 assert.equal(m.evidence.secret_key_requests,185);
 assert.equal(m.evidence.legacy_anon_api_key_with_authenticated_jwt_requests,66);
 assert.equal(m.evidence.identified_effective_anon_requests,0);
 assert.equal(m.evidence.secret_key_requests+
   m.evidence.legacy_anon_api_key_with_authenticated_jwt_requests,
   m.evidence.rest_requests_five_tables_and_two_invoker_views);
 assert.equal(m.evidence.supabase_edge_functions_deployed,0);
});

test("review-only validator passes and cannot run GRANT/REVOKE or make network calls",()=>{
 assert.match(gate,/OFFLINE documentary external-consumer signoff gate/);
 assert.match(gate,/production_permission_change_authorized,false/);
 assert.match(gate,/independent_reviewer/);
 assert.match(gate,/owner_evidence_url/);
 assert.match(gate,/rollback_acceptance_url/);
 assert.doesNotMatch(gate,/https?\.request|fetch\(|createClient\(|execute_sql|apply_migration|docker exec/);
 const out=spawnSync(process.execPath,[scriptPath,"--audit"],{
   encoding:"utf8",timeout:8000});
 assert.equal(out.status,0,out.stderr);
 assert.match(out.stdout,/NO_GO/);
 assert.match(out.stdout,/explicit independent-signoff\/documentation blockers/);
});

test("mandatory readiness check fails closed without independent human owner signoff",()=>{
 const out=spawnSync(process.execPath,[scriptPath,"--review-ready"],{
   encoding:"utf8",timeout:8000});
 assert.equal(out.status,1,out.stdout+out.stderr);
 assert.match(out.stderr,/BLOCKED: external consumer documentary review is NOT ready/);
 assert.match(out.stderr,/external-datapi-view-rpc/);
 assert.match(out.stderr,/external-app-mobile-automations/);
 assert.match(out.stderr,/representative_private_family_admin_end_to_end/);
 assert.match(out.stderr,/independent_security_review/);
 assert.match(out.stderr,/owner_signed_legacy_anon_grant_review/);
 assert.match(workflow,/pilot-anon-external-consumer-closure-gate\.test\.mjs/);
});
