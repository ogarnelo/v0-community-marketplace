import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const outbox=read("supabase/migrations/20261110111353_marketplace_alert_outbox_v1.sql");
const transactional=read("lib/emails/delivery-idempotency.ts");
const branded=read("lib/emails/brand.ts");
const email=read("lib/emails/saved-search-match-email.ts");
const matcher=read("app/api/marketplace/listings/match-saved-searches/route.ts");

const DAY=24*60*60*1000;

// Synthetic provider model of Resend's DOCUMENTED semantics: keyed responses
// remembered for only 24h; equal request returns cached id; changed request
// is a 409. This is NOT a live provider test or an SDK emulation.
function simulatedResend(){
  const remembered=new Map();
  let sent=0;
  return {
    send({key,payload,at}){
      const prior=remembered.get(key);
      if(prior && at-prior.at<DAY) {
        if(prior.payload!==payload) return {status:409,reason:"invalid_idempotent_request"};
        return {status:200,id:prior.id,duplicate:false};
      }
      const id="synthetic-message-"+(++sent);
      remembered.set(key,{payload,at,id});
      return {status:200,id,duplicate:false};
    },
    count(){return sent;},
  };
}

test("P0: provider can deduplicate same key and immutable payload within 24h",()=>{
  const p=simulatedResend();
  const a=p.send({key:"saved-search-match/uuid1",payload:"fixed-payload",at:0});
  const b=p.send({key:"saved-search-match/uuid1",payload:"fixed-payload",at:DAY-1});
  assert.equal(b.id,a.id);
  assert.equal(p.count(),1);
});

test("P0: same key after provider's 24h retention is NOT sufficient to prevent duplicate",()=>{
  const p=simulatedResend();
  const first=p.send({key:"saved-search-match/uuid1",payload:"fixed-payload",at:0});
  const retry=p.send({key:"saved-search-match/uuid1",payload:"fixed-payload",at:DAY+1});
  assert.notEqual(retry.id,first.id);
  assert.equal(p.count(),2);
  // Intentionally asserts documented exposure; this is a blocking test,
  // NOT a claim that production already delivered duplicates.
});

test("P0: payload mutation between attempts can create 409 even inside 24h",()=>{
  const p=simulatedResend();
  p.send({key:"saved-search-match/uuid1",payload:"title=A",at:0});
  const retry=p.send({key:"saved-search-match/uuid1",payload:"title=B",at:1000});
  assert.deepEqual(retry,{status:409,reason:"invalid_idempotent_request"});
  assert.equal(p.count(),1);
});

test("P0: source contracts show 48h outbox versus 24h provider and mutable listing subject",()=>{
  assert.match(outbox,/48 hours|48 hours|48\s*hours|48 hours|48 hours|48 hours|48 hour|48\s*hour|48\s*hours|48 hours|48\s*hours|48 hours|48 hours|48 hours|48 hours/i);
  assert.match(transactional,/const providerResult = await params\.send\(\)/);
  const sendIndex=transactional.indexOf("const providerResult = await params.send()");
  assert.ok(transactional.indexOf('.upsert(',sendIndex)>sendIndex);
  assert.match(branded,/headers\["Idempotency-Key"\] = params\.idempotencyKey/);
  assert.match(email,/subject: `Nuevo anuncio que coincide con tu búsqueda · \$\{params\.listingTitle\}`/);
  assert.match(matcher,/listingTitle: listing\.title/);
  assert.match(matcher,/const emailEventKey = `saved-search-match\/\$\{match\.id\}`/);
});

test("P0: no auto-worker cron and worker remains explicitly gated",()=>{
  const vercel=JSON.parse(read("vercel.json"));
  assert.equal(vercel.crons.filter(x=>x.path.includes("marketplace-alert-outbox")).length,0);
  assert.match(matcher,/process\.env\.WETUDY_ALERT_OUTBOX_ENABLED === "true"/);
});
