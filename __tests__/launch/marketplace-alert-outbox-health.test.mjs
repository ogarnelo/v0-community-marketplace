import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(p)=>readFileSync(p,"utf8");
const sql=read("supabase/migrations/20261110114223_marketplace_alert_outbox_health_v1.sql");
const cron=read("app/api/cron/email-health/route.ts");
const vercel=JSON.parse(read("vercel.json"));
const fixture=read("scripts/pilot-marketplace-alert-outbox-health.sql");
const ci=read(".github/workflows/pilot-marketplace-alert-outbox.yml");

test("read-only aggregates expose no listing IDs, user IDs or email information",()=>{
  assert.match(sql,/create or replace function public\.marketplace_alert_outbox_health_v1/);
  assert.match(sql,/security invoker/);
  assert.match(sql,/stable/);
  assert.match(sql,/set search_path = ''/);
  assert.match(sql,/from public\.marketplace_alert_outbox as q/);
  assert.match(sql,/count\(\*\) filter/);
  assert.match(sql,/overdue_leases bigint/);
  assert.match(sql,/expired_unfinished bigint/);
  assert.match(sql,/oldest_unfinished_minutes integer/);
  assert.doesNotMatch(sql,/insert into|update public\.marketplace_alert_outbox|delete from/i);
  assert.doesNotMatch(sql.replace(/^--.*$/gm,""),/listing_id|user_id|recipient|postal_code/i);
});

test("only service_role may read aggregate RPC",()=>{
  assert.match(sql,/revoke all on function public\.marketplace_alert_outbox_health_v1\(\)/);
  assert.match(sql,/from public, anon, authenticated/);
  assert.match(sql,/grant execute on function public\.marketplace_alert_outbox_health_v1\(\)/);
  assert.match(sql,/to service_role/);
  assert.match(fixture,/has_function_privilege\('anon'/);
  assert.match(fixture,/has_function_privilege\('authenticated'/);
  assert.match(fixture,/has_function_privilege\('service_role'/);
});

test("existing cron is authenticated before health lookup and never processes alerts",()=>{
  const guard=cron.indexOf('request.headers.get("authorization") !== `Bearer ${cronSecret}`');
  const query=cron.indexOf('rpc("marketplace_alert_outbox_health_v1")');
  assert.ok(guard>=0 && query>guard);
  assert.match(cron,/process\.env\.CRON_SECRET/);
  assert.match(cron,/refreshEmailHealthMonitoring\(admin\)/);
  assert.match(cron,/pruneEmailTelemetry\(admin\)/);
  assert.match(cron,/marketplaceAlertOutbox,/);
  assert.match(cron,/catch \(outboxHealthError\)/);
  assert.match(cron,/WETUDY_ALERT_OUTBOX_ENABLED === "true"/);
  assert.doesNotMatch(cron,/marketplace_alert_claim_outbox_v1|marketplace_alert_settle_outbox_v1/);
  assert.doesNotMatch(cron,/sendSavedSearchMatchEmail|sendTransactionalEmailOnce/);
});

test("no extra Vercel cron or paid service is registered",()=>{
  assert.equal(vercel.crons.filter(x=>x.path.includes("marketplace-alert-outbox")).length,0);
  assert.equal(vercel.crons.filter(x=>x.path==="/api/cron/email-health").length,1);
  assert.match(ci,/pilot-marketplace-alert-outbox-health\.sql/);
  assert.match(ci,/20261110131500_marketplace_alert_outbox_health_v1\.sql/);
  assert.match(fixture,/h\.overdue_leases < 1/);
  assert.match(fixture,/h\.expired_unfinished < 1/);
});
