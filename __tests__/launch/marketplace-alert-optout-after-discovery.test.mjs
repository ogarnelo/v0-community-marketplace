import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(p)=>readFileSync(p,"utf8");
const migration=read("supabase/migrations/20261110161156_saved_search_preference_stamp_v1.sql");
const fixture=read("scripts/pilot-marketplace-saved-search-optout.sql");
const matcher=read("app/api/marketplace/listings/match-saved-searches/route.ts");
const ci=read(".github/workflows/pilot-marketplace-alert-outbox.yml");
const cron=JSON.parse(read("vercel.json"));

test("every matching-preference or notification opt-out change receives a new revision",()=>{
  assert.match(migration,/create or replace function wetudy_internal\.saved_search_preference_stamp_v1/);
  assert.match(migration,/security invoker/);
  assert.match(migration,/set search_path = ''/);
  assert.match(migration,/new\.updated_at := now\(\)/);
  assert.match(migration,/before update of notifications_enabled, query, isbn_query, category/);
  assert.match(migration,/grade_level, listing_type, condition, only_my_community/);
  assert.match(migration,/school_id, directory_school_code, radius_km, user_id, updated_at/);
  assert.match(migration,/revoke all on function wetudy_internal\.saved_search_preference_stamp_v1/);
  assert.doesNotMatch(migration,/update public\.saved_searches|insert into public\.saved_searches/i);
});

test("discovery only considers saved searches existing and unchanged before publication",()=>{
  assert.match(matcher,/query = query\.lte\("created_at", listing\.created_at\)/);
  assert.match(matcher,/\.lte\("updated_at", listing\.created_at\)/);
  assert.match(matcher,/\.eq\("notifications_enabled", true\)/);
  assert.match(matcher,/if \(isOutboxWorker\)/);
});

test("outbox delivery excludes disabled and edited searches for BOTH channels",()=>{
  assert.equal((matcher.match(/saved_searches!inner\(id, notifications_enabled, updated_at, radius_km\)/g)||[]).length,2);
  assert.equal((matcher.match(/\.eq\("saved_searches\.notifications_enabled", true\)/g)||[]).length,2);
  assert.equal((matcher.match(/\.lte\("saved_searches\.updated_at", listing\.created_at\)/g)||[]).length,2);
  assert.match(matcher,/\.is\("email_skipped_at", null\)/);
  assert.match(matcher,/\.is\("notified_at", null\)/);
  assert.match(matcher,/\.order\("id", \{ ascending: true \}\)\.limit\(13\)/);
  assert.match(matcher,/sendTransactionalEmailOnce\(/);
  assert.match(matcher,/createNotificationOnce\(/);
});

test("PostgreSQL fixture enforces user opt-out/opt-in, anti-forgery and old listing exclusions",()=>{
  assert.match(ci,/pilot-marketplace-saved-search-optout\.sql/);
  assert.match(fixture,/Opt-out did not update revision timestamp/);
  assert.match(fixture,/Re-enabled search incorrectly retained stale timestamp/);
  assert.match(fixture,/Criteria update did not advance search revision/);
  assert.match(fixture,/Old listing opt-out and changed preferences were not excluded/);
  assert.match(fixture,/has_function_privilege\('anon'/);
});

test("pilot recovery remains OFF and no new cron or UI design is introduced",()=>{
  assert.equal(cron.crons.filter(x=>x.path.includes("marketplace-alert-outbox")).length,0);
  assert.match(matcher,/WETUDY_ALERT_OUTBOX_ENABLED === "true"/);
});
