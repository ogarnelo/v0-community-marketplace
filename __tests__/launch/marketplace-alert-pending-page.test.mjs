import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadPendingDeliveryRows } from "../../lib/marketplace/alert-pending-page.mjs";
import { selectDeliveryPage, WORKER_RECIPIENT_BATCH_SIZE, summarizeDeliveryProgress }
  from "../../lib/marketplace/alert-delivery-progress.mjs";

const route=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
const mkId=(i)=>i.toString().padStart(7,"0");
const make=(n)=>Array.from({length:n},(_,i)=>({saved_search_id:mkId(i+1)}));

test("2,407 recipients resume through bounded pending pages without omissions or duplicates", async()=>{
  const matches=make(2407);
  const delivered=new Set();
  let cycles=0;
  let reads=0;
  let sawSentinel=false;
  while(true){
    const pending=await loadPendingDeliveryRows(matches,true,async(batch,limit)=>{
      reads++;
      assert.ok(batch.length<=150);
      assert.ok(limit>=1 && limit<=WORKER_RECIPIENT_BATCH_SIZE+1);
      return batch.filter(x=>!delivered.has(x.saved_search_id))
        .slice(0,limit).map(x=>({id:x.saved_search_id,user_id:"qa"}));
    });
    assert.ok(pending.length<=WORKER_RECIPIENT_BATCH_SIZE+1);
    const page=selectDeliveryPage(pending,true);
    for(const item of page){
      assert.ok(!delivered.has(item.id),"duplicate recipient");
      delivered.add(item.id);
    }
    const progress=summarizeDeliveryProgress({
      isWorker:true,pendingNotifications:pending.length,
      notificationPage:page.length,pendingEmails:0,emailPage:0,emailFailures:0,
    });
    cycles++;
    if(pending.length===13) sawSentinel=true;
    if(progress.complete)break;
    assert.equal(progress.hasMore,true);
    assert.ok(cycles<300);
  }
  assert.equal(delivered.size,2407);
  assert.equal(cycles,Math.ceil(2407/WORKER_RECIPIENT_BATCH_SIZE));
  assert.equal(sawSentinel,true);
  // A full 17-query scan after each of 201 invocations would issue 3417
  // queries. The bounded sentinel eliminates many irrelevant reads.
  assert.ok(reads < 2407/WORKER_RECIPIENT_BATCH_SIZE*17);
});

test("all page boundaries preserve exact total, without a 1,000-row ceiling",async()=>{
  for(const n of [0,1,11,12,13,14,149,150,151,1000,1001,3000]){
    const matches=make(n);
    const pending=await loadPendingDeliveryRows(matches,true,async(batch,limit)=>
      batch.slice(0,limit).map(x=>({id:x.saved_search_id,user_id:"qa"})));
    assert.equal(pending.length,Math.min(n,13),`wrong worker sentinel at ${n}`);
    const ordinary=await loadPendingDeliveryRows(matches,false,async(batch,limit)=>{
      assert.equal(limit,null);
      return batch.map(x=>({id:x.saved_search_id,user_id:"qa"}));
    });
    assert.equal(ordinary.length,n,`ordinary publisher changed at ${n}`);
  }
});

test("if early ID chunks have no pending work, later chunks are still examined",async()=>{
  const rows=make(1601);
  let calls=0;
  const pending=await loadPendingDeliveryRows(rows,true,async(batch,limit)=>{
    calls++;
    return batch.filter(x=>Number(x.saved_search_id)>1500)
      .slice(0,limit).map(x=>({id:x.saved_search_id,user_id:"qa"}));
  });
  assert.deepEqual(pending.map(x=>x.id),rows.slice(1500,1513).map(x=>x.saved_search_id));
  assert.ok(calls>=11);
});

test("invalid server responses are rejected instead of falsely marking work complete",async()=>{
  await assert.rejects(loadPendingDeliveryRows(null,true,async()=>[]),TypeError);
  await assert.rejects(loadPendingDeliveryRows(make(1),true,null),TypeError);
  await assert.rejects(loadPendingDeliveryRows(make(2),true,async()=>({})),/Invalid bounded/);
  await assert.rejects(loadPendingDeliveryRows(make(2),true,async()=>Array.from({length:3},()=>({id:"x"}))),/Invalid bounded/);
});

test("matcher uses bounded pending fetches twice; email skip and security gates remain",()=>{
  assert.equal((route.match(/loadPendingDeliveryRows\(/g)||[]).length,2);
  assert.equal((route.match(/for \(const batch of batchAlertItems\(matches\)\)/g)||[]).length,1);
  assert.match(route,/\.order\("id", \{ ascending: true \}\)\.limit\(limit\)/);
  assert.match(route,/\.is\("email_skipped_at", null\)/);
  assert.match(route,/selectDeliveryPage\(pendingNotifications, isOutboxWorker\)/);
  assert.match(route,/selectDeliveryPage\(pendingMatches, isOutboxWorker\)/);
  assert.match(route,/marketplace_alert/);
  assert.match(route,/onConflict: "saved_search_id,listing_id", ignoreDuplicates: true/);
  assert.match(route,/sendTransactionalEmailOnce\(/);
  assert.match(route,/createNotificationOnce\(/);
});
