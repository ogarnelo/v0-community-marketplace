import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Import and execute the EXISTING production function in isolation, not a
// copied implementation. Only remove Next.js's server-only marker for Node.
const source=readFileSync("lib/emails/delivery-idempotency.ts","utf8")
  .replace(/^import "server-only";\s*/,"");
const js=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
  fileName:"delivery-idempotency.ts",
}).outputText;
const {sendTransactionalEmailOnce,hashRecipientEmail}=
  await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));

function fakeSupabase({failRecordOnce=false,suppressed=false}={}){
  const deliveries=new Map();
  const health=new Map();
  if(suppressed)health.set(hashRecipientEmail("qa@example.invalid"),{
    is_suppressed:true,suppression_reason:"bounce",
  });
  let fail=failRecordOnce;
  const db={
    from(table){
      const predicates={};
      const q={
        select(){return q;},
        eq(k,v){predicates[k]=v;return q;},
        async maybeSingle(){
          if(table==="transactional_email_deliveries"){
            return {data:deliveries.get(predicates.event_key)||null,error:null};
          }
          if(table==="transactional_email_recipient_health"){
            return {data:health.get(predicates.recipient_email_hash)||null,error:null};
          }
          throw Error("Unexpected read "+table);
        },
        async upsert(row,opts){
          assert.equal(table,"transactional_email_deliveries");
          assert.deepEqual(opts,{onConflict:"event_key",ignoreDuplicates:true});
          if(fail){fail=false;return {error:new Error("Injected DB failure")};}
          if(!deliveries.has(row.event_key))deliveries.set(row.event_key,row);
          return {error:null};
        },
      };
      return q;
    },
  };
  return {db,deliveries,health};
}
const common={eventKey:"saved-search-match/match-qa-1",userId:"qa-id",
  recipientEmail:" QA@example.invalid ",kind:"saved_search_match"};

test("QA: first delivery persisted, identical retry never contacts provider",async()=>{
  const {db,deliveries}=fakeSupabase();
  let providerCalls=0;
  const send=async()=>{providerCalls++;return {id:"provider-qa-1"};};
  const one=await sendTransactionalEmailOnce(db,{...common,send});
  const two=await sendTransactionalEmailOnce(db,{...common,send});
  assert.deepEqual({sent:one.sent,alreadySent:one.alreadySent},{sent:true,alreadySent:false});
  assert.deepEqual({sent:two.sent,alreadySent:two.alreadySent},{sent:true,alreadySent:true});
  assert.equal(providerCalls,1);
  assert.equal(deliveries.size,1);
  const stored=deliveries.get(common.eventKey);
  assert.equal(stored.recipient_email_hash,hashRecipientEmail("qa@example.invalid"));
  assert.equal(stored.provider_message_id,"provider-qa-1");
  assert.equal(JSON.stringify(stored).includes("QA@example.invalid"),false);
});

test("QA: provider error cannot falsely record delivery; retry succeeds once",async()=>{
  const {db,deliveries}=fakeSupabase();
  let calls=0;
  const send=async()=>{calls++;if(calls===1)throw new Error("Injected provider failure");
    return {id:"provider-ok"};};
  await assert.rejects(sendTransactionalEmailOnce(db,{...common,send}),/Injected provider failure/);
  assert.equal(deliveries.size,0);
  const result=await sendTransactionalEmailOnce(db,{...common,send});
  assert.equal(result.sent,true);
  assert.equal(result.alreadySent,false);
  assert.equal(calls,2);
  assert.equal(deliveries.size,1);
});

test("QA: provider accepted but database acknowledgement failed: provider key makes retry deduplicable",async()=>{
  const {db,deliveries}=fakeSupabase({failRecordOnce:true});
  let calls=0, accepted=0;
  const providerSeen=new Map();
  const send=async()=>{
    calls++;
    const key=common.eventKey; // same key passed to sendBrandedEmail in production
    if(!providerSeen.has(key)){accepted++;providerSeen.set(key,"provider-qa-1");}
    return {id:providerSeen.get(key)};
  };
  await assert.rejects(sendTransactionalEmailOnce(db,{...common,send}),/Injected DB failure/);
  assert.equal(deliveries.size,0);
  const recovered=await sendTransactionalEmailOnce(db,{...common,send});
  assert.equal(recovered.sent,true);
  assert.equal(calls,2);
  assert.equal(accepted,1);
  assert.equal(deliveries.size,1);
  // This is a MOCK of provider idempotency; not proof Resend will dedupe live.
});

test("QA: locally suppressed email is never passed to provider or recorded as sent",async()=>{
  const {db,deliveries}=fakeSupabase({suppressed:true});
  let calls=0;
  const result=await sendTransactionalEmailOnce(db,{...common,send:async()=>{
    calls++;return {id:"unexpected"};}});
  assert.equal(result.sent,false);
  assert.equal(result.reason,"suppressed");
  assert.equal(calls,0);
  assert.equal(deliveries.size,0);
});

test("QA: missing API credentials/provider skip cannot be recorded as sent",async()=>{
  const {db,deliveries}=fakeSupabase();
  const result=await sendTransactionalEmailOnce(db,{...common,
    send:async()=>({skipped:true})});
  assert.equal(result.sent,false);
  assert.equal(result.reason,"provider_skipped");
  assert.equal(deliveries.size,0);
});

test("QA: separate match keys do not suppress distinct alert deliveries",async()=>{
  const {db,deliveries}=fakeSupabase();
  let calls=0;
  for(const eventKey of ["saved-search-match/one","saved-search-match/two"]){
    const result=await sendTransactionalEmailOnce(db,{...common,eventKey,send:async()=>({
      id:"provider-"+(++calls),
    })});
    assert.equal(result.sent,true);
  }
  assert.equal(calls,2);
  assert.equal(deliveries.size,2);
});
