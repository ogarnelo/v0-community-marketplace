import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the actual gated TypeScript function with injected server imports.
// This never imports Next.js, Supabase SDK or the actual Resend client.
function loadBridge({ providerResult={status:"accepted",providerMessageId:"provider-qa"}, env={} }={}){
  const source=readFileSync("lib/emails/marketplace-alert-intent-gated.ts","utf8")
    .replace(/^import "server-only";\s*/,"");
  const compiled=ts.transpileModule(source,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  },fileName:"marketplace-alert-intent-gated.ts"}).outputText;
  let providerCalls=0, providerMessage=null;
  const exports={};
  const modules={
    "@/lib/emails/saved-search-match-email":{
      buildSavedSearchMatchEmail:p=>{
        providerMessage=p;
        return {to:p.to,subject:"synthetic",html:"<b>QA</b>",text:"QA"};
      },
    },
    "@/lib/emails/brand":{getEmailFrom:()=>env.from??"qa-sender@example.invalid"},
    "@/lib/emails/delivery-idempotency":{hashRecipientEmail:()=> "synthetic-hash"},
    "@/lib/marketplace/alert-email-intent-composition.mjs":{
      deliverPreparedMarketplaceAlert:async p=>{
        providerCalls++;
        assert.equal(p.message.to, "qa-recipient@example.invalid");
        assert.equal(p.message.from,"qa-sender@example.invalid");
        return providerResult;
      },
    },
  };
  runInNewContext(compiled,{
    exports,require:id=>{
      if(!Object.hasOwn(modules,id)) throw Error("Unexpected import "+id);
      return modules[id];
    },
    process:{env:{RESEND_API_KEY:env.apiKey??"synthetic-api-key"}},
    Date,
    Error,
    fetch:async()=>{throw Error("Unexpected real fetch in isolated test");},
  },{filename:"marketplace-alert-intent-gated.ts",timeout:2000});
  return {fn:exports.sendGatedMarketplaceAlertWithIntent,
    providerCalls:()=>providerCalls,providerMessage:()=>providerMessage};
}

function fakeAdmin({oldReceipt=false,suppressed=false,legacyError=false,healthError=false,receiptError=false}={}){
  const rows=[];
  const records=[];
  const admin={
    from(table){
      const row={table};
      rows.push(row);
      const query={
        select(){return query;},
        eq(){return query;},
        async maybeSingle(){
          if(table==="transactional_email_deliveries"){
            return {data:oldReceipt?{provider_message_id:"historical",sent_at:"qa"}:null,
              error:legacyError?new Error("Synthetic select failure"):null};
          }
          if(table==="transactional_email_recipient_health"){
            return {data:suppressed?{is_suppressed:true}:null,
              error:healthError?new Error("Synthetic recipient health failure"):null};
          }
          throw Error("Unexpected lookup "+table);
        },
        async upsert(payload,opts){
          assert.equal(table,"transactional_email_deliveries");
          assert.equal(opts.onConflict,"event_key");
          assert.equal(opts.ignoreDuplicates,true);
          records.push(payload);
          return {error:receiptError?new Error("Synthetic write failure"):null};
        }
      };
      return query;
    },
  };
  return {admin,rows,records};
}
const input={eventKey:"saved-search-match/synthetic-match",userId:"synthetic-user",
  recipientEmail:"qa-recipient@example.invalid",listingId:"synthetic-listing",
  listingTitle:"Sintético"};
const status = v=>JSON.parse(JSON.stringify(v));

test("historical receipt is checked before suppressions, reservations or sending",async()=>{
  const b=loadBridge(), db=fakeAdmin({oldReceipt:true});
  const result=await b.fn(db.admin,input);
  assert.deepEqual(status(result),{sent:true});
  assert.equal(b.providerCalls(),0);
  assert.deepEqual(db.rows.map(r=>r.table),["transactional_email_deliveries"]);
});

test("historical DB failure fails closed without contacting provider",async()=>{
  const b=loadBridge(), db=fakeAdmin({legacyError:true});
  await assert.rejects(b.fn(db.admin,input),/legacy_receipt_lookup_failed/);
  assert.equal(b.providerCalls(),0);
});

test("recipient suppressed: no provider request and no legacy bridge receipt",async()=>{
  const b=loadBridge(), db=fakeAdmin({suppressed:true});
  assert.deepEqual(status(await b.fn(db.admin,input)),{sent:false,reason:"suppressed"});
  assert.equal(b.providerCalls(),0);
  assert.equal(db.records.length,0);
});

test("recipient suppression query fails closed",async()=>{
  const b=loadBridge(), db=fakeAdmin({healthError:true});
  await assert.rejects(b.fn(db.admin,input),/recipient_health_lookup_failed/);
  assert.equal(b.providerCalls(),0);
});

test("missing provider configuration is a retryable skip with no reservation",async()=>{
  const b=loadBridge({env:{apiKey:""}}), db=fakeAdmin();
  assert.deepEqual(status(await b.fn(db.admin,input)),{sent:false,reason:"provider_skipped"});
  assert.equal(b.providerCalls(),0);
});

test("new accepted intent stores legacy compatible receipt before reporting sent",async()=>{
  const b=loadBridge(), db=fakeAdmin();
  const result=await b.fn(db.admin,input);
  assert.deepEqual(status(result),{sent:true});
  assert.equal(b.providerCalls(),1);
  assert.equal(db.records.length,1);
  assert.equal(db.records[0].event_key,input.eventKey);
  assert.equal(db.records[0].provider_message_id,"provider-qa");
  assert.equal(db.records[0].recipient_email_hash,"synthetic-hash");
  assert.equal(db.records[0].recipient_email,undefined);
  assert.equal(b.providerMessage().listingTitle,"Sintético");
});

test("missing confirmation remains review-required without false receipt",async()=>{
  for(const state of ["requires_reconciliation","payload_conflict"]){
    const b=loadBridge({providerResult:{status:state}}), db=fakeAdmin();
    const result=await b.fn(db.admin,input);
    assert.deepEqual(status(result),{sent:false,reason:"requires_reconciliation"});
    assert.equal(b.providerCalls(),1);
    assert.equal(db.records.length,0);
  }
});

test("provider accepted but DB receipt bridge failed: hold for reconciliation without false success",async()=>{
  const b=loadBridge(), db=fakeAdmin({receiptError:true});
  assert.deepEqual(status(await b.fn(db.admin,input)),{sent:false,reason:"requires_reconciliation"});
  assert.equal(b.providerCalls(),1);
  assert.equal(db.records.length,1);
});

test("previous acceptance missing provider ID is quarantined without false legacy receipt",async()=>{
  const b=loadBridge({providerResult:{status:"already_accepted"}}), db=fakeAdmin();
  assert.deepEqual(status(await b.fn(db.admin,input)),{sent:false,reason:"requires_reconciliation"});
  assert.equal(db.records.length,0);
  assert.equal(b.providerCalls(),1);
});

test("previously accepted new intent bridges exact verified provider ID without sending again",async()=>{
  const b=loadBridge({providerResult:{status:"already_accepted",providerMessageId:"synthetic-confirmed-receipt"}}),db=fakeAdmin();
  assert.deepEqual(status(await b.fn(db.admin,input)),{sent:true});
  assert.equal(db.records.length,1);
  assert.equal(db.records[0].provider_message_id,"synthetic-confirmed-receipt");
});
