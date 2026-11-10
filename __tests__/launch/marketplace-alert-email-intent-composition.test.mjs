import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deliverPreparedMarketplaceAlert } from "../../lib/marketplace/alert-email-intent-composition.mjs";

const eventKey="saved-search-match/synthetic-case";
const message={
  from:"Wetudy <sender@example.invalid>",
  to:"family@example.invalid",
  subject:"Alerta original",html:"<b>Alerta original</b>",
  text:"Alerta original",
};
function mock({legacy=false,failLegacy=false,failAccept=false}={}){
  const intents=new Map();let reservations=0;
  const db={
    from(name){
      assert.equal(name,"transactional_email_deliveries");
      const query={
        select(){return query;},
        eq(){return query;},
        async maybeSingle(){
          if(failLegacy)return {data:null,error:Error("synthetic DB error")};
          return {data:legacy?{sent_at:"2026-11-10"}:null,error:null};
        }
      };
      return query;
    },
    async rpc(name,p){
      if(name==="marketplace_alert_email_prepare_v1"){
        reservations++;
        const prior=intents.get(p.p_event_key);
        if(prior)return {data:[{outcome:prior.hash===p.p_payload_sha256?prior.state:"payload_conflict",intent_token:prior.token}],error:null};
        intents.set(p.p_event_key,{hash:p.p_payload_sha256,token:"synthetic-token",state:"prepared"});
        return {data:[{outcome:"prepared",intent_token:"synthetic-token"}],error:null};
      }
      const rec=intents.get(p.p_event_key);
      if(name==="marketplace_alert_email_begin_v1"){
        if(rec.state!=="prepared"||rec.token!==p.p_token)return {data:false,error:null};
        rec.state="sending";return {data:true,error:null};
      }
      if(name==="marketplace_alert_email_accept_v1"){
        if(failAccept)return {data:false,error:Error("synthetic acknowledgement lost")};
        rec.state="accepted";return {data:true,error:null};
      }
      if(name==="marketplace_alert_email_ambiguous_v1"){
        rec.state="ambiguous";return {data:true,error:null};
      }
      throw Error(name);
    }
  };
  return {db,intents,reservations:()=>reservations};
}
const run=(m,fetchImpl,other={})=>deliverPreparedMarketplaceAlert({
  db:m.db,eventKey,message:{...message,...other},
  apiKey:"synthetic-server-key",fetchImpl,
});
test("composed flow hashes and sends one unchanged payload, then blocks replay",async()=>{
  const m=mock();let calls=0;
  const send=async(_url,opts)=>{
    calls++;
    assert.equal(opts.headers["Idempotency-Key"],eventKey);
    assert.deepEqual(JSON.parse(opts.body),{
      from:message.from,to:[message.to],subject:message.subject,
      html:message.html,text:message.text,
    });
    return {ok:true,json:async()=>({id:"synthetic-provider"})};
  };
  assert.equal((await run(m,send)).status,"accepted");
  assert.equal((await run(m,send)).status,"already_accepted");
  assert.equal(calls,1);
});
test("historical receipt short-circuits all new intents and provider calls",async()=>{
  const m=mock({legacy:true});let calls=0;
  assert.equal((await run(m,async()=>{calls++;return {ok:true}})).status,"already_accepted");
  assert.equal(m.reservations(),0);
  assert.equal(calls,0);
});
test("historical query failure is fail-closed even when provider callback exists",async()=>{
  const m=mock({failLegacy:true});let calls=0;
  await assert.rejects(run(m,async()=>{calls++;return {ok:true}}),/legacy_receipt_lookup_failed/);
  assert.equal(calls,0);assert.equal(m.reservations(),0);
});
test("provider timeout leaves an ambiguous intent, never resends at a later execution",async()=>{
  const m=mock();let calls=0;
  const send=async()=>{calls++;throw Error("Simulated timeout");};
  assert.equal((await run(m,send)).status,"requires_reconciliation");
  assert.equal((await run(m,send)).status,"requires_reconciliation");
  assert.equal(calls,1);
});
test("subject changed after a failed send cannot be replayed using the old key",async()=>{
  const m=mock();let calls=0;
  const send=async()=>{calls++;throw Error("Network failure");};
  assert.equal((await run(m,send)).status,"requires_reconciliation");
  assert.equal((await run(m,send,{subject:"Nuevo asunto"})).status,"payload_conflict");
  assert.equal(calls,1);
});
test("provider response 409 and missing ID do not become successful sends",async()=>{
  for(const response of [
    {ok:false,status:409},
    {ok:true,json:async()=>({})},
  ]){
    const m=mock();let calls=0;
    const result=await run(m,async()=>{calls++;return response;});
    assert.equal(result.status,"requires_reconciliation");
    assert.equal(calls,1);
    assert.notEqual(m.intents.get(eventKey).state,"accepted");
  }
});
test("DB acknowledgement failure after provider success prevents duplicate retry",async()=>{
  const m=mock({failAccept:true});let calls=0;
  const send=async()=>{calls++;return {ok:true,json:async()=>({id:"provider-ok"})}};
  assert.equal((await run(m,send)).status,"requires_reconciliation");
  assert.equal((await run(m,send)).status,"requires_reconciliation");
  assert.equal(calls,1);
});
test("composition is not imported by live matcher and does not enable worker",()=>{
  const route=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
  const vercel=JSON.parse(readFileSync("vercel.json","utf8"));
  assert.doesNotMatch(route,/alert-email-intent-composition/);
  assert.match(route,/WETUDY_ALERT_OUTBOX_ENABLED === "true"/);
  assert.equal(vercel.crons.filter(x=>x.path.includes("marketplace-alert-outbox")).length,0);
});
