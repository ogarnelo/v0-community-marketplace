import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasRadiusConstraint, partitionLiveRadius }
  from "../../lib/marketplace/alert-live-radius.mjs";

const matcher=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
const migration=readFileSync("supabase/migrations/20261110164742_saved_search_match_delivery_invalidation.sql","utf8");
const fixture=readFileSync("scripts/pilot-marketplace-live-radius-invalidation.sql","utf8");
const make=(i,radius=10)=>({
  id:`match-${i}`,user_id:`user-${i}`,
  saved_searches:{id:`search-${i}`,notifications_enabled:true,radius_km:radius},
});
const approx=(from,to)=>from&&to?(from===to?0:250):undefined;

test("move beyond saved radius invalidates a previously matched alert",()=>{
  const page=[make(1,10),make(2,10),make(3,null)];
  const current=new Map([["user-1","28001"],["user-2","08001"]]);
  const {deliverable,invalidated}=partitionLiveRadius(page,current,"28001",approx);
  assert.deepEqual(deliverable.map(x=>x.id),["match-1","match-3"]);
  assert.deepEqual(invalidated.map(x=>x.id),["match-2"]);
  assert.equal(hasRadiusConstraint(page[2]),false);
});

test("missing, unsupported or malformed postcode fails closed only for radius-constrained searches",()=>{
  const rows=[make(1,5),make(2,5),make(3,null),make(4,0)];
  const current=new Map([["user-1",null],["user-2","99999"],["user-4","28001"]]);
  const {deliverable,invalidated}=partitionLiveRadius(rows,current,"28001",(from,to)=>
    from==="99999"?undefined:approx(from,to));
  assert.deepEqual(deliverable.map(x=>x.id),["match-3","match-4"]);
  assert.deepEqual(invalidated.map(x=>x.id),["match-1","match-2"]);
});

test("boundary radius is inclusive and user moving within range does not lose alert",()=>{
  const [a,b]=[make(1,10),make(2,10)];
  const result=partitionLiveRadius([a,b],
    new Map([["user-1","04001"],["user-2","08001"]]),"28001",
    (from)=>from==="04001"?10:10.1);
  assert.deepEqual(result.deliverable.map(x=>x.id),["match-1"]);
  assert.deepEqual(result.invalidated.map(x=>x.id),["match-2"]);
});

test("disabled/missing saved search fails closed, without sender postcodes",()=>{
  const stale=make(1);
  stale.saved_searches.notifications_enabled=false;
  const missing={id:"missing",user_id:"u",saved_searches:null};
  const res=partitionLiveRadius([stale,missing,make(3,null)],new Map(),"28001",approx);
  assert.deepEqual(res.deliverable.map(x=>x.id),["match-3"]);
  assert.deepEqual(res.invalidated.map(x=>x.id),["match-1","missing"]);
});

test("a bounded page of 12+1 is checked in memory; no whole-audience lookups",()=>{
  const page=Array.from({length:13},(_,i)=>make(i+1,5));
  const codes=new Map(page.map(x=>[x.user_id,"28001"]));
  const result=partitionLiveRadius(page,codes,"28001",approx);
  assert.equal(result.deliverable.length,13);
  assert.equal(result.invalidated.length,0);
  assert.throws(()=>partitionLiveRadius({},codes,"28001",approx),TypeError);
  assert.throws(()=>partitionLiveRadius(page,{},null,approx),TypeError);
});

test("worker rechecks BOTH channels after active-search join and before sending",()=>{
  assert.match(matcher,/hasRadiusConstraint, partitionLiveRadius/);
  assert.match(matcher,/const verifyWorkerRecipients = async \(page: any\[\]\)/);
  assert.equal((matcher.match(/await verifyWorkerRecipients\(/g)||[]).length,2);
  assert.equal((matcher.match(/saved_searches!inner\(id, notifications_enabled, updated_at, radius_km, only_my_community, school_id, directory_school_code\)/g)||[]).length,2);
  assert.equal((matcher.match(/\.is\("invalidated_at", null\)/g)||[]).length,5);
  assert.match(matcher,/\.in\("id", ids\)/);
  assert.match(matcher,/invalidation_reason: stale\.reason/);
  assert.match(matcher,/radiusInvalid\.map/);
  const filterIndex=matcher.indexOf('const notificationPage = await verifyWorkerRecipients');
  const notificationIndex=matcher.indexOf('await createNotificationOnce(');
  const emailFilter=matcher.indexOf('const emailPage = await verifyWorkerRecipients');
  const emailSend=matcher.indexOf('await sendTransactionalEmailOnce(');
  assert.ok(filterIndex>=0 && filterIndex<notificationIndex);
  assert.ok(emailFilter>=0 && emailFilter<emailSend);
  assert.match(matcher,/process\.env\.WETUDY_ALERT_OUTBOX_ENABLED === "true"/);
});

test("invalidation marker is private, PII-free and makes both delivery channels terminal",()=>{
  assert.match(migration,/alter table public\.saved_search_matches/);
  assert.match(migration,/add column if not exists invalidated_at timestamptz/);
  assert.match(migration,/add column if not exists invalidation_reason text/);
  assert.match(migration,/radius_changed/);
  assert.doesNotMatch(migration.replace(/^--.*$/gm,""),/grant (select|insert|update)|postal_code|user_email/i);
  assert.match(fixture,/Invalidated recipient appeared in a pending notification query/);
  assert.match(fixture,/Invalidated recipient appeared in a pending email query/);
});
