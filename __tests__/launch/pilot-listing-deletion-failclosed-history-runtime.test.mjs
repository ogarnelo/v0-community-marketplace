import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const id="22222222-2222-4222-8222-222222222222";
const uid="11111111-1111-4111-8111-111111111111";
const source=readFileSync("app/api/listings/delete/route.ts","utf8");
const history=["payment_intents","listing_offers","donation_requests","conversations","reports","agreements",
 "shipments","reviews","moderation_flags","transaction_issues","listing_boosts"];
function harness({guest=false,authFails=false,listingOwner=uid,listingReadFails=false,
  historyRow=null,historyError=null,blocker=null,mutationFails=null,zeroRows=false}={}){
 const steps=[];
 const from=table=>{
   let action="select", filters={};
   const q=new Proxy({}, {get(_t,k){
     if(k==="select")return()=>{if(action==="select"){};return q};
     if(k==="eq")return(col,value)=>{filters[col]=value;return q};
     if(k==="in")return(col,values)=>{filters[col]=values;return q};
     if(k==="update")return()=>{action="update";steps.push("update:"+table);return q};
     if(k==="delete")return()=>{action="delete";steps.push("delete:"+table);return q};
     const output=()=>{
       if(table==="listings"){
         if(action==="update"||action==="delete")
           return {data:zeroRows?null:{id},error:mutationFails===action?{message:"PRIVATE_SQL"}:null};
         return {data:listingOwner?{id,seller_id:listingOwner,status:"available"}:null,
           error:listingReadFails?{message:"PRIVATE_LISTING_SQL"}:null};
       }
       steps.push("check:"+table);
       const blocked=blocker==="payments"&&table==="payment_intents"&&Array.isArray(filters.status)
         ||blocker==="offers"&&table==="listing_offers"&&filters.status==="accepted"
         ||blocker==="donation"&&table==="donation_requests"&&filters.status==="approved";
       return {data:blocked||historyRow===table?[{id:"history"}]:[],
         error:historyError===table?{message:"PRIVATE_HISTORY_SQL"}:null};
     };
     if(k==="maybeSingle")return async()=>output();
     if(k==="then")return(resolve,reject)=>Promise.resolve(output()).then(resolve,reject);
     return()=>q;
   }});
   return q;
 };
 const admin={from};
 const supabase={auth:{getUser:async()=>({
  data:{user:guest?null:{id:uid}},error:authFails?{message:"PRIVATE_AUTH"}:null
 })}};
 const mocks={
  "next/server":{NextResponse:{json:(data,options={})=>new Response(JSON.stringify(data),{
    status:options.status??200,headers:options.headers??{}
  })}},
  "@/lib/supabase/server":{createClient:async()=>supabase},
  "@/lib/supabase/admin":{createAdminClient:()=>{steps.push("ADMIN_CREATED");return admin}}
 };
 const code=ts.transpileModule(source,{fileName:"delete-route.ts",reportDiagnostics:true,
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 assert.equal((code.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const exp={};const logs=[];
 vm.runInNewContext(code.outputText,{exports:exp,require:k=>mocks[k]??{},Request,Response,Promise,
   console:{error:(...args)=>logs.push(args)}},{filename:"delete-route.ts",timeout:1500});
 return {steps,logs,run:async(listingId=id)=>{
  const res=await exp.POST(new Request("https://fixture.invalid/api/listings/delete",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({listingId})
  }));
  return{status:res.status,cache:res.headers.get("cache-control"),json:await res.json()};
 }};
}
test("guest, invalid UUID or Auth failure cannot create admin client",async()=>{
 for(const opts of [{guest:true},{authFails:true},{}]){
  const f=harness(opts);const r=await f.run(opts.guest||opts.authFails?id:"not-a-uuid");
  assert.equal(r.status,opts.authFails?503:opts.guest?401:400);
  assert.equal(r.cache,"private, no-store");
  assert.equal(f.steps.includes("ADMIN_CREATED"),false);
 }
});
test("seller mismatch never loads child histories or mutates data",async()=>{
 const f=harness({listingOwner:"someone-else"});const r=await f.run();
 assert.equal(r.status,403);assert.equal(f.steps.some(x=>x.startsWith("check:")),false);
 assert.equal(f.steps.some(x=>x.startsWith("delete:")),false);
});
test("database listing lookup errors return 503 instead of a false 404",async()=>{
 const f=harness({listingReadFails:true});const r=await f.run();
 assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(r.json),/PRIVATE_/);
 assert.equal(f.steps.some(x=>x.startsWith("delete:")),false);
});
for(const table of history){
 test("existing "+table+" history archives rather than cascades",async()=>{
  const f=harness({historyRow:table});const r=await f.run();
  assert.equal(r.status,200);
  assert.equal(r.json.mode,"archived");
  assert.equal(f.steps.filter(x=>x.startsWith("update:")).length,1);
  assert.equal(f.steps.filter(x=>x.startsWith("delete:")).length,0);
 });
 test("error checking "+table+" must prevent all writes",async()=>{
  const f=harness({historyError:table});const r=await f.run();
  assert.equal(r.status,503);
  assert.equal(r.cache,"private, no-store");
  assert.equal(f.steps.some(x=>x.startsWith("update:")||x.startsWith("delete:")),false);
  assert.doesNotMatch(JSON.stringify(r.json),/PRIVATE_/);
 });
}
for(const blocker of ["payments","offers","donation"]){
 test("active "+blocker+" blocks deletion and archival",async()=>{
  const f=harness({blocker});const r=await f.run();
  assert.equal(r.status,409);
  assert.equal(f.steps.some(x=>x.startsWith("update:")||x.startsWith("delete:")),false);
 });
}
test("no history deletes parent only; FK cascade owns dependent records",async()=>{
 const f=harness();const r=await f.run();
 assert.equal(r.status,200);assert.equal(r.json.mode,"deleted");
 assert.deepEqual(f.steps.filter(x=>x.startsWith("delete:")),["delete:listings"]);
});
test("error deleting parent leaves photo and favorite children untouched",async()=>{
 const f=harness({mutationFails:"delete"});const r=await f.run();
 assert.equal(r.status,503);assert.equal(r.cache,"private, no-store");
 assert.deepEqual(f.steps.filter(x=>x.startsWith("delete:")),["delete:listings"]);
 assert.equal(f.steps.some(x=>x.startsWith("update:")),false);
 assert.doesNotMatch(JSON.stringify(r.json),/PRIVATE_/);
});
test("zero rows affected never returns success",async()=>{
 const f=harness({zeroRows:true});const r=await f.run();
 assert.equal(r.status,503);
});
test("archive failure or zero affected rows cannot confirm archiving",async()=>{
 for(const opts of [{mutationFails:"update"},{zeroRows:true}]){
  const f=harness({...opts,historyRow:"agreements"});const r=await f.run();
  assert.equal(r.status,503);
  assert.equal(f.steps.some(x=>x.startsWith("delete:")),false);
 }
});
test("no privileged diagnostic is reflected into HTTP response",()=>{
 assert.doesNotMatch(source,/\.message\s*\|\||error\?\.details|catch \(error/);
 assert.doesNotMatch(source,/Promise\.allSettled/);
 assert.doesNotMatch(source,/from\("listing_photos"\)\.delete/);
});
