import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts=createRequire(import.meta.url)("typescript");
const file="app/api/marketplace/my-school/route.ts";
function handler({authenticated=true,profileError=false,scopeError=false}={}){
  const calls={admin:0,logs:[]};
  const q={
    select(){return this;},eq(){return this;},not(){return this;},
    order(){return this;},limit(){return this;},
    async maybeSingle(){return {data:null,error:profileError?{message:"DB_SECRET_DO_NOT_LEAK"}:null}}
  };
  const supabase={
    auth:{getUser:async()=>({data:{user:authenticated?{id:"familyA"}:null},error:null})},
    from(){return Object.create(q)}
  };
  const deps={
    "next/server":{NextResponse:{json:(body,options={})=>new Response(JSON.stringify(body),{
      status:options.status??200,headers:options.headers??{}
    })}},
    "@/lib/supabase/server":{createClient:async()=>supabase},
    "@/lib/supabase/admin":{createAdminClient:()=>{calls.admin++;throw Error("ADMIN_SECRET_DO_NOT_LEAK")}},
    "@/lib/marketplace/feed-filters":{
      parseMarketplaceFeedFilters:()=>({}),hasServerMarketplaceFilters:()=>false,
      applyMarketplaceFeedFilters:x=>x
    },
    "@/lib/marketplace/postal-distance":{approximateDistanceKm:()=>null},
    "@/lib/marketplace/school-scope":{
      resolveMarketplaceSchoolScope:async()=>{if(scopeError)throw Error("SCOPE_SECRET_DO_NOT_LEAK");return null},
      makeMarketplaceSchoolFilter:()=>null
    },
    "@/lib/types/marketplace":{buildPhotosMap:()=>new Map()}
  };
  const transpiled=ts.transpileModule(readFileSync(file,"utf8"),{
    fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
  });
  assert.equal((transpiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  const exports={};
  vm.runInNewContext(transpiled.outputText,{
    exports,require:(id)=>{assert.ok(id in deps,id);return deps[id]},
    URL,Request,Response,console:{error:(...args)=>calls.logs.push(args)}
  },{filename:file,timeout:2000});
  return {get:exports.GET,calls};
}
const request=(suffix="")=>new Request("http://fixture.invalid/api/marketplace/my-school"+suffix);
function privateResponse(resp){assert.match(resp.headers.get("cache-control")??"",/private, no-store/)}
test("unauthenticated school feed sends 401 private without service client",async()=>{
  const {get,calls}=handler({authenticated:false});
  const resp=await get(request());
  assert.equal(resp.status,401);privateResponse(resp);assert.equal(calls.admin,0);
});
test("bad pagination is private and rejected before scope or service client",async()=>{
  const {get,calls}=handler();
  const resp=await get(request("?offset=%21"));
  assert.equal(resp.status,400);privateResponse(resp);assert.equal(calls.admin,0);
});
test("failed school membership lookup gives private 503 without leaking error object",async()=>{
  const {get,calls}=handler({profileError:true});
  const resp=await get(request());
  assert.equal(resp.status,503);privateResponse(resp);
  assert.equal(JSON.stringify(await resp.json()).includes("DO_NOT_LEAK"),false);
  assert.equal(calls.admin,0);
});
test("scope exceptions use fixed log token only",async()=>{
  const {get,calls}=handler({scopeError:true});
  const resp=await get(request());
  assert.equal(resp.status,503);privateResponse(resp);
  assert.deepEqual(calls.logs,[["marketplace_school_feed_read_failed"]]);
  assert.equal(JSON.stringify(await resp.json()).includes("DO_NOT_LEAK"),false);
  assert.equal(calls.admin,0);
});
