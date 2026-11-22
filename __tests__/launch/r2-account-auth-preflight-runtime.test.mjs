import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const USER="11111111-1111-4111-8111-111111111111";
function fixture({authUnavailable=false,authThrows=false,recheckUnavailable=false,authWriteError=false}={}){
 const events=[];
 const profile={user_type:"parent"};
 const ctx={id:"22222222-2222-4222-8222-222222222222",relationship:"guardian",alias:null,is_primary:true,active:true};
 let authReads=0;
 const admin={
   auth:{admin:{
     getUserById:async()=>{events.push("AUTH_LOOKUP");authReads++;
       if(authThrows)throw Error("PRIVATE_AUTH_EXCEPTION");
       if(authUnavailable||recheckUnavailable&&authReads>1)return {data:{user:null},error:{message:"PRIVATE_AUTH_UNAVAILABLE"}};
       return {data:{user:{id:USER,user_metadata:{display_name:"Family"}}},error:null};
     },
     updateUserById:async(_uid,payload)=>{events.push("AUTH_UPDATE");assert.equal(payload.user_metadata.display_name,"Family");
       return {error:authWriteError?{message:"PRIVATE_AUTH_WRITE"}:null};
     }
   }},
   from:(table)=>{
     let mode="read",filters=[],dataToWrite={};
     const q={
       select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},order:()=>q,
       update:(v)=>{mode="write";dataToWrite=v;events.push("DB_WRITE:"+table);return q;},
       maybeSingle:async()=>{
         if(mode==="read")return {data:table==="profiles"?{...profile}:{...ctx},error:null};
         if(table==="profiles"){profile.user_type=dataToWrite.user_type;return {data:{id:USER},error:null};}
         Object.assign(ctx,dataToWrite);return {data:{id:ctx.id},error:null};
       },
       then(resolve,reject){
         if(table!=="account_students")throw Error("unexpected then table");
         return Promise.resolve({data:[{...ctx}],error:null}).then(resolve,reject);
       }
     };
     return q;
   }
 };
 const mocks={
  "next/server":{NextResponse:{json:(body,opts={})=>new Response(JSON.stringify(body),{status:opts.status??200,headers:opts.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:USER,email_confirmed_at:"2026-01-01"}},error:null})}})},
  "@/lib/supabase/admin":{createAdminClient:()=>admin},
 };
 const js=ts.transpileModule(readFileSync("app/api/account/type/route.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const exp={};vm.runInNewContext(js,{exports:exp,require:k=>mocks[k]??{},Response,Request,Date,Promise,console:{error:()=>{}}});
 return {events,run:async()=>{const r=await exp.PATCH(new Request("https://fixture.invalid/account/type",{method:"PATCH",body:JSON.stringify({userType:"student"})}));return {status:r.status,cache:r.headers.get("cache-control"),body:await r.json()};}};
}
for(const opts of [{authUnavailable:true},{authThrows:true}]){
 test("Auth preflight unavailable denies type change without DB writes",async()=>{
   const f=fixture(opts),r=await f.run();
   assert.equal(r.status,503);assert.equal(r.cache,"private, no-store");
   assert.equal(r.body.code,"account_auth_preflight_unavailable");
   assert.deepEqual(f.events,["AUTH_LOOKUP"]);
   assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
 });
}
test("successful change reads Auth before DB and checks again before Auth update",async()=>{
 const f=fixture(),r=await f.run();
 assert.equal(r.status,200);assert.equal(r.body.userType,"student");
 const i=f.events.indexOf("DB_WRITE:account_students");
 assert.ok(i>f.events.indexOf("AUTH_LOOKUP"));
 assert.equal(f.events.filter(e=>e==="AUTH_LOOKUP").length,2);
 assert.ok(f.events.indexOf("AUTH_UPDATE")>i);
});
test("late Auth read failure reports reconciliation without Auth write",async()=>{
 const f=fixture({recheckUnavailable:true}),r=await f.run();
 assert.equal(r.status,503);assert.equal(r.body.code,"account_type_reconciliation_required");
 assert.equal(f.events.includes("AUTH_UPDATE"),false);
 assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
});
test("late Auth update failure reports reconciliation without leaking Auth error",async()=>{
 const f=fixture({authWriteError:true}),r=await f.run();
 assert.equal(r.status,503);assert.equal(r.body.code,"account_type_reconciliation_required");
 assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
});
