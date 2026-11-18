import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ts=createRequire(import.meta.url)("typescript");
const SCHOOL="11111111-1111-4111-8111-111111111111";
const USER="22222222-2222-4222-8222-222222222222";
const OTHER="33333333-3333-4333-8333-333333333333";

function fixture(opts={}){
  const calls=[];let users=0,roles=0,schools=0;
  const supabase={
    auth:{getUser:async()=>{
      users++;calls.push("AUTH"+users);
      return {data:{user:{
        id:opts.changedUser&&users===2?OTHER:USER,
        email:opts.changedEmail&&users===2?"other@example.invalid":"school@example.invalid",
        email_confirmed_at:opts.unverified&&users===2?null:"2026-11-01T00:00:00Z",
      }},error:opts.authOutage&&users===2?new Error("PRIVATE_AUTH"):null};
    }},
    from(table){
      assert.equal(table,"user_roles");
      return {select(){return this},eq(){
        roles++;calls.push("ROLE"+roles);
        return Promise.resolve({data:opts.revokedRole&&roles===2
          ? []:[{role:"school_admin",school_id:SCHOOL},
             ...((opts.ambiguousInitial&&roles===1 ||
                   opts.ambiguousPostflight&&roles===2)
                ? [{role:"school_admin",school_id:OTHER}] : [])],
          error:opts.roleOutage&&roles===2?new Error("PRIVATE_ROLE"):null});
      }};
    }
  };
  const admin={from(table){
    if(table==="schools"){
      return {select(){return this},eq(){return this},maybeSingle:async()=>{
        schools++;calls.push("SCHOOL"+schools);
        return {data:{id:opts.wrongSchool&&schools===2?OTHER:SCHOOL,
          is_active:!(opts.inactiveSchool&&schools===2)},
          error:opts.schoolOutage&&schools===2?new Error("PRIVATE_SCHOOL"):null};
      }};
    }
    if(table==="school_impact_report_subscriptions"){
      const q={
        update:(data)=>{calls.push("UPDATE");assert.equal(Object.hasOwn(data,"last_sent_month"),false);return q;},
        eq:()=>q,select:()=>q,
        maybeSingle:async()=>({data:{id:"synthetic-subscription"},error:null}),
        insert:async()=>{calls.push("INSERT");return {error:null}},
      };
      return q;
    }
    throw Error("Unexpected table "+table);
  }};
  const output={};
  const source=readFileSync("app/api/school/report-subscription/route.ts","utf8");
  const js=ts.transpileModule(source,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
  }}).outputText;
  vm.runInNewContext(js,{exports:output,require(name){
    if(name==="next/server") return {NextResponse:{json:(body,options={})=>
      Response.json(body,{status:options.status??200,headers:options.headers})}};
    if(name==="@/lib/supabase/server") return {createClient:async()=>supabase};
    if(name==="@/lib/supabase/admin") return {createAdminClient:()=>admin};
    throw Error(name);
  },Date,Number,Response,Request,console:{error:()=>{}}},{timeout:1500});
  return {calls,run:async()=>{
    const res=await output.POST(new Request("https://wetudy.invalid/api/school/report-subscription",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({enabled:true,dayOfMonth:18,email:"school@example.invalid"})
    }));
    return {status:res.status,cache:res.headers.get("cache-control")};
  }};
}
test("valid same school-admin configuration writes once after second verification",async()=>{
 const h=fixture(),res=await h.run();
 assert.equal(res.status,200);assert.equal(res.cache,"private, no-store");
 assert.deepEqual(h.calls,["AUTH1","ROLE1","SCHOOL1","AUTH2","ROLE2","SCHOOL2","UPDATE"]);
});
test("role revoked after initial validation never creates or updates subscription",async()=>{
 const h=fixture({revokedRole:true}),res=await h.run();
 assert.equal(res.status,403);assert.ok(!h.calls.includes("UPDATE"));
});
test("session switch, verified email change or loss of confirmation aborts before write",async()=>{
 for(const opt of [{changedUser:true},{changedEmail:true},{unverified:true}]){
  const h=fixture(opt),res=await h.run();
  assert.equal(res.status,403);assert.ok(!h.calls.includes("UPDATE"));
 }
});
test("school deactivated or replaced during request blocks subscription write",async()=>{
 for(const opt of [{inactiveSchool:true},{wrongSchool:true}]){
  const h=fixture(opt),res=await h.run();
  assert.equal(res.status,403);assert.ok(!h.calls.includes("UPDATE"));
 }
});
test("postflight auth, role and school outages fail closed with no upsert",async()=>{
 for(const opt of [{authOutage:true},{roleOutage:true},{schoolOutage:true}]){
  const h=fixture(opt),res=await h.run();
  assert.equal(res.status,503);assert.ok(!h.calls.includes("UPDATE"));
 }
});

test("two admin schools at initial scope lookup deny subscription mutation",async()=>{
 const h=fixture({ambiguousInitial:true}),res=await h.run();
 assert.equal(res.status,403);
 assert.equal(h.calls.includes("UPDATE"),false);
 assert.equal(h.calls.includes("SCHOOL1"),false);
});
test("new second school assignment between checks denies subscription write",async()=>{
 const h=fixture({ambiguousPostflight:true}),res=await h.run();
 assert.equal(res.status,403);
 assert.equal(h.calls.includes("UPDATE"),false);
});
