import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const worker=readFileSync("app/api/cron/marketplace-alert-outbox/route.ts","utf8");
const schema=readFileSync("supabase/migrations/20261110211000_marketplace_alert_email_send_intents_v1.sql","utf8");
const vercel=JSON.parse(readFileSync("vercel.json","utf8"));

test("signed worker checks both feature flags and all schema readiness before claiming",()=>{
 const flag=worker.indexOf('WETUDY_ALERT_INTENT_DELIVERY_ENABLED !== "true"');
 const table=worker.indexOf('.from("marketplace_alert_email_intents")');
 const intentHealth=worker.indexOf('"marketplace_alert_email_intent_health_v1"');
 const reviewHealth=worker.indexOf('"marketplace_alert_review_count_v1"');
 const claim=worker.indexOf('"marketplace_alert_claim_outbox_v1"');
 assert.ok(flag>=0 && table>flag && intentHealth>table &&
  reviewHealth>intentHealth && claim>reviewHealth);
 assert.match(worker,/intent_functions_not_ready/);
 assert.match(worker,/email_schema_not_ready/);
 assert.match(worker,/review_schema_not_ready/);
});
test("intent readiness RPC is a private aggregate installed after transition RPCs",()=>{
 const prepare=schema.indexOf("create or replace function public.marketplace_alert_email_prepare_v1");
 const begin=schema.indexOf("create or replace function public.marketplace_alert_email_begin_v1");
 const accept=schema.indexOf("create or replace function public.marketplace_alert_email_accept_v1");
 const quarantine=schema.indexOf("create or replace function public.marketplace_alert_email_ambiguous_v1");
 const health=schema.indexOf("create or replace function public.marketplace_alert_email_intent_health_v1");
 assert.ok(prepare>=0 && begin>prepare && accept>begin && quarantine>accept && health>quarantine);
 assert.match(schema,/revoke all on function public\.marketplace_alert_email_intent_health_v1\(\)/);
 assert.match(schema,/grant execute on function public\.marketplace_alert_email_intent_health_v1\(\)\s+to service_role/);
});
test("preflight remains read-only; no cron is registered for recovering alerts",()=>{
 const preflight=readFileSync("scripts/pilot-marketplace-alert-production-preflight.sql","utf8");
 assert.match(preflight,/begin transaction read only;/i);
 assert.equal(vercel.crons.filter(c=>c.path.includes("marketplace-alert-outbox")).length,0);
});
