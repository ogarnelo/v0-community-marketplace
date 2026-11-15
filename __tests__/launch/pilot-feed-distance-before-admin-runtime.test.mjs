import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const FILE="app/api/marketplace/feed/route.ts";
const UID="11111111-1111-4111-8111-111111111111";
function fixture({guest=false,authFailure=false,postalCode="28001",profileFailure=false}={}){
  const events=[];
  const user={id:UID};
  const q=new Proxy({},{get(_target,k){
    if(k==="maybeSingle")return async()=>({data:{postal_code:postalCode},
      error:profileFailure?{message:"PRIVATE_PROFILE_SQL"}:null});
    if(k==="range")return async()=>({data:[],error:null,count:0});
    return()=>q;
  }});
  const session={
    auth:{getUser:async()=>({data:{user:guest?null:user},
      error:authFailure?{message:"PRIVATE_AUTH_ERROR"}:null})},
    from:table=>{events.push("session:"+table);return q;}
  };
  const admin={
    from:table=>{events.push("admin:"+table);return q;},
    rpc:async()=>{events.push("RPC");return{data:[],error:null};}
  };
  const mods={
    "next/server":{NextResponse:{json:(data,o={})=>new Response(JSON.stringify(data),{
      status:o.status??200,headers:o.headers??{}
    })}},
    "@/lib/supabase/server":{createClient:async()=>session},
    "@/lib/supabase/admin":{createAdminClient:()=>{events.push("ADMIN_CREATED");return admin}},
    "@/lib/marketplace/feed-filters":{
      parseMarketplaceFeedFilters:()=>({text:"",isbn:null,category:null,
        gradeLevel:null,listingType:null,condition:null,since:null,
        priceMin:null,priceMax:null,sort:"newest"}),
      applyMarketplaceFeedFilters:q=>q
    },
    "@/lib/marketplace/postal-distance":{
      approximateDistanceKm:()=>null,
      hasKnownPostalCode:code=>code==="28001"
    },
    "@/lib/types/marketplace":{buildPhotosMap:()=>new Map()}
  };
  const transpiled=ts.transpileModule(readFileSync(FILE,"utf8"),{
    fileName:FILE,reportDiagnostics:true,compilerOptions:{
      module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  });
  assert.equal((transpiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
  const exported={};
  vm.runInNewContext(transpiled.outputText,{
    exports:exported,require:id=>mods[id]??{},Request,Response,URL,Map,Set,Date,
    console:{error:()=>{}}
  },{filename:FILE,timeout:1500});
  return {events,request:async query=>{
    const res=await exported.GET(new Request("https://fixture.invalid/api/marketplace/feed"+query));
    return{status:res.status,cache:res.headers.get("cache-control"),body:await res.json()};
  }};
}
test("anonymous radius fails 401 without creating admin client",async()=>{
  const f=fixture({guest:true}),r=await f.request("?radiusKm=10");
  assert.equal(r.status,401);assert.equal(r.cache,"private, no-store");
  assert.equal(f.events.includes("ADMIN_CREATED"),false);
});
test("failed Auth cannot trust a stale returned user for radius",async()=>{
  const f=fixture({authFailure:true}),r=await f.request("?radiusKm=5");
  assert.equal(r.status,401);
  assert.equal(f.events.includes("ADMIN_CREATED"),false);
  assert.equal(f.events.some(x=>x.startsWith("session:")),false);
});
test("authenticated radius without postal code fails 422 before admin",async()=>{
  const f=fixture({postalCode:""}),r=await f.request("?radiusKm=5");
  assert.equal(r.status,422);assert.equal(r.cache,"private, no-store");
  assert.equal(f.events.includes("ADMIN_CREATED"),false);
});
test("profile error fails before privileged client creation",async()=>{
  const f=fixture({profileFailure:true}),r=await f.request("?radiusKm=15");
  assert.equal(r.status,503);assert.equal(r.cache,"private, no-store");
  assert.equal(f.events.includes("ADMIN_CREATED"),false);
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_PROFILE_SQL/);
});
test("authenticated and known postal enters nearby RPC only after checks",async()=>{
  const f=fixture(),r=await f.request("?radiusKm=15");
  assert.equal(r.status,200);assert.equal(r.cache,"private, no-store");
  assert.deepEqual(f.events,["session:profiles","ADMIN_CREATED","RPC"]);
});
test("normal public feed remains available to anonymous visitors",async()=>{
  const f=fixture({guest:true}),r=await f.request("?offset=0");
  assert.equal(r.status,200);assert.equal(r.cache,"private, no-store");
  assert.equal(f.events.filter(x=>x==="ADMIN_CREATED").length,1);
});
