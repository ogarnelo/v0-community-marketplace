import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const route=readFileSync("app/api/fanpa/scope/route.ts","utf8");
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
 const env={WETUDY_FANPA_REPORTING_ENABLED: options.flagOn?"true":"false"};
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
function req(federationId=F) {
 return new Request("https://wetudy.test/api/fanpa/scope?federationId="+federationId);
}
test("feature is disabled by default and performs no database reads",async()=>{
 const f=fixture();
 const r=await f.GET(req());
 assert.equal(r.status,404);
 assert.equal(r.body.error,"feature_disabled");
 assert.equal(f.calls.length,0);
 assert.equal(r.headers["Cache-Control"],"private, no-store");
});
test("only represented active school names returned, never people or foreign schools",async()=>{
 const f=fixture({flagOn:true});
 const r=await f.GET(req());
 assert.equal(r.status,200);
 assert.equal(r.body.federationId,F);
 assert.deepEqual(Array.from(r.body.schools.map(x=>x.id)),[A,B]);
 const payload=JSON.stringify(r.body);
 for(const forbidden of [USER,C,"Cole secreto","email","owner_user_id","profiles"]){
  assert.equal(payload.includes(forbidden),false);
 }
 assert.ok(f.calls.every(call=>call.table!=="profiles" && call.table!=="account_students"));
 assert.equal(r.headers["Cache-Control"],"private, no-store");
});
test("guest, unverified user and forged federation cannot retrieve a scope",async()=>{
 assert.equal((await fixture({flagOn:true,noUser:true}).GET(req())).status,401);
 assert.equal((await fixture({flagOn:true,unverified:true}).GET(req())).status,401);
 assert.equal((await fixture({flagOn:true}).GET(req(C))).status,403);
 assert.equal((await fixture({flagOn:true}).GET(req("invalid"))).status,400);
});
test("federation member revocation and link revocation before return are blocked",async()=>{
 assert.equal((await fixture({flagOn:true,revokedAfterFirst:true}).GET(req())).status,403);
 assert.equal((await fixture({flagOn:true,linkRevokedAfterFirst:true}).GET(req())).status,409);
 assert.equal((await fixture({flagOn:true,schoolDisabledAfterFirst:true}).GET(req())).status,403);
});
test("provider read failure rejects entire scope, no partial disclosure",async()=>{
 for(const table of ["fanpa_federations","fanpa_administrators",
  "fanpa_represented_schools","schools"]){
  const r=await fixture({flagOn:true,failTable:table}).GET(req());
  assert.equal(r.status,503,table);
  assert.equal(r.body.schools,undefined);
 }
});
test("route does not expose KPI or personal data and caps representation reads",()=>{
 assert.doesNotMatch(route,/\.from\("profiles"\)|\.from\("account_students"\)|\.from\("demand_requests"\)|\.from\("agreements"\)/);
 assert.match(route,/WETUDY_FANPA_REPORTING_ENABLED !== "true"/);
 assert.match(sharedSource,/FANPA_MAX_LINKS = 100/);
 assert.match(sharedSource,/resolveFederationRepresentation/);
 assert.match(route,/sameFederationScope/);
 assert.match(route,/freshAuth/);
});
