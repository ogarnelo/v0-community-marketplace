#!/usr/bin/env node
"use strict";
// Compiles ORIGINAL app/api/schools/public/route.ts with one controlled
// in-memory admin client. Tests school-by-ID revalidation versus cached list.
// No network requests, production keys or schools.
const assert=require("node:assert/strict");
const path=require("node:path"),fs=require("node:fs"),Module=require("node:module");
const modules=process.env.PILOT_UI_MODULES||"/tmp/wetudy-moderation-integrated/node_modules";
const {build}=require(path.join(modules,"esbuild"));
const root=process.cwd(),id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const qa={active:true,lookups:[],error:false};
globalThis.__qaPublicSchools=()=>{
 function builder(stage){
  return {
   select(cols){qa.lookups.push({stage,cols});return builder("select")},
   eq(key,val){
    qa.lookups.push({eq:key,value:val});
    return builder("eq");
   },
   maybeSingle:async()=>({
    data:qa.error?null:qa.active?{id,name:"COLEGIO QA ALFA",city:"Ciudad QA"}:null,
    error:qa.error?{message:"Synthetic school lookup error"}:null
   }),
   order(){return builder("order")},
   limit(){return builder("limit")},
   or(){return builder("or")},
   returns:async()=>({data:qa.active?[{id,name:"COLEGIO QA ALFA",city:"Ciudad QA"}]:[],error:null})
  };
 }
 return {from(table){
  assert.equal(table,"schools");
  return builder("from");
 }};
};
async function realRoute(){
 const r=await build({
  entryPoints:["app/api/schools/public/route.ts"],absWorkingDir:root,
  platform:"node",target:"node24",format:"cjs",bundle:true,write:false,
  plugins:[{name:"qa-public-schools-adapter",setup(plugin){
   plugin.onResolve({filter:/^(?:next\/server|@\/lib\/supabase\/admin)$/},
     args=>({path:args.path,namespace:"public-school-qa"}));
   plugin.onLoad({filter:/.*/,namespace:"public-school-qa"},args=>({
    loader:"js",contents:args.path==="next/server"
      ?'export class NextResponse extends Response { static json(body, init){ return Response.json(body,init); } }'
      :'export function createAdminClient(){return globalThis.__qaPublicSchools();}'
   }));
  }}]
 });
 const mod=new Module(path.join(root,"__qa_school_public_route.cjs"),module);
 mod.filename=path.join(root,"__qa_school_public_route.cjs");mod.paths=module.paths;
 mod._compile(r.outputFiles[0].text,mod.filename);
 return mod.exports.GET;
}
(async()=>{
 const GET=await realRoute();
 const get=path=>GET(new Request("http://127.0.0.1:9999"+path));
 let r=await get("/api/schools/public?id="+id);
 assert.equal(r.status,200);
 assert.equal((await r.json()).school.id,id);
 assert.equal(r.headers.get("cache-control"),"private, no-store, max-age=0");
 assert.ok(qa.lookups.some(x=>x.eq==="id"&&x.value===id));
 assert.ok(qa.lookups.some(x=>x.eq==="is_active"&&x.value===true));

 // Within a millisecond of disabling, same URL must return null, NEVER cached.
 qa.active=false;
 r=await get("/api/schools/public?id="+id);
 assert.equal(r.status,200);
 assert.equal((await r.json()).school,null);
 assert.equal(r.headers.get("cache-control"),"private, no-store, max-age=0");
 qa.active=true;
 r=await get("/api/schools/public?q=ALFA");
 assert.equal(r.status,200);
 assert.equal((await r.json()).schools.length,1);
 assert.equal(r.headers.get("cache-control"),"public, max-age=60, s-maxage=300");
 // Keep the general-list cache for cost management, but force id revalidation.
 qa.error=true;
 const quiet=console.error;
 console.error=()=>{};
 try{
  r=await get("/api/schools/public?id="+id);
  assert.equal(r.status,500);
  assert.equal((await r.json()).error,"No se pudieron cargar los centros.");
 }finally{console.error=quiet;}
 console.log("PASS actual school-by-ID API: active returns school, inactive immediately returns null, no-store headers; general listings retain caching; database failure returns 500.");
 console.log("LIMIT: admin Supabase data client is in-memory QA adapter; previous local GoTrue/RLS suites cover real authentication and family school persistence.");
})().catch(err=>{console.error("School-by-ID revalidation contract FAILED:",err.message);process.exitCode=1;});
