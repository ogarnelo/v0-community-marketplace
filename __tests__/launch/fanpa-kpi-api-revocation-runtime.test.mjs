import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const route=readFileSync("app/api/fanpa/kpis/route.ts","utf8");
const resolveSource=readFileSync("lib/fanpa/federation-representation.ts","utf8");
const sharedSource=readFileSync("lib/fanpa/federation-server-scope.ts","utf8");
function transpile(src) {
 return ts.transpileModule(src,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
}
const scopeModule={exports:{}};
vm.runInNewContext(transpile(resolveSource),{
  module:scopeModule,exports:scopeModule.exports,Set,Map
});

const F="ffffffff-ffff-4fff-8fff-ffffffffffff";
const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const USER="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const federation={id:F,is_active:true,is_test:false};
const member={federation_id:F,user_id:USER,active:true};
const links=[{federation_id:F,school_id:A,active:true},
 {federation_id:F,school_id:B,active:true}];
const schools=[{id:A,name:"Cole A",is_active:true,is_test:false},
 {id:B,name:"Cole B",is_active:true,is_test:false},
 {id:C,name:"Cole secreto",is_active:true,is_test:false}];
function fixture(options={}) {
 const calls=[];
 const state={federations:[federation],admins:[member],links:[...links],
  schools:[...schools],...options};
 let authCount=0;
 const auth={getUser:async()=>{
  authCount++;
  if(options.revokedAfterFirst && authCount===2){
   state.admins=[{...member,active:false}];
  }
  if(options.linkRevokedAfterFirst && authCount===2){
   state.links=state.links.filter(x=>x.school_id!==B);
  }
  if(options.schoolDisabledAfterFirst && authCount===2){
   state.schools=state.schools.map(s=>s.id===B?{...s,is_active:false}:s);
  }
  return {data:{user: options.noUser?null:{
   id:USER,email_confirmed_at: options.unverified?null:"2026-11-20T00:00:00Z"
  }},error:null};
 }};
 const adminClient={from(table){
  const filters=[];
  const builder={
   select(){return builder;},
   eq(key,value){filters.push([key,value]);return builder;},
   in(key,values){filters.push([key,values]);return builder;},
   limit(max){
    calls.push({table,filters:[...filters]});
    const input={
     fanpa_federations:state.federations,
     fanpa_administrators:state.admins,
     fanpa_represented_schools:state.links,
     schools:state.schools
    }[table];
    assert.ok(input,"Unexpected table "+table);
    let rows=input.filter(row=>filters.every(([key,value])=>
     Array.isArray(value)?value.includes(row[key]):row[key]===value));
    rows=rows.slice(0,max);
    if(options.failTable===table)return Promise.resolve({data:null,error:{code:"provider_failed"}});
    return Promise.resolve({data:rows,error:null});
   }
  };
  return builder;
 }};
 const shared={exports:{}};
 vm.runInNewContext(transpile(sharedSource),{
  module:shared,exports:shared.exports,Set,Map,
  require(name){
   if(name==="@/lib/fanpa/federation-representation")return scopeModule.exports;
   if(name==="@/lib/supabase/admin")return {createAdminClient:()=>adminClient};
   throw Error("Unexpected shared import "+name);
  }
 });
 const mod={exports:{}};
 const env={
  WETUDY_FANPA_REPORTING_ENABLED: options.flagOn?"true":"false",
  WETUDY_FANPA_KPI_ENABLED: options.kpiOn?"true":"false",
 };
 vm.runInNewContext(transpile(route),{
  module:mod,exports:mod.exports,Set,Map,URL,Request,
  process:{env},console:{error:()=>{}},
  require(name){
   if(name==="next/server")return {NextResponse:{json:(body,init)=>({
    status:init.status,body,headers:init.headers
   })}};
   if(name==="@/lib/supabase/server")return {createClient:async()=>({auth})};
   if(name==="@/lib/supabase/admin")return {createAdminClient:()=>adminClient};
   if(name==="@/lib/fanpa/federation-server-scope")return shared.exports;
   throw Error("Unexpected import "+name);
  }
 });
 return {GET:mod.exports.GET,calls};
}
function req(federationId=F,schoolId=null) {
 const url=new URL("https://wetudy.test/api/fanpa/kpis");
 url.searchParams.set("federationId",federationId);
 if(schoolId!==null)url.searchParams.set("schoolId",schoolId);
 return new Request(url);
}
test("both feature flags must be on, no reads before enablement",async()=>{
 for(const opts of [{},{flagOn:true},{kpiOn:true}]){
  const f=fixture(opts);
  const res=await f.GET(req());
  assert.equal(res.status,404);
  assert.equal(res.body.error,"feature_disabled");
  assert.equal(res.headers["Cache-Control"],"private, no-store");
  assert.equal(f.calls.length,0);
 }
});
test("authorized federation receives only counts and represented school names",async()=>{
 const f=fixture({flagOn:true,kpiOn:true});
 const r=await f.GET(req());
 assert.equal(r.status,200);
 assert.equal(r.body.federationId,F);
 assert.deepEqual(Array.from(r.body.schools.map(s=>s.schoolId)),[A,B]);
 assert.equal(r.body.uniqueUsers,null);
 const text=JSON.stringify(r.body);
 for(const forbidden of [USER,C,"Cole secreto","email","owner_user_id","profiles"]){
  assert.equal(text.includes(forbidden),false,forbidden);
 }
 assert.equal(f.calls.filter(x=>x.type==="kpi").length,1);
 assert.deepEqual(f.calls.find(x=>x.type==="kpi").ids,[A,B]);
 assert.equal(r.headers["Cache-Control"],"private, no-store");
});
test("school filters are checked BEFORE the KPI reader",async()=>{
 const f=fixture({flagOn:true,kpiOn:true});
 const denied=await f.GET(req(F,C));
 assert.equal(denied.status,403);
 assert.equal(f.calls.filter(x=>x.type==="kpi").length,0);
 const r=await fixture({flagOn:true,kpiOn:true}).GET(req(F,A));
 assert.equal(r.status,200);
 assert.deepEqual(Array.from(r.body.schools.map(s=>s.schoolId)),[A]);
});
test("guest, unconfirmed user and forged federation return no KPI",async()=>{
 for(const opts of [{noUser:true},{unverified:true}]){
  const f=fixture({flagOn:true,kpiOn:true,...opts});
  const r=await f.GET(req());
  assert.equal(r.status,401);
  assert.equal(f.calls.filter(x=>x.type==="kpi").length,0);
 }
 const forged=fixture({flagOn:true,kpiOn:true});
 assert.equal((await forged.GET(req(C))).status,403);
 assert.equal(forged.calls.filter(x=>x.type==="kpi").length,0);
 assert.equal((await fixture({flagOn:true,kpiOn:true}).GET(req("bad"))).status,400);
});
test("revoking membership, a link or a school AFTER counts blocks disclosure",async()=>{
 for(const [option,expected] of [
  ["revokedAfterFirst",403],["linkRevokedAfterFirst",409],
  ["schoolDisabledAfterFirst",403]]){
  const f=fixture({flagOn:true,kpiOn:true,[option]:true});
  const r=await f.GET(req());
  assert.equal(r.status,expected,option);
  assert.equal(r.body.schools,undefined);
  assert.equal(f.calls.filter(x=>x.type==="kpi").length,1);
 }
});
test("provider read/count errors fail closed without leaking underlying details",async()=>{
 for(const table of ["fanpa_federations","fanpa_administrators",
  "fanpa_represented_schools","schools"]){
  const f=fixture({flagOn:true,kpiOn:true,failTable:table});
  assert.equal((await f.GET(req())).status,503,table);
 }
 const r=await fixture({flagOn:true,kpiOn:true,kpiError:true}).GET(req());
 assert.equal(r.status,503);
 assert.equal(JSON.stringify(r.body).includes("private provider"),false);
});
test("KPI route reuses shared authorization and never reads personal rows",()=>{
 assert.match(route,/readAuthorizedFederationScope/);
 assert.match(route,/sameFederationScope/);
 assert.match(route,/WETUDY_FANPA_KPI_ENABLED !== "true"/);
 assert.doesNotMatch(route,/\.from\("profiles"\)|\.from\("account_students"\)|\.from\("listings"\)/);
});
