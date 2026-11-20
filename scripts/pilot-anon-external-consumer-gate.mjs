#!/usr/bin/env node
/**
 * WETUDY #787 — OFFLINE documentary external-consumer signoff gate.
 * Never connects to production or prints keys/PII. Do not run GRANT/REVOKE.
 *
 * --audit : Validate an honestly BLOCKED review status; CI must stay green.
 * --review-ready : Fail closed until each consumer category, including dormant
 *                   unknowns and invoker views, has independent documented
 *                   ownership, negative-guest-dependency evidence and rollback.
 * Even review-ready is NOT an authorization to execute any production SQL.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const path="docs/pilot/ANON_FIVE_TABLE_CONSUMER_ATTESTATION_2026-11-20.json";
const state=JSON.parse(readFileSync(path,"utf8"));
const requiredTables=["agreements","demand_requests","profiles","saved_searches","schools"];
const requiredConsumers=[
 "wetudy-browser-client","wetudy-server-ssr","wetudy-privileged-server",
 "wetudy-vercel-crons","wetudy-agreement-realtime","wetudy-offline-scripts",
 "external-datapi-view-rpc","external-app-mobile-automations"
];
const independent=[
 "owner_signed_external_app_inventory","owner_signed_mobile_and_old_build_inventory",
 "owner_signed_automations_offline_and_partner_inventory",
 "owner_signed_view_and_rpc_consumers",
 "representative_private_family_admin_end_to_end",
 "database_owner_review_of_production_rollback",
 "independent_security_review","owner_signed_legacy_anon_grant_review"
];
function requiredString(value){
 return typeof value==="string"&&value.trim().length>=4;
}
function evidenceLink(value) {
 return requiredString(value)&&/^https:\/\/github\.com\/ogarnelo\/v0-community-marketplace\/(?:issues|pull|blob)\/[^\s?#]+(?:[?#][^\s]*)?$/.test(value);
}
function failIf(condition,message){if(condition)throw Error(message);}
function validateBase(){
 assert.equal(state.schema_version,1);
 assert.equal(state.project_ref,"jpsljmakoscqevssimtk");
 assert.equal(state.pilot_status,"NO_GO");
 assert.equal(state.production_permission_change_authorized,false,
  "This file is documentary, NOT production permission approval");
 assert.deepEqual(state.scope_tables,requiredTables);
 assert.ok(["BLOCKED","REVIEW_READY"].includes(state.external_consumer_gate));
 assert.deepEqual(Object.keys(state.independent_discovery).sort(),independent.slice().sort());
 for(const [key,value] of Object.entries(state.independent_discovery))
   assert.equal(typeof value,"boolean",key+" must be explicit, never inferred");
 assert.equal(state.evidence.rest_requests_five_tables_and_two_invoker_views,251);
 assert.equal(state.evidence.secret_key_requests,185);
 assert.equal(state.evidence.legacy_anon_api_key_with_authenticated_jwt_requests,66);
 assert.equal(state.evidence.identified_effective_anon_requests,0);
 assert.equal(state.evidence.observed_direct_view_requests,0);
 assert.equal(state.evidence.supabase_edge_functions_deployed,0);
 assert.equal(state.evidence.known_invoker_view_at_risk,"public.demand_opportunities_30d");
 assert.ok(state.evidence.limits.includes("Cannot prove absence"));
 assert.deepEqual(state.consumers.map(x=>x.id),requiredConsumers);
 assert.equal(new Set(state.consumers.map(x=>x.id)).size,requiredConsumers.length);
 for(const c of state.consumers){
   assert.ok(requiredString(c.category)&&requiredString(c.source)&&requiredString(c.credential_class));
   assert.ok(["unknown","present","attested_absent"].includes(c.declared_external_consumer_presence),c.id);
   assert.ok(["unverified","not_needed","mitigated_with_testing","required"].includes(c.needs_guest_select),c.id);
   assert.ok(["pending","approved","blocked"].includes(c.disposition),c.id);
   if(c.disposition==="approved"){
     for(const field of ["responsible_owner","independent_reviewer"])
       assert.ok(requiredString(c[field]),c.id+": missing "+field);
     failIf(c.responsible_owner===c.independent_reviewer,
       c.id+": reviewer must be independent of owner");
     assert.match(c.responsible_owner_signoff_at_utc??"",
       /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
     for(const field of ["owner_evidence_url","authorized_smoke_evidence_url",
                          "rollback_acceptance_url","independent_review_url"])
       assert.ok(evidenceLink(c[field]),c.id+": missing reviewed issue/PR evidence "+field);
     assert.notEqual(c.needs_guest_select,"unverified",c.id+": guest-dependency unreviewed");
     assert.notEqual(c.needs_guest_select,"required",c.id+": guest dependency unresolved");
     assert.notEqual(c.declared_external_consumer_presence,"unknown",
       c.id+": existence not atested");
   }
 }
}
function missingReadiness(){
 const blockers=[];
 for(const k of independent)
   if(!state.independent_discovery[k])blockers.push("independent owner review: "+k);
 for(const c of state.consumers){
   if(c.disposition!=="approved")
     blockers.push("owner and independent signoff: "+c.id);
   else if(c.needs_guest_select==="required"||c.needs_guest_select==="unverified")
     blockers.push("unresolved guest SELECT use: "+c.id);
 }
 return blockers;
}
const mode=process.argv[2];
assert.ok(["--audit","--review-ready"].includes(mode)&&process.argv.length===3,
 "Usage: --audit or --review-ready; offline documentation only");
validateBase();
const blockers=missingReadiness();
if(mode==="--audit"){
 assert.equal(state.external_consumer_gate,blockers.length?"BLOCKED":"REVIEW_READY",
  "Manifest must reflect real attested documentary status");
 assert.ok(blockers.length>0,
  "Current review expects missing external owner signatures; separate PR when fully reviewed");
 console.log("PASS: review-only external consumer inventory validated; NO_GO; "+
   blockers.length+" explicit independent-signoff/documentation blockers.");
 console.log("No Supabase connection, no production API credentials, no grant changes.");
} else {
 if(blockers.length){
   console.error("BLOCKED: external consumer documentary review is NOT ready:");
   for(const b of blockers)console.error(" - "+b);
   process.exitCode=1;
 }else{
   assert.equal(state.external_consumer_gate,"REVIEW_READY");
   console.log("Documentary external consumer review READY ONLY.");
   console.log("Still NOT permission to merge, apply SQL, switch pilot ON or bypass prod approval.");
 }
}
