import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const route=readFileSync("app/api/fanpa/kpis/route.ts","utf8");
const resolveSource=readFileSync("lib/fanpa/federation-representation.ts","utf8");
const sharedSource=readFileSync("lib/fanpa/federation-server-scope.ts","utf8");
const projectionSource=readFileSync("lib/fanpa/federation-kpi-response-guard.ts","utf8");
function transpile(src) {
 return ts.transpileModule(src,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
}
const scopeModule={exports:{}};
vm.runInNewContext(transpile(resolveSource),{
  module:scopeModule,exports:scopeModule.exports,Set,Map
});
const projectionModule={exports:{}};
vm.runInNewContext(transpile(projectionSource),{
  module:projectionModule,exports:projectionModule.exports,Set,Map,Number,Error,
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
   if(name==="@/lib/fanpa/federation-kpi-response-guard")return projectionModule.exports;
   if(name==="@/lib/fanpa/federation-scoped-activity-reader")return {
    readScopedFederationActivityCounts:async(ids)=>{
     calls.push({type:"kpi",ids:[...ids]});
     if(options.kpiError)throw Error("private provider error");
     const payload={
      totalSchools:ids.length,uniqueUsers:ids.length===1?8:null,
      students:ids.length*3,activeListings:ids.length*2,
      totalListings:ids.length*4,openDemands:ids.length,
      confirmedExchanges:ids.length,
      schools:ids.map(id=>({
       schoolId:id,users:8,students:3,activeListings:2,
       totalListings:4,openDemands:1,confirmedExchanges:1
      }))
     };
     return options.kpiPayload ? options.kpiPayload(payload,ids) : payload;
    }
   };
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
test("unexpected internal reader attributes are never serialized to federations",async()=>{
 const f=fixture({flagOn:true,kpiOn:true,kpiPayload:p=>({
  ...p,
  debugUserEmails:["never-return-private@example.invalid"],
  schools:p.schools.map(s=>({
   ...s,user_id:"never-export-user-id",email:"never-export-private@example.invalid",
   owner_user_id:"never-export-owner",directMessages:[{body:"PRIVATE_MESSAGE"}],
  })),
 })});
 const res=await f.GET(req());
 assert.equal(res.status,200,JSON.stringify(res.body));
 const wire=JSON.stringify(res.body);
 for(const secret of ["never-return-private","never-export","PRIVATE_MESSAGE",
  "owner_user_id","debugUserEmails","directMessages"]) {
  assert.equal(wire.includes(secret),false,"Leaked internal field: "+secret);
 }
 assert.deepEqual(Object.keys(res.body).sort(),[
  "federationId","selectedSchoolId","totalSchools","uniqueUsers",
  "students","activeListings","totalListings","openDemands",
  "confirmedExchanges","schools"].sort());
 assert.deepEqual(Object.keys(res.body.schools[0]).sort(),[
  "schoolId","name","users","students","activeListings","totalListings",
  "openDemands","confirmedExchanges"].sort());
});
test("projection refuses foreign, repeated, partial, unsuppressed or contradictory KPI",async()=>{
 const mutations=[
  p=>({...p,schools:[{...p.schools[0],schoolId:C},p.schools[1]]}),
  p=>({...p,schools:[p.schools[0],p.schools[0]]}),
  p=>({...p,schools:p.schools.slice(0,1)}),
  p=>({...p,totalSchools:3}),
  p=>({...p,students:p.students+1}),
  p=>({...p,uniqueUsers:16}),
  p=>({...p,schools:[{...p.schools[0],users:3},p.schools[1]]}),
  p=>({...p,schools:[{...p.schools[0],users:null},p.schools[1]]}),
  p=>({...p,schools:[{...p.schools[0],totalListings:-1},p.schools[1]]}),
  p=>({...p,schools:[{...p.schools[0],totalListings:NaN},p.schools[1]]}),
  p=>({...p,schools:[{...p.schools[0],students:7},p.schools[1]]}),
  p=>({...p,schools:[{...p.schools[0],users:null,students:null,
    activeListings:null,totalListings:null,openDemands:null,
    confirmedExchanges:null},p.schools[1]]}),
 ];
 for(const [i,mutate] of mutations.entries()){
  const f=fixture({flagOn:true,kpiOn:true,kpiPayload:mutate});
  const res=await f.GET(req());
  assert.equal(res.status,503,"unsafe internal payload "+i);
  assert.equal(res.body.error,"scope_unavailable");
  assert.equal(res.body.schools,undefined);
  assert.equal(res.headers["Cache-Control"],"private, no-store");
 }
});
test("small-school totals must remain hidden even if internal adapter regresses",async()=>{
 const hidden={schoolId:B,users:null,students:null,activeListings:null,
   totalListings:null,openDemands:null,confirmedExchanges:null};
 const healthy=fixture({flagOn:true,kpiOn:true,kpiPayload:p=>({
   ...p,uniqueUsers:null,students:null,activeListings:null,totalListings:null,
   openDemands:null,confirmedExchanges:null,schools:[p.schools[0],hidden]
 })});
 const safe=await healthy.GET(req());
 assert.equal(safe.status,200);
 assert.equal(safe.body.students,null);
 assert.equal(safe.body.schools[1].users,null);
 const leaking=fixture({flagOn:true,kpiOn:true,kpiPayload:p=>({
   ...p,schools:[p.schools[0],hidden],students:3
 })});
 const denied=await leaking.GET(req());
 assert.equal(denied.status,503);
 assert.equal(denied.body.schools,undefined);
});
test("KPI route reuses shared authorization and never reads personal rows",()=>{
 assert.match(route,/readAuthorizedFederationScope/);
 assert.match(route,/sameFederationScope/);
 assert.match(route,/WETUDY_FANPA_KPI_ENABLED !== "true"/);
 assert.match(route,/projectVerifiedFederationKpis/);
 assert.doesNotMatch(route,/\.\.\.kpis|\.\.\.school/);
 assert.match(projectionSource,/MIN_PRIVATE_COHORT = 5/);
 assert.match(projectionSource,/fanpa_kpi_projection_unavailable/);
 assert.doesNotMatch(route,/\.from\("profiles"\)|\.from\("account_students"\)|\.from\("listings"\)/);
});
