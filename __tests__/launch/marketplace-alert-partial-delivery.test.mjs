import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WORKER_RECIPIENT_BATCH_SIZE,
  selectDeliveryPage,
  summarizeDeliveryProgress,
} from "../../lib/marketplace/alert-delivery-progress.mjs";

const read = (p) => readFileSync(p,"utf8");
const matcher=read("app/api/marketplace/listings/match-saved-searches/route.ts");
const worker=read("app/api/cron/marketplace-alert-outbox/route.ts");
const migration=read("supabase/migrations/20261110121643_marketplace_alert_delivery_progress.sql");
const vercel=JSON.parse(read("vercel.json"));

test("a recoverer processes 2,407 recipients in bounded pages without silent drops",()=>{
  const notifications=Array.from({length:2407},(_,i)=>({id:i,notified:false}));
  const emails=Array.from({length:2407},(_,i)=>({id:i,emailed:false}));
  const notifiedIds=new Set(), emailedIds=new Set();
  let iterations=0;
  while(true) {
    const nPending=notifications.filter(x=>!x.notified);
    const ePending=emails.filter(x=>!x.emailed);
    const nPage=selectDeliveryPage(nPending,true);
    const ePage=selectDeliveryPage(ePending,true);
    for(const item of nPage){ assert.ok(!notifiedIds.has(item.id));notifiedIds.add(item.id);item.notified=true; }
    for(const item of ePage){ assert.ok(!emailedIds.has(item.id));emailedIds.add(item.id);item.emailed=true; }
    const result=summarizeDeliveryProgress({
      isWorker:true,
      pendingNotifications:nPending.length,
      notificationPage:nPage.length,
      pendingEmails:ePending.length,
      emailPage:ePage.length,
      emailFailures:0,
    });
    iterations++;
    if(result.complete)break;
    assert.equal(result.hasMore,true);
    assert.ok(iterations<500);
  }
  assert.equal(iterations,Math.ceil(2407/WORKER_RECIPIENT_BATCH_SIZE));
  assert.equal(notifiedIds.size,2407);
  assert.equal(emailedIds.size,2407);
  assert.equal(WORKER_RECIPIENT_BATCH_SIZE,12);
});

test("partial success is not final completion; failures are not swallowed",()=>{
  const partial=summarizeDeliveryProgress({
    isWorker:true,pendingNotifications:25,notificationPage:12,
    pendingEmails:25,emailPage:12,emailFailures:0
  });
  assert.deepEqual(partial,{complete:false,hasMore:true,failed:false});
  assert.deepEqual(summarizeDeliveryProgress({
    isWorker:true,pendingNotifications:3,notificationPage:3,
    pendingEmails:3,emailPage:3,emailFailures:1
  }),{complete:false,hasMore:false,failed:true});
  assert.deepEqual(summarizeDeliveryProgress({
    isWorker:true,pendingNotifications:0,notificationPage:0,
    pendingEmails:0,emailPage:0,emailFailures:0
  }),{complete:true,hasMore:false,failed:false});
  assert.deepEqual(selectDeliveryPage(Array.from({length:33},(_,i)=>i),false),
    Array.from({length:33},(_,i)=>i),
    "seller-published alerts must not lose recipients while worker remains disabled");
});

test("worker consumes explicit complete field and safely requeues partial progress",()=>{
  assert.match(worker,/body\?\.ok === true && body\?\.complete === true/);
  assert.match(worker,/body\?\.ok === true && body\?\.complete === false/);
  assert.match(worker,/if \(partialProgress\)/);
  assert.match(worker,/marketplace_alert_requeue_progress_v1/);
  assert.match(worker,/p_lease_token: job\.lease_token/);
  assert.match(worker,/outcome: "progress_saved"/);
  assert.match(worker,/status: 202/);
  assert.match(worker,/marketplace_alert_settle_outbox_v1/);
  assert.match(worker,/errorCode = response\.status >= 500/);
});

test("matcher retains owner scope, fixes legacy postal fallback and keeps email outcomes separate",()=>{
  assert.match(matcher,/\.eq\("id", listingOwnerId\)\.maybeSingle\(\)/);
  assert.doesNotMatch(matcher,/\.eq\("id", user\.id\)\.maybeSingle\(\)/);
  assert.match(matcher,/selectDeliveryPage\(pendingNotifications, isOutboxWorker\)/);
  assert.match(matcher,/selectDeliveryPage\(pendingMatches, isOutboxWorker\)/);
  assert.match(matcher,/\.is\("email_skipped_at", null\)/);
  assert.match(matcher,/email_skip_reason: "suppressed"/);
  assert.match(matcher,/email_skip_reason: "recipient_missing"/);
  assert.match(matcher,/if \(progress\.failed\)/);
  assert.match(matcher,/error: "partial_delivery_failed"/);
  assert.match(matcher,/status: 503/);
  assert.match(matcher,/complete: progress\.complete/);
  assert.match(matcher,/sendTransactionalEmailOnce\(/);
  assert.match(matcher,/sendSavedSearchMatchEmail\(/);
  assert.match(matcher,/onConflict: "saved_search_id,listing_id", ignoreDuplicates: true/);
});

test("schema stores permanent skips truthfully and restricts progress RPC to service role",()=>{
  assert.match(migration,/add column if not exists email_skipped_at timestamptz/);
  assert.match(migration,/add column if not exists email_skip_reason text/);
  assert.match(migration,/email_skip_reason in \(/);
  assert.match(migration,/create or replace function public\.marketplace_alert_requeue_progress_v1/);
  assert.match(migration,/security invoker/);
  assert.match(migration,/q\.lease_token=p_lease_token/);
  assert.match(migration,/q\.expires_at>now\(\)/);
  assert.match(migration,/attempts=0/);
  assert.match(migration,/next_attempt_at=now\(\)\+interval '15 seconds'/);
  assert.match(migration,/revoke all on function public\.marketplace_alert_requeue_progress_v1/);
  assert.match(migration,/to service_role/);
  assert.doesNotMatch(migration,/(update|delete from|insert into)\s+public\.(listings|school_directory|profiles)/i);
  assert.equal(vercel.crons.filter(x=>x.path.includes("marketplace-alert-outbox")).length,0);
});
