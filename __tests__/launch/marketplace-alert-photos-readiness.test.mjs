import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const worker=read("app/api/cron/marketplace-alert-outbox/route.ts");
const migration=read("supabase/migrations/20261110145531_marketplace_alert_defer_photos_v1.sql");
const fixture=read("scripts/pilot-marketplace-alert-defer-photos.sql");
const ci=read(".github/workflows/pilot-marketplace-alert-outbox.yml");
const vercel=JSON.parse(read("vercel.json"));

test("the worker separates an unfinished photo upload from delivery failures",()=>{
  assert.match(worker,/let awaitingPhotos = false/);
  assert.match(worker,/if \(!count\) \{[\s\S]*?awaitingPhotos = true/);
  assert.match(worker,/if \(awaitingPhotos\) \{/);
  assert.match(worker,/marketplace_alert_defer_readiness_v1/);
  assert.match(worker,/outcome: "waiting_for_photos"/);
  assert.match(worker,/status: 202/);
  const defer=worker.indexOf("if (awaitingPhotos)");
  const settle=worker.indexOf("marketplace_alert_settle_outbox_v1");
  assert.ok(defer>=0 && defer<settle);
  assert.doesNotMatch(worker,/errorCode = "photos_pending"/);
});

test("the readiness RPC is service-only, leased and expires safely",()=>{
  assert.match(migration,/create or replace function public\.marketplace_alert_defer_readiness_v1/);
  assert.match(migration,/security invoker/);
  assert.match(migration,/set search_path = ''/);
  assert.match(migration,/q\.state = 'processing'/);
  assert.match(migration,/q\.lease_token = p_lease_token/);
  assert.match(migration,/q\.expires_at > now\(\)/);
  assert.match(migration,/attempts = greatest\(0, q\.attempts - 1\)/);
  assert.match(migration,/next_attempt_at = now\(\) \+ interval '5 minutes'/);
  assert.match(migration,/revoke all on function public\.marketplace_alert_defer_readiness_v1/);
  assert.match(migration,/grant execute on function public\.marketplace_alert_defer_readiness_v1/);
  assert.match(migration,/to service_role/);
  assert.doesNotMatch(migration,/create table|create trigger|insert into|update public\.listings/i);
});

test("isolated database fixture verifies anti-spoofing and normal readiness delay",()=>{
  assert.match(ci,/pilot-marketplace-alert-defer-photos\.sql/);
  assert.match(ci,/20261110145531_marketplace_alert_defer_photos_v1\.sql/);
  assert.match(fixture,/Forged|forged lease token/);
  assert.match(fixture,/Photos pending job was reclaimed before five-minute backoff/);
  assert.match(fixture,/did not retain its full failure budget/);
  assert.match(fixture,/Expired job was rescheduled after its 48-hour expiry/);
});

test("feature flag and cron remain off; no recipient mail is sent by these changes",()=>{
  assert.equal(vercel.crons.filter(x=>x.path.includes("marketplace-alert-outbox")).length,0);
  assert.match(worker,/if \(!alertOutboxWorkerEnabled\(\)\)/);
  assert.ok(worker.indexOf("if (!alertOutboxWorkerEnabled())") <
    worker.indexOf('"marketplace_alert_claim_outbox_v1"'));
  assert.doesNotMatch(migration,/sendTransactionalEmailOnce|sendSavedSearchMatchEmail/);
});
