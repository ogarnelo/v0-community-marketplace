import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source=readFileSync("app/api/cron/marketplace-alert-outbox/route.ts","utf8");
const matcher=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
const vercel=JSON.parse(readFileSync("vercel.json","utf8"));

function runWorker({workerFlag="true",intentFlag="true",
  intentsReady=true,reviewReady=true,auth="Bearer synthetic-qa-cron"}={}){
  let dbCreated=0, claimed=0, fetchCalls=0;
  const db={
    from(table){
      assert.equal(table,"marketplace_alert_email_intents");
      const q={select(){return q;},
        async limit(number){
          assert.equal(number,0);
          return {data:[],error:intentsReady?null:new Error("missing table")};
        },
      };
      return q;
    },
    async rpc(name){
      if(name==="marketplace_alert_review_count_v1")
        return {data:0,error:reviewReady?null:new Error("missing review RPC")};
      if(name==="marketplace_alert_claim_outbox_v1"){
        claimed++;
        return {data:[],error:null};
      }
      throw Error("Unexpected RPC "+name);
    },
  };
  const compiled=ts.transpileModule(source,{compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
  }}).outputText;
  const exports={};
  runInNewContext(compiled,{
    exports,
    require(id){
      assert.equal(id,"@/lib/supabase/admin");
      return {createAdminClient:()=>{dbCreated++;return db;}};
    },
    process:{env:{
      CRON_SECRET:"synthetic-qa-cron",
      WETUDY_ALERT_OUTBOX_ENABLED:workerFlag,
      WETUDY_ALERT_INTENT_DELIVERY_ENABLED:intentFlag,
    }},
    Response,Request,AbortSignal,
    fetch:async()=>{fetchCalls++;throw Error("Network forbidden in isolated worker test");},
    console:{error(){}},
  },{timeout:1000});
  const request=new Request("https://www.wetudy.com/api/cron/marketplace-alert-outbox",{
    headers:{"authorization":auth},
  });
  return {response:exports.GET(request),calls:()=>({dbCreated,claimed,fetchCalls})};
}

test("either rollout flag missing returns 204 before any database or email action",async()=>{
  for(const flags of [
    {workerFlag:"false",intentFlag:"true"},
    {workerFlag:"true",intentFlag:"false"},
    {workerFlag:"true",intentFlag:""},
  ]){
    const w=runWorker(flags);
    const response=await w.response;
    assert.equal(response.status,204);
    assert.deepEqual(w.calls(),{dbCreated:0,claimed:0,fetchCalls:0});
  }
});

test("invalid cron signature returns 401 even with both flags enabled",async()=>{
  const w=runWorker({auth:"Bearer wrong"});
  assert.equal((await w.response).status,401);
  assert.deepEqual(w.calls(),{dbCreated:0,claimed:0,fetchCalls:0});
});

test("missing intent table stops before any job claim",async()=>{
  const w=runWorker({intentsReady:false});
  const res=await w.response;
  assert.equal(res.status,503);
  assert.equal((await res.json()).error,"email_schema_not_ready");
  assert.deepEqual(w.calls(),{dbCreated:1,claimed:0,fetchCalls:0});
});

test("missing review RPC stops before any job claim",async()=>{
  const w=runWorker({reviewReady:false});
  const res=await w.response;
  assert.equal(res.status,503);
  assert.equal((await res.json()).error,"review_schema_not_ready");
  assert.deepEqual(w.calls(),{dbCreated:1,claimed:0,fetchCalls:0});
});

test("both schemas present: a no-job invocation is successful without provider call",async()=>{
  const w=runWorker();
  const res=await w.response;
  assert.equal(res.status,200);
  const body=await res.json();
  assert.deepEqual(body,{ok:true,claimed:0});
  assert.deepEqual(w.calls(),{dbCreated:1,claimed:1,fetchCalls:0});
});

test("matcher cannot treat one legacy flag as a signed outbox worker",()=>{
  assert.match(matcher,/const isOutboxWorker = process\.env\.WETUDY_ALERT_OUTBOX_ENABLED === "true" &&\s*process\.env\.WETUDY_ALERT_INTENT_DELIVERY_ENABLED === "true"/);
  assert.match(matcher,/request\.headers\.get\("x-wetudy-alert-outbox"\) === "1"/);
  assert.match(matcher,/\.gt\("lease_until", new Date\(\)\.toISOString\(\)\)/);
  assert.equal(vercel.crons.filter(x=>x.path.includes("marketplace-alert-outbox")).length,0);
});
