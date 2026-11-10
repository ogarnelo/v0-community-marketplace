import test from "node:test";
import assert from "node:assert/strict";
import { summarizeDiscoveryPage, WORKER_DISCOVERY_PAGE_SIZE } from "../../lib/marketplace/alert-discovery-page.mjs";
import { selectDeliveryPage, summarizeDeliveryProgress, WORKER_RECIPIENT_BATCH_SIZE } from "../../lib/marketplace/alert-delivery-progress.mjs";
import { codesForLiveSchoolPage, partitionLiveSchool } from "../../lib/marketplace/alert-live-school.mjs";
import { partitionLiveRadius } from "../../lib/marketplace/alert-live-radius.mjs";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts", "utf8");
const cron = JSON.parse(readFileSync("vercel.json", "utf8"));
const s1="00000000-0000-4000-8000-000000000001";
const s2="00000000-0000-4000-8000-000000000002";
const row=(id, overrides={})=>({
  id, user_id:"user-"+id,
  saved_searches:{
    notifications_enabled:true, only_my_community:true,
    school_id:s1, directory_school_code:null, radius_km:10,
    ...overrides,
  },
});
// Intentionally restricted to school criteria, just like the production route
// supplies savedSearchMatchesListing() with radius removed.
const matchSchool=(search,listing,_km,links)=>{
  if(!search.only_my_community) return true;
  if(search.directory_school_code) {
    if(listing.directory_school_code) return search.directory_school_code===listing.directory_school_code;
    return !!links.savedDirectoryLinkedSchoolId && links.savedDirectoryLinkedSchoolId===listing.school_id;
  }
  if(search.school_id){
    if(listing.directory_school_code) return !!links.listingDirectoryLinkedSchoolId && links.listingDirectoryLinkedSchoolId===search.school_id;
    return search.school_id===listing.school_id;
  }
  return false;
};

test("QA A2/A3/A4/A5/A6: school validation precedes postcode validation, global alerts stay eligible",()=>{
  const listing={school_id:s1,directory_school_code:null};
  const candidates=[
    row("ok"),
    row("moved"),
    row("missing"),
    row("school-changed",{school_id:s2}),
    row("global",{only_my_community:false,radius_km:null}),
  ];
  const codes=codesForLiveSchoolPage(candidates,listing);
  assert.deepEqual(codes,[]);
  const school=partitionLiveSchool(candidates,listing,new Map(),matchSchool);
  assert.deepEqual(school.invalidated.map(x=>x.id),["school-changed"]);
  const current=new Map([["user-ok","28001"],["user-moved","08001"]]);
  const distance=(from,to)=> !from||!to ? undefined : from===to ? 0 : 500;
  const radius=partitionLiveRadius(school.deliverable,current,"28001",distance);
  assert.deepEqual(radius.deliverable.map(x=>x.id),["ok","global"]);
  assert.deepEqual(radius.invalidated.map(x=>x.id),["moved","missing"]);
  assert.equal([...school.invalidated,...radius.invalidated].length,3);
});

test("QA A8/A10: 3003 synthetic searches use bounded cursor pages, including exact 200 boundary",()=>{
  // UUID-like sorted keys reflect the real keyset cursor rule, no database IO.
  const ids=Array.from({length:3003},(_,i)=>String(i+1).padStart(8,"0")+"-0000-4000-8000-000000000000");
  let cursor=null, pages=0, scanned=0, complete=false;
  while(!complete){
    const next=ids.filter(x=>cursor===null||x>cursor).slice(0,WORKER_DISCOVERY_PAGE_SIZE);
    const checkpoint=summarizeDiscoveryPage(next.map(id=>({id})),cursor);
    cursor=checkpoint.nextCursor;
    scanned+=checkpoint.scanned;
    pages++;
    complete=checkpoint.complete;
    assert.ok(pages<30);
  }
  assert.equal(scanned,3003);
  assert.equal(pages,16);
  assert.equal(cursor,ids.at(-1));
  const exact=Array.from({length:200},(_,i)=>({id:ids[i]}));
  assert.equal(summarizeDiscoveryPage(exact,null).complete,false);
  assert.equal(summarizeDiscoveryPage([],ids[199]).complete,true);
  assert.throws(()=>summarizeDiscoveryPage([{id:ids[1]},{id:ids[0]}],null));
});

test("QA A9/A10: 3003 recipients can progress through 12+1 pages without audience truncation",()=>{
  let remaining=3003, notified=0, executions=0;
  while(remaining>0){
    const pending=Array.from({length:Math.min(remaining,WORKER_RECIPIENT_BATCH_SIZE+1)},(_,i)=>({id:"recipient-"+(notified+i)}));
    const page=selectDeliveryPage(pending,true);
    assert.ok(page.length<=12);
    const progress=summarizeDeliveryProgress({
      isWorker:true,pendingNotifications:pending.length,notificationPage:page.length,
      pendingEmails:pending.length,emailPage:page.length,emailFailures:0,
    });
    notified+=page.length;
    remaining-=page.length;
    executions++;
    if(remaining>0) assert.equal(progress.complete,remaining===0);
    assert.ok(executions<300);
  }
  assert.equal(notified,3003);
  assert.equal(executions,251);
  const retry=summarizeDeliveryProgress({isWorker:true,pendingNotifications:1,notificationPage:1,pendingEmails:1,emailPage:1,emailFailures:1});
  assert.equal(retry.complete,false);
  assert.equal(retry.failed,true);
});

test("QA activation safety: recovery is gated; no outbox cron; recipient checks run for both channels",()=>{
  assert.equal(cron.crons.filter(x=>x.path.includes("marketplace-alert-outbox")).length,0);
  assert.match(route,/process\.env\.WETUDY_ALERT_OUTBOX_ENABLED === "true"/);
  assert.equal((route.match(/await verifyWorkerRecipients\(/g)||[]).length,2);
  assert.equal((route.match(/\.lte\("saved_searches\.updated_at", listing\.created_at\)/g)||[]).length,2);
  assert.equal((route.match(/\.eq\("saved_searches\.notifications_enabled", true\)/g)||[]).length,2);
});
