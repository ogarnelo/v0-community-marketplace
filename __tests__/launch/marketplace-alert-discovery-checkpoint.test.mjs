import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  summarizeDiscoveryPage, WORKER_DISCOVERY_PAGE_SIZE,
} from "../../lib/marketplace/alert-discovery-page.mjs";

const read=(p)=>readFileSync(p,"utf8");
const matcher=read("app/api/marketplace/listings/match-saved-searches/route.ts");
const worker=read("app/api/cron/marketplace-alert-outbox/route.ts");
const migration=read("supabase/migrations/20261110155518_marketplace_alert_discovery_checkpoint_v1.sql");
const fixture=read("scripts/pilot-marketplace-alert-discovery-checkpoint.sql");
const ci=read(".github/workflows/pilot-marketplace-alert-outbox.yml");
const vercel=JSON.parse(read("vercel.json","utf8"));
const uuid=(i)=>i.toString(16).padStart(32,"0")
  .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");

test("3,003 searches can be scanned in strictly advancing 200-row pages",()=>{
  const ids=Array.from({length:3003},(_,i)=>({id:uuid(i+1)}));
  let cursor=null,seen=0,rounds=0;
  while(true){
    const page=ids.filter(x=>cursor===null||x.id>cursor)
      .slice(0,WORKER_DISCOVERY_PAGE_SIZE);
    const summary=summarizeDiscoveryPage(page,cursor);
    seen+=summary.scanned;
    rounds++;
    if(summary.complete)break;
    assert.ok(summary.nextCursor!==cursor,"cursor must move");
    cursor=summary.nextCursor;
  }
  assert.equal(seen,3003);
  assert.equal(rounds,16);
  assert.equal(WORKER_DISCOVERY_PAGE_SIZE,200);
});

test("exact 200, 1,000 and 3,000 searches require a safe empty final page",()=>{
  for (const n of [0,1,199,200,201,999,1000,1001,3000]){
    const ids=Array.from({length:n},(_,i)=>({id:uuid(i+1)}));
    let cursor=null,visited=[];
    let rounds=0;
    for(;;){
      const page=ids.filter(x=>cursor===null||x.id>cursor).slice(0,200);
      visited.push(...page.map(x=>x.id));
      const summary=summarizeDiscoveryPage(page,cursor);
      rounds++;
      cursor=summary.nextCursor;
      if(summary.complete)break;
      assert.ok(rounds<100);
    }
    assert.deepEqual(visited,ids.map(x=>x.id));
    assert.equal(rounds,Math.floor(n/200)+1);
  }
});

test("invalid pages never silently mark unvisited searches scanned",()=>{
  assert.throws(()=>summarizeDiscoveryPage("not array",null),/Invalid discovery page/);
  assert.throws(()=>summarizeDiscoveryPage(Array.from({length:201},(_,i)=>({id:uuid(i+1)})),null),/Invalid discovery page/);
  assert.throws(()=>summarizeDiscoveryPage([{id:uuid(2)},{id:uuid(1)}],null),/advance in UUID order/);
  assert.throws(()=>summarizeDiscoveryPage([{id:uuid(1)}],uuid(1)),/advance in UUID order/);
});

test("only the worker discovers one keyset page and stores progress after upsert",()=>{
  assert.match(matcher,/const isWorkerDelivery = isOutboxWorker && workerStage === "deliver"/);
  assert.match(matcher,/loadSearches\(discoveryCursor, WORKER_DISCOVERY_PAGE_SIZE\)/);
  assert.match(matcher,/\.lte\("created_at", listing\.created_at\)/);
  assert.match(matcher,/\.order\("id", \{ ascending: true \}\)/);
  assert.match(matcher,/\.gt\("id", afterId\)/);
  assert.match(matcher,/loadAllSortedPages\(loadSearches\)/);
  assert.match(matcher,/summarizeDiscoveryPage\(savedSearches, discoveryCursor\)/);
  assert.match(matcher,/marketplace_alert_advance_discovery_v1/);
  assert.match(matcher,/p_expected_cursor: discoveryCursor/);
  assert.match(matcher,/p_next_cursor: discovery\.nextCursor/);
  assert.match(matcher,/p_complete: discovery\.complete/);
  assert.match(matcher,/if \(advanced !== true\)/);
  const write=matcher.indexOf('.upsert(batch, { onConflict: "saved_search_id,listing_id"');
  const advance=matcher.indexOf('"marketplace_alert_advance_discovery_v1"');
  assert.ok(write>=0 && advance>write,"never advance before storing matches");
});

test("delivery stage uses persisted matches and never rescans all searches",()=>{
  assert.match(matcher,/if \(!isWorkerDelivery\) \{/);
  assert.match(matcher,/const pendingNotifications = isWorkerDelivery/);
  assert.match(matcher,/const pendingMatches = isWorkerDelivery/);
  assert.match(matcher,/\.is\("notified_at", null\)/);
  assert.match(matcher,/\.is\("emailed_at", null\)\.is\("email_skipped_at", null\)/);
  assert.match(matcher,/\.limit\(13\)/);
  assert.match(matcher,/selectDeliveryPage\(pendingNotifications, isOutboxWorker\)/);
  assert.match(matcher,/selectDeliveryPage\(pendingMatches, isOutboxWorker\)/);
  assert.match(matcher,/sendTransactionalEmailOnce\(/);
  assert.match(matcher,/createNotificationOnce\(/);
});

test("signed worker requires current lease; caller cannot claim delivery prematurely",()=>{
  assert.match(matcher,/process\.env\.WETUDY_ALERT_OUTBOX_ENABLED === "true"/);
  assert.match(matcher,/request\.headers\.get\("x-wetudy-alert-outbox"\) === "1"/);
  assert.match(matcher,/\.eq\("lease_token", workerLeaseToken\)/);
  assert.match(matcher,/\.gt\("lease_until", new Date\(\)\.toISOString\(\)\)/);
  assert.match(matcher,/if \(!job \|\|/);
  assert.match(matcher,/workerStage === "deliver" && !job\.discovery_completed_at/);
  assert.match(worker,/const stage = discoveryState\.discovery_completed_at \? "deliver" : "discover"/);
  assert.match(worker,/leaseToken: job\.lease_token, stage/);
  assert.match(worker,/if \(partialProgress\)/);
  assert.equal(vercel.crons.filter(x=>x.path.includes("marketplace-alert-outbox")).length,0);
});

test("fenced SQL cannot be advanced by anon/auth or stale/expired worker",()=>{
  assert.match(migration,/add column if not exists discovery_cursor uuid/);
  assert.match(migration,/add column if not exists discovery_completed_at timestamptz/);
  assert.match(migration,/security invoker/);
  assert.match(migration,/q\.lease_token = p_lease_token/);
  assert.match(migration,/q\.lease_until > now\(\)/);
  assert.match(migration,/q\.expires_at > now\(\)/);
  assert.match(migration,/q\.discovery_cursor is not distinct from p_expected_cursor/);
  assert.match(migration,/p_next_cursor <= p_expected_cursor/);
  assert.match(migration,/revoke all on function public\.marketplace_alert_advance_discovery_v1/);
  assert.match(migration,/to service_role/);
  assert.match(fixture,/Wrong lease advanced discovery/);
  assert.match(fixture,/Expired worker completed discovery/);
  assert.match(fixture,/Discovery cursor not durably persisted/);
  assert.match(ci,/pilot-marketplace-alert-discovery-checkpoint\.sql/);
});
