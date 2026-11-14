import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20261110111353_marketplace_alert_outbox_v1.sql","utf8");
const worker = readFileSync("app/api/cron/marketplace-alert-outbox/route.ts","utf8");
const matcher = readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
const vercel = JSON.parse(readFileSync("vercel.json","utf8"));

test("outbox is transactionally enqueued for newly available non-DEMO listings",()=>{
  assert.match(sql,/create table if not exists public\.marketplace_alert_outbox/);
  assert.match(sql,/listing_id uuid primary key references public\.listings\(id\) on delete cascade/);
  assert.match(sql,/after insert on public\.listings/);
  assert.match(sql,/new\.is_demo is distinct from true/);
  assert.match(sql,/new\.status = 'available'/);
  assert.match(sql,/on conflict \(listing_id\) do nothing/);
  assert.doesNotMatch(sql,/insert into public\.listings|update public\.listings/i);
  assert.match(sql,/now\(\) \+ interval '48 hours'/);
});

test("private trigger and service-only RPCs cannot be invoked by browser roles",()=>{
  assert.match(sql,/create schema if not exists wetudy_internal/);
  assert.match(sql,/revoke all on schema wetudy_internal from public, anon, authenticated/);
  assert.match(sql,/security definer[\s\S]+set search_path = ''/);
  assert.match(sql,/alter table public\.marketplace_alert_outbox enable row level security/);
  assert.match(sql,/revoke all on table public\.marketplace_alert_outbox from public, anon, authenticated/);
  assert.match(sql,/grant select, insert, update, delete on table public\.marketplace_alert_outbox to service_role/);
  assert.equal((sql.match(/security invoker/g)||[]).length,2);
  assert.equal((sql.match(/grant execute on function public\.marketplace_alert_/g)||[]).length,2);
  assert.match(sql,/revoke all on function public\.marketplace_alert_claim_outbox_v1\(integer,integer\)/);
  assert.match(sql,/revoke all on function public\.marketplace_alert_settle_outbox_v1\(uuid,uuid,boolean,text\)/);
});

test("workers cannot reprocess concurrently or overwrite one another after lease expiry",()=>{
  assert.match(sql,/for update skip locked/);
  assert.match(sql,/q\.lease_until < now\(\)/);
  assert.match(sql,/q\.expires_at > now\(\)/);
  assert.match(sql,/q\.attempts < 4/);
  assert.match(sql,/lease_token = gen_random_uuid\(\)/);
  assert.match(sql,/q\.lease_token = p_lease_token/);
  assert.match(sql,/p_limit < 1 or p_limit > 2/);
  assert.match(sql,/p_lease_seconds < 30 or p_lease_seconds > 300/);
  assert.match(sql,/when q\.attempts >= 4 or q\.expires_at <= now\(\) then 'failed'/);
});

test("worker has two independent security gates and cannot leak the secret to a forged host",()=>{
  assert.match(worker,/process\.env\.CRON_SECRET/);
  assert.match(worker,/request\.headers\.get\("authorization"\) !== `Bearer \$\{cronSecret\}`/);
  assert.match(worker,/if \(!alertOutboxWorkerEnabled\(\)\)/);
  assert.match(worker,/p_limit: 1, p_lease_seconds: 240/);
  assert.match(worker,/https:\/\/www\.wetudy\.com\/api\/marketplace\/listings\/match-saved-searches/);
  assert.doesNotMatch(worker,/request\.headers\.get\("host"\)|new URL\(request\.url\)\.origin/);
  assert.match(worker,/redirect: "manual"/);
  assert.match(worker,/AbortSignal\.timeout\(25000\)/);
  assert.match(worker,/if \(!listing \|\| listing\.is_demo === true \|\| listing\.status !== "available"\)/);
  assert.match(worker,/if \(!count\)/);
  assert.match(worker,/marketplace_alert_settle_outbox_v1/);
});

test("outbox is not scheduled and no user-facing workflow is changed",()=>{
  assert.equal(vercel.crons.filter(x=>x.path.includes("marketplace-alert-outbox")).length,0);
  assert.match(matcher,/process\.env\.WETUDY_ALERT_OUTBOX_ENABLED === "true"/);
  assert.match(matcher,/request\.headers\.get\("x-wetudy-alert-outbox"\) === "1"/);
  assert.match(matcher,/request\.headers\.get\("authorization"\) === `Bearer \$\{cronSecret\}`/);
  assert.match(matcher,/if \(!user && !isOutboxWorker\)/);
  assert.match(matcher,/if \(!isOutboxWorker\)/);
  assert.match(matcher,/listing\.seller_id !== user\.id && listing\.user_id !== user\.id/);
  assert.match(matcher,/\.neq\("user_id", listingOwnerId\)/);
  assert.match(matcher,/if \(isOutboxWorker && listing\.is_demo === true\)/);
  assert.match(matcher,/onConflict: "saved_search_id,listing_id", ignoreDuplicates: true/);
  assert.match(matcher,/sendTransactionalEmailOnce\(/);
});
