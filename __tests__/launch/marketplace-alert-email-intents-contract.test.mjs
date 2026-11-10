import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const migration=readFileSync("supabase/migrations/20261110211000_marketplace_alert_email_send_intents_v1.sql","utf8");
const fixture=readFileSync("scripts/pilot-marketplace-alert-email-intents.sql","utf8");
const workflow=readFileSync(".github/workflows/pilot-marketplace-alert-outbox.yml","utf8");
const worker=readFileSync("app/api/cron/marketplace-alert-outbox/route.ts","utf8");
const vercel=JSON.parse(readFileSync("vercel.json","utf8"));
test("intent schema stores only event key, hash, provider receipt and technical timestamps",()=>{
  assert.match(migration,/create table if not exists public\.marketplace_alert_email_intents/);
  assert.match(migration,/payload_sha256 text not null/);
  assert.match(migration,/state in \('prepared','sending','accepted','ambiguous'\)/);
  assert.doesNotMatch(migration.replace(/^--.*$/gm,""),/recipient_email|postal_code|school_id|email_body|listing_title/i);
});
test("only service role executes state transition functions and RLS stays enabled",()=>{
  assert.match(migration,/enable row level security/);
  assert.match(migration,/revoke all on public\.marketplace_alert_email_intents from public, anon, authenticated/);
  assert.match(migration,/revoke all on function public\.marketplace_alert_email_prepare_v1\(text,text\) from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.marketplace_alert_email_begin_v1\(text,text,uuid\) to service_role/);
});
test("durable intent rejects changed payload and never automatically resets ambiguous",()=>{
  assert.match(migration,/payload_conflict/);
  assert.match(migration,/and i\.state='prepared'/);
  assert.match(migration,/and i\.state='sending'/);
  assert.doesNotMatch(migration,/state='prepared'\s*where/);
  assert.match(fixture,/Ambiguous request retried automatically/);
  assert.match(fixture,/Second worker started same send/);
  assert.match(fixture,/Accepted intent sent twice/);
});
test("isolated PostgreSQL workflow includes the fixture, while production worker stays off",()=>{
  assert.match(workflow,/pilot-marketplace-alert-email-intents\.sql/);
  assert.match(workflow,/127\.0\.0\.1/);
  assert.match(worker,/WETUDY_ALERT_OUTBOX_ENABLED !== "true"/);
  assert.equal(vercel.crons.filter(x=>x.path.includes("marketplace-alert-outbox")).length,0);
});
