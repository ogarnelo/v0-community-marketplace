#!/usr/bin/env node
"use strict";
// Execute the REAL Next share-QR route bundled from repository, with only
// Auth, privileged school lookup and QR encoder replaced by deterministic
// disposable test doubles. The route body and error logic are NOT mocked.
const assert=require("node:assert/strict");
const path=require("node:path");
const Module=require("node:module");
const modules=process.env.PILOT_UI_MODULES||"/tmp/wetudy-moderation-integrated/node_modules";
const {build}=require(path.join(modules,"esbuild"));
const ROOT=process.cwd();
const SCHOOL="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTOR="11111111-1111-4111-8111-111111111111";
const values={loggedIn:true,hasRole:true,schoolExists:true,schoolActive:true,error:false,urls:[],schoolLookup:null};
globalThis.__qaQrState=values;
globalThis.__qaQrSession=()=>({
 auth:{getUser:async()=>({data:{user:values.loggedIn?{id:ACTOR}:null}})},
 from(table){
  assert.equal(table,"user_roles");
  return {select:()=>({eq:(column,value)=>{
    assert.equal(column,"user_id");
    assert.equal(value,ACTOR);
    return Promise.resolve({data:values.hasRole?[{role:"school_admin",school_id:SCHOOL}]:[],
      error:null});
  }})};
 }
});
globalThis.__qaQrAdmin=()=>({
 from(table){
  assert.equal(table,"schools");
  return {select:()=>({eq:(column,value)=>{
    assert.equal(column,"id");
    values.schoolLookup=value;
    return {maybeSingle:async()=>({
      data:values.schoolExists?{id:SCHOOL,is_active:values.schoolActive}:null,
      error:values.error?{message:"QA local school lookup failure"}:null
    })};
  }})};
 }
});
globalThis.__qaQrEncoder={
 toBuffer:async(url)=>{values.urls.push(url);return Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3]);},
 toString:async(url)=>{values.urls.push(url);return "<svg xmlns='http://www.w3.org/2000/svg'></svg>";}
};
async function loadRealHandler(){
 const result=await build({
  entryPoints:["app/api/school/share-qr/route.ts"],absWorkingDir:ROOT,
  platform:"node",bundle:true,format:"cjs",target:"node24",write:false,
  plugins:[{name:"route-test-adapters",setup(b){
    const fake=new Set(["next/server","qrcode","@/lib/supabase/server","@/lib/supabase/admin"]);
    b.onResolve({filter:/^(?:next\/server|qrcode|@\/lib\/supabase\/(?:server|admin))$/},
      arg=>({path:arg.path,namespace:"qr-test"}));
    b.onResolve({filter:/^@\//},arg=>({path:path.join(ROOT,arg.path.slice(2))}));
    b.onLoad({filter:/.*/,namespace:"qr-test"},arg=>{
      let source;
      if(arg.path==="next/server")source="export class NextResponse extends Response {}";
      else if(arg.path==="qrcode")
        source="export default {toBuffer:(url)=>globalThis.__qaQrEncoder.toBuffer(url),toString:(url)=>globalThis.__qaQrEncoder.toString(url)};";
      else if(arg.path.endsWith("/server"))
        source="export async function createClient(){return globalThis.__qaQrSession();}";
      else source="export function createAdminClient(){return globalThis.__qaQrAdmin();}";
      return {loader:"js",contents:source};
    });
  }}]
 });
 const m=new Module(path.join(ROOT,"__qa_actual_qr_route.cjs"),module);
 m.filename=path.join(ROOT,"__qa_actual_qr_route.cjs");
 m.paths=module.paths;
 m._compile(result.outputFiles[0].text,m.filename);
 return m.exports.GET;
}
(async()=>{
 const GET=await loadRealHandler();
 const send=(path)=>GET(new Request("http://localhost"+path,{method:"GET"}));
 values.loggedIn=false;
 assert.equal((await send("/api/school/share-qr")).status,401);
 values.loggedIn=true;values.hasRole=false;
 assert.equal((await send("/api/school/share-qr")).status,403);
 values.hasRole=true;values.schoolExists=false;
 let res=await send("/api/school/share-qr");
 assert.equal(res.status,403);
 assert.equal(res.headers.get("cache-control"),"private, no-store");
 values.schoolExists=true;values.schoolActive=false;
 res=await send("/api/school/share-qr");
 assert.equal(res.status,403,"Disabled school must not mint new invitations");
 assert.equal(values.urls.length,0,"Denials must occur before encoding QR");
 values.schoolActive=true;
 res=await send("/api/school/share-qr");
 assert.equal(res.status,200);
 assert.match(res.headers.get("content-type")||"",/^image\/svg\+xml/);
 assert.equal(values.schoolLookup,SCHOOL);
 assert.equal(values.urls.length,1);
 let url=new URL(values.urls[0]);
 assert.equal(url.origin,"https://www.wetudy.com");
 assert.equal(url.pathname,"/onboarding/join-school");
 assert.equal(url.searchParams.get("school"),SCHOOL);
 assert.equal(url.searchParams.get("utm_source"),"school");
 assert.equal(url.searchParams.get("utm_medium"),"qr");
 assert.equal(url.searchParams.get("utm_campaign"),"school_invite");
 res=await send("/api/school/share-qr?format=png&download=1");
 assert.equal(res.status,200);
 assert.equal(res.headers.get("content-type"),"image/png");
 assert.match(res.headers.get("content-disposition")||"",/^attachment;/);
 assert.equal(values.urls.length,2);
 values.error=true;
 // No production errors or credentials involved: the 500 is a fake DB failure.
 const old=console.error;
 try{
  console.error=()=>{};
  res=await send("/api/school/share-qr");
  assert.equal(res.status,500);
 }finally{console.error=old;}
 console.log("PASS actual school QR route: guest 401, role absent 403, school missing/inactive 403 with no QR minted, active SVG/PNG 200, trusted www.wetudy.com origin, correct school UTM, fake lookup error 500.");
 console.log("LIMIT: backend Auth/Admin and QR encoder are controlled in-memory QA doubles; real GoTrue/Next isolation is verified in a separate CI job.");
})().catch(error=>{console.error("Actual QR route contract failed:",error.message);process.exitCode=1;});
