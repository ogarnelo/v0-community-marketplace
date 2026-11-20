import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source=readFileSync("lib/fanpa/federation-scoped-activity-reader.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
function makeFixture({users={[A]:8,[B]:2,[C]:7},failed=null}={}) {
 const calls=[];
 const counts={
  account_students:{"eq:active":3},
  listings:{"in:status":2,"all":4},
  demand_requests:{"in:status":1},
  agreements:{"eq:status":1},
 };
 const admin={
  async rpc(name,args) {
   calls.push({type:"rpc",name,args});
   if(name!=="server_school_member_count")throw Error("unexpected RPC "+name);
   if(failed==="rpc")return {data:null,error:{code:"test"}};
   return {data:users[args.p_school_id],error:null};
  },
  from(table) {
   if(!(table in counts))throw Error("unsafely read table "+table);
   const filters=[];
   const query={
    select(columns,opts){
     assert.equal(columns,"id");
     assert.deepEqual({...opts},{head:true,count:"exact"});
     return query;
    },
    eq(col,value){ filters.push({kind:"eq",col,value});return query; },
    in(col,value){ filters.push({kind:"in",col,value});return query; },
    then(resolve,reject){
     calls.push({type:"count",table,filters:[...filters]});
     if(!filters.some(f=>f.col==="school_id"&&
       (f.value===A||f.value===B||f.value===C)))throw Error("missing school scope");
     const special=filters.find(f=>f.col!=="school_id");
     const key=special?special.kind+":"+special.col:"all";
     const value=counts[table][key];
     if(value===undefined)throw Error("unexpected count query "+table+" "+key);
     return Promise.resolve(failed===table?
      {count:null,error:{code:"test"}}:{count:value,error:null}).then(resolve,reject);
    }
   };
   return query;
  }
 };
 const module={exports:{}};
 vm.runInNewContext(js,{
  module,exports:module.exports,module,Set,Map,Promise,
  require(name){
   if(name==="@/lib/supabase/admin")return {createAdminClient:()=>admin};
   throw Error("unexpected import "+name);
  }
 });
 return {read:module.exports.readScopedFederationActivityCounts,calls};
}
test("reject empty, duplicate, forged and excessive school scopes before service client",async()=>{
 const f=makeFixture();
 for(const ids of [[],[A,A],["not-a-uuid"],Array.from({length:101},()=>A)]) {
  await assert.rejects(f.read(ids),/fanpa_scope_invalid/);
 }
 assert.equal(f.calls.length,0);
});
test("large represented school returns scoped count metrics without personal rows",async()=>{
 const f=makeFixture();
 const r=await f.read([A]);
 assert.equal(r.totalSchools,1);
 assert.equal(r.uniqueUsers,8);
 assert.equal(r.students,3);
 assert.equal(r.activeListings,2);
 assert.equal(r.totalListings,4);
 assert.equal(r.openDemands,1);
 assert.equal(r.confirmedExchanges,1);
 assert.equal(r.schools[0].schoolId,A);
 assert.equal(f.calls.filter(x=>x.type==="count").length,5);
 assert.ok(f.calls.every(c=>c.type==="rpc"||
   c.filters.some(x=>x.col==="school_id"&&x.value===A)));
 assert.doesNotMatch(JSON.stringify(r),/owner_user_id|user_id|email|profiles/);
});
test("small school does not read activity and hides all numeric metrics",async()=>{
 const f=makeFixture();
 const r=await f.read([B]);
 assert.equal(f.calls.length,1,"only one RPC may be executed for a small school");
 assert.equal(r.totalSchools,1);
 for(const name of ["uniqueUsers","students","activeListings","totalListings",
   "openDemands","confirmedExchanges"])assert.equal(r[name],null,name);
 for(const name of ["users","students","activeListings","totalListings",
   "openDemands","confirmedExchanges"])assert.equal(r.schools[0][name],null,name);
});
test("a mixed cohort never reveals the tiny school's counts by subtraction",async()=>{
 const f=makeFixture();
 const r=await f.read([A,B]);
 assert.equal(r.totalSchools,2);
 assert.equal(r.schools[0].users,8);
 assert.equal(r.schools[1].users,null);
 assert.equal(r.uniqueUsers,null);
 for(const name of ["students","activeListings","totalListings",
   "openDemands","confirmedExchanges"])assert.equal(r[name],null,name);
 assert.equal(f.calls.filter(x=>x.type==="count"&&
   x.filters.some(y=>y.value===B)).length,0);
});
test("multi-school user totals are never falsely summed even when both are large",async()=>{
 const f=makeFixture({users:{[A]:8,[B]:9}});
 const r=await f.read([A,B]);
 assert.equal(r.uniqueUsers,null);
 assert.equal(r.students,6);
 assert.equal(r.totalListings,8);
});
test("provider errors, unknown or invalid count values are always fatal",async()=>{
 for(const failed of ["rpc","listings","account_students","agreements","demand_requests"]){
  const f=makeFixture({failed});
  await assert.rejects(f.read([A]),/fanpa_.*_unavailable/);
 }
 for(const count of [-1,3.5,null,"9",undefined]){
  const f=makeFixture({users:{[A]:count}});
  await assert.rejects(f.read([A]),/fanpa_count_unavailable/);
 }
});
test("service reader never queries personal rows or accepts user-facing access",()=>{
 assert.match(source,/server_school_member_count/);
 assert.match(source,/head: true, count: "exact"/);
 assert.doesNotMatch(source,/\.from\("profiles"\)|\.from\("user_roles"\)/);
 assert.doesNotMatch(source,/getUser\(|NextResponse|export async function GET/);
});
