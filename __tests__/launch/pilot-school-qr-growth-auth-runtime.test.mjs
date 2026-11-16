import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const USER_ID="11111111-1111-4111-8111-111111111111";

function load(path,opts={}){
 const called=[],exports={},user={id:USER_ID,email:"qa@example.invalid"};
 const query={select:()=>query,eq:()=>query,
  then:(resolve,reject)=>Promise.resolve({
   data:opts.roleNone?[]:[{role:"school_admin",school_id:USER_ID}],
   error:opts.roleError?{message:"PRIVATE_ROLE_ERROR"}:null
  }).then(resolve,reject)};
 const supabase={
  auth:{getUser:async()=>{
   called.push("getUser");
   if(opts.throwAuth)throw Error("PRIVATE_AUTH_THROW");
   return {data:{user:opts.guest?null:user},error:
    opts.missing?{name:"AuthSessionMissingError"}:
    opts.missingCode?{code:"session_not_found"}:
    opts.provider?{name:"AuthProviderDown",message:"PRIVATE_PROVIDER"}:null};
  }},
  from:(table)=>{called.push("role:"+table);return query;}
 };
 const privateAdmin={
  from:(table)=>{
   called.push("ADMIN_TABLE:"+table);
   const chain={
    select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:{id:USER_ID,is_active:true}})
   };
   if(table==="growth_acquisition_events"){
     chain.insert=async(row)=>{called.push("GROWTH_INSERT:"+JSON.stringify(row));return {error:null};};
   }
   return chain;
  }
 };
 const mocks={
  "next/server":{NextResponse:Response},
  "qrcode":{toBuffer:async()=>new Uint8Array([137,80,78,71]),toString:async()=>"<svg></svg>"},
  "@/lib/supabase/server":{createClient:async()=>{
   called.push("createClient");if(opts.throwClient)throw Error("PRIVATE_CLIENT");return supabase;
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{
   called.push("ADMIN");return privateAdmin;
  }},
  "@/lib/growth/attribution":{
   appendGrowthUtm:(url)=>url,
   cleanGrowthLabel:(v)=>typeof v==="string"?v.trim():"",
   cleanReferrerHost:()=>"",
   cleanGrowthPath:()=>"/"
  },
  "@/lib/auth/public-origin":{getAuthPublicOrigin:()=> "https://www.wetudy.com"},
  "@/lib/growth/server-attribution":{recordAttributedConversion:async(_admin,v)=>{
   called.push("CONVERSION:"+v.userId);return true;
  }}
 };
 const src=readFileSync(path,"utf8");
 const compiled=ts.transpileModule(src,{fileName:path,reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(compiled.outputText,{
  exports,require:id=>mocks[id]??{},Request,Response,URL,Date,Promise,
  console:{error:()=>{}}
 },{filename:path,timeout:1500});
 return {exports,called};
}

const qr="app/api/school/share-qr/route.ts";
const attribution="app/api/analytics/acquisition/route.ts";
for(const [scenario,config,status] of [
 ["sin usuario",{guest:true},401],["sesión ausente con user residual",{missing:true},401],
 ["session_not_found con user residual",{missingCode:true},401],
 ["proveedor caído con user residual",{provider:true},503],
 ["getUser lanza",{throwAuth:true},500],["cliente lanza",{throwClient:true},500],
 ["fallo de roles",{roleError:true},503],["sin rol escolar",{roleNone:true},403]
]){
 test("QR escolar: "+scenario+" => "+status,async()=>{
  const h=load(qr,config),r=await h.exports.GET(new Request("https://fixture.invalid/api/school/share-qr"));
  assert.equal(r.status,status);
  assert.equal(r.headers.get("cache-control"),"private, no-store");
  assert.equal(h.called.includes("ADMIN"),false);
  assert.doesNotMatch(await r.text(),/PRIVATE_/);
  if(config.guest||config.missing||config.missingCode||config.provider||config.throwAuth||config.throwClient)
    assert.equal(h.called.includes("role:user_roles"),false);
 });
}
for(const [format,mime] of [["svg","image/svg+xml"],["png","image/png"]]){
 test("QR autorizado "+format+" se genera sin caché persistente",async()=>{
   const h=load(qr),r=await h.exports.GET(new Request("https://fixture.invalid/api/school/share-qr?format="+format));
   assert.equal(r.status,200);
   assert.ok(r.headers.get("content-type").includes(mime));
   assert.equal(r.headers.get("cache-control"),"private, no-store");
   assert.equal(h.called.includes("ADMIN"),true);
 });
}
for(const type of ["landing","attributed_user","listing_published","school_joined"]){
 test("Atribución: proveedor Auth caído no usa user residual ("+type+")",async()=>{
  const h=load(attribution,{provider:true}),r=await h.exports.POST(new Request("https://fixture.invalid/api/analytics/acquisition",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({eventType:type,source:"qa",entityId:USER_ID})
  }));
  assert.equal(r.status,503);
  assert.equal(r.headers.get("cache-control"),"private, no-store");
  assert.equal(h.called.includes("ADMIN"),false);
  assert.doesNotMatch(await r.text(),/PRIVATE_/);
 });
}
for(const type of ["listing_published","school_joined"]){
 for(const settings of [{guest:true},{missing:true},{missingCode:true}]){
  test("Atribución protegida "+type+" sin sesión => 401",async()=>{
   const h=load(attribution,settings),r=await h.exports.POST(new Request("https://fixture.invalid/api/analytics/acquisition",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({eventType:type,source:"qa",entityId:USER_ID})
   }));
   assert.equal(r.status,401);
   assert.equal(h.called.includes("ADMIN"),false);
   assert.equal(r.headers.get("cache-control"),"private, no-store");
  });
 }
}
test("Atribución pública sin fuente evita cliente privilegiado",async()=>{
 const h=load(attribution,{guest:true}),r=await h.exports.POST(new Request("https://fixture.invalid/api/analytics/acquisition",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventType:"landing"})
 }));
 assert.equal(r.status,200);
 assert.equal(h.called.includes("ADMIN"),false);
 assert.equal(r.headers.get("cache-control"),"private, no-store");
});
test("Atribución ligada a usuario invitado no escribe",async()=>{
 const h=load(attribution,{guest:true}),r=await h.exports.POST(new Request("https://fixture.invalid/api/analytics/acquisition",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventType:"attributed_user",source:"qa"})
 }));
 assert.equal(r.status,200);
 assert.equal(h.called.includes("ADMIN"),false);
});
test("Atribución conversión válida hace llamada ligada a user verificado",async()=>{
 const h=load(attribution),r=await h.exports.POST(new Request("https://fixture.invalid/api/analytics/acquisition",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventType:"listing_published",entityId:USER_ID})
 }));
 assert.equal(r.status,200);
 assert.ok(h.called.includes("CONVERSION:"+USER_ID));
 assert.equal(r.headers.get("cache-control"),"private, no-store");
});
test("Landing pública con fuente conserva inserción anónima",async()=>{
 const h=load(attribution,{guest:true}),r=await h.exports.POST(new Request("https://fixture.invalid/api/analytics/acquisition",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventType:"landing",source:"qa"})
 }));
 assert.equal(r.status,200);
 assert.ok(h.called.some(s=>s.includes("GROWTH_INSERT:")&&s.includes('"user_id":null')));
 assert.equal(r.headers.get("cache-control"),"private, no-store");
});
