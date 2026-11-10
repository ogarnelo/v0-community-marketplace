import test from "node:test";
import assert from "node:assert/strict";
import { hashProviderPayload, deliverWithIntent } from "../../lib/marketplace/alert-email-intent-delivery.mjs";
import { readFileSync } from "node:fs";
const key="saved-search-match/qa-fixture";
const body=JSON.stringify({to:["synthetic@example.invalid"],subject:"Test",html:"<b>x</b>"});
function dbMock({ failAccept=false, failAmbiguous=false }={}){
  const items=new Map();
  let beginCalls=0;
  const db={async rpc(name,p){
    const rec=items.get(p.p_event_key);
    if(name==="marketplace_alert_email_prepare_v1"){
      if(!rec){
        items.set(p.p_event_key,{hash:p.p_payload_sha256,token:"test-token",state:"prepared"});
        return {data:[{outcome:"prepared",intent_token:"test-token"}],error:null};
      }
      return {data:[{outcome:rec.hash===p.p_payload_sha256?rec.state:"payload_conflict",
        intent_token:rec.hash===p.p_payload_sha256?rec.token:null}],error:null};
    }
    if(name==="marketplace_alert_email_begin_v1"){
      beginCalls++;
      if(!rec||rec.state!=="prepared"||rec.hash!==p.p_payload_sha256||rec.token!==p.p_token)
        return {data:false,error:null};
      rec.state="sending";return {data:true,error:null};
    }
    if(name==="marketplace_alert_email_accept_v1"){
      if(failAccept)return {data:false,error:new Error("Synthetic DB failure")};
      if(!rec||rec.state!=="sending"||rec.token!==p.p_token)return {data:false,error:null};
      rec.state="accepted";return {data:true,error:null};
    }
    if(name==="marketplace_alert_email_ambiguous_v1"){
      if(failAmbiguous)throw Error("Synthetic DB outage");
      if(rec?.state==="sending")rec.state="ambiguous";
      return {data:true,error:null};
    }
    throw Error("Unrecognized RPC "+name);
  }};
  return {db,items,beginCount:()=>beginCalls};
}

test("exact provider bytes are hashed, different payloads produce different digests",()=>{
  assert.match(hashProviderPayload(body),/^[a-f0-9]{64}$/);
  assert.notEqual(hashProviderPayload(body),hashProviderPayload(body+" "));
  assert.throws(()=>hashProviderPayload({}),TypeError);
});

test("successful send is durable and replay never contacts provider",async()=>{
  const m=dbMock();let calls=0;
  const send=async ({eventKey,requestBody})=>{
    assert.equal(eventKey,key);assert.equal(requestBody,body);calls++;
    return {id:"provider-synthetic-id"};};
  assert.equal((await deliverWithIntent(m.db,{eventKey:key,requestBody:body,send})).status,"accepted");
  assert.equal((await deliverWithIntent(m.db,{eventKey:key,requestBody:body,send})).status,"already_accepted");
  assert.equal(calls,1);
});

test("changed subject or email body cannot reuse the same event key",async()=>{
  const m=dbMock();let calls=0;
  const send=async()=>{calls++;return {id:"provider-fixture"}};
  await deliverWithIntent(m.db,{eventKey:key,requestBody:body,send});
  const result=await deliverWithIntent(m.db,{eventKey:key,requestBody:body+" edited",send});
  assert.equal(result.status,"payload_conflict");assert.equal(calls,1);
});

test("provider timeout is quarantined; repeated execution cannot resend at 48 hours",async()=>{
  const m=dbMock();let calls=0;
  const send=async()=>{calls++;throw Error("Injected timeout with ambiguous acceptance")};
  assert.equal((await deliverWithIntent(m.db,{eventKey:key,requestBody:body,send})).status,"requires_reconciliation");
  assert.equal(m.items.get(key).state,"ambiguous");
  assert.equal((await deliverWithIntent(m.db,{eventKey:key,requestBody:body,send})).status,"requires_reconciliation");
  assert.equal(calls,1);
});

test("DB cannot record provider acceptance: sending state stays blocked",async()=>{
  const m=dbMock({failAccept:true});let calls=0;
  const send=async()=>{calls++;return {id:"provider-synthetic-id"};};
  assert.equal((await deliverWithIntent(m.db,{eventKey:key,requestBody:body,send})).status,"requires_reconciliation");
  assert.equal(m.items.get(key).state,"sending");
  assert.equal((await deliverWithIntent(m.db,{eventKey:key,requestBody:body,send})).status,"requires_reconciliation");
  assert.equal(calls,1);
});

test("missing provider ID / skipped request never becomes accepted",async()=>{
  for(const response of [{skipped:true},{}]){
    const m=dbMock();let calls=0;
    const r=await deliverWithIntent(m.db,{eventKey:key,requestBody:body,send:async()=>{calls++;return response;}});
    assert.equal(r.status,"requires_reconciliation");assert.equal(calls,1);
    assert.notEqual(m.items.get(key).state,"accepted");
  }
});

test("two concurrent deliveries acquire only one durable begin",async()=>{
  const m=dbMock();let calls=0;
  const send=async()=>{calls++;await Promise.resolve();return {id:"p"};};
  await Promise.all([deliverWithIntent(m.db,{eventKey:key,requestBody:body,send}),
    deliverWithIntent(m.db,{eventKey:key,requestBody:body,send})]);
  assert.equal(calls,1);assert.equal(m.items.get(key).state,"accepted");
});

test("not wired into production route; no worker cron or feature activation",()=>{
  const route=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
  const vercel=JSON.parse(readFileSync("vercel.json","utf8"));
  assert.doesNotMatch(route,/alert-email-intent-delivery/);
  assert.match(route,/WETUDY_ALERT_OUTBOX_ENABLED === "true"/);
  assert.equal(vercel.crons.filter(c=>c.path.includes("marketplace-alert-outbox")).length,0);
});
