import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const src=readFileSync("app/api/school/share-qr/route.ts","utf8");
const helper=readFileSync("lib/marketplace/unique-school-admin-context.ts","utf8");
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
const uid="33333333-3333-4333-8333-333333333333";
const h={exports:{}};
vm.runInNewContext(ts.transpileModule(helper,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:h.exports,Error},{timeout:1000});
const compiled=ts.transpileModule(src,{fileName:"qr.ts",reportDiagnostics:true,compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true
}});
assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
function handler({roles=[{school_id:a}],authError=null,dbError=null,isActive=true}={}){
 const logs=[],calls=[],exports={};
 const session={
  auth:{getUser:async()=>({data:{user:{id:uid}},error:authError})},
  from:table=>{
   calls.push("QUERY:"+table);
   const q={select:()=>q,eq:()=>q,limit:()=>q,then:(resolve,reject)=>Promise.resolve({data:roles,error:dbError}).then(resolve,reject)};
   return q;
  },
 };
 const admin={from:table=>{
  calls.push("ADMIN:"+table);
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{id:a,is_active:isActive},error:null})};
  return q;
 }};
 const mods={
  "next/server":{NextResponse:Response},
  "qrcode":{toString:async()=>"<svg>fake-qa</svg>",toBuffer:async()=>new Uint8Array([137])},
  "@/lib/supabase/server":{createClient:async()=>session},
  "@/lib/supabase/admin":{createAdminClient:()=>{calls.push("ADMIN_CREATED");return admin}},
  "@/lib/marketplace/unique-school-admin-context":h.exports,
  "@/lib/growth/attribution":{appendGrowthUtm:(uri)=>uri},
  "@/lib/auth/public-origin":{getAuthPublicOrigin:()=> "https://www.wetudy.com"}
 };
 vm.runInNewContext(compiled.outputText,{exports,require:id=>mods[id]??{},URL,Request,Response,Uint8Array,Error,Promise,console:{error:()=>{}}},{timeout:2000});
 return {calls,run:()=>exports.GET(new Request("https://fixture.invalid/api/school/share-qr"))};
}
test("one school-admin can generate same-school QR",async()=>{
 const h=handler(),r=await h.run();
 assert.equal(r.status,200);
 assert.ok(h.calls.includes("ADMIN_CREATED"));
});
for(const [label,roles] of [
 ["two different school grants",[{school_id:a},{school_id:b}]],
 ["duplicate grants",[{school_id:a},{school_id:a}]],
 ["malformed school ID",[{school_id:"forged"}]],
 ["no scope",[]],
]){
 test(label+" never creates privileged QR",async()=>{
  const h=handler({roles}),r=await h.run();
  assert.equal(r.status,403);
  assert.equal(h.calls.includes("ADMIN_CREATED"),false);
  assert.equal(r.headers.get("cache-control"),"private, no-store");
 });
}
test("role query outage is private 503 before admin",async()=>{
 const h=handler({dbError:{message:"PRIVATE_SQL"}}),r=await h.run();
 assert.equal(r.status,503);assert.equal(h.calls.includes("ADMIN_CREATED"),false);
});
test("provider outage with stale account is private 503 before role query",async()=>{
 const h=handler({authError:{message:"PRIVATE_AUTH"}}),r=await h.run();
 assert.equal(r.status,503);assert.equal(h.calls.includes("QUERY:user_roles"),false);
});
test("school activation unknown or false cannot generate QR",async()=>{
 for(const isActive of [false,null]){
  const h=handler({isActive}),r=await h.run();
  assert.equal(r.status,403);
 }
});
test("QR never reflects request Host and never uses profile as authority",()=>{
 assert.match(src,/getAuthPublicOrigin\(\)/);
 assert.doesNotMatch(src,/new URL\(request\.url\)\.origin|profile\?\.school_id/);
 assert.match(src,/resolveUniqueSchoolAdminSchoolId\(roles\)/);
});
