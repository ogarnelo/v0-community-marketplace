import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
function setup(o={}){
 const calls=[],exp={},user=o.guest?null:{id:ID,email:"user@example.invalid",
   email_confirmed_at:o.unconfirmed?null:"2026-11-16"};
 const supabase={auth:{getUser:async()=>{
   calls.push("AUTH");
   if(o.throwAuth)throw Error("PRIVATE_AUTH_THROW");
   return {data:{user},error:o.missing?{name:"AuthSessionMissingError"}:
     o.missingCode?{code:"session_not_found"}:
     o.provider?{name:"SupabaseDown",message:"PRIVATE_AUTH_PROVIDER"}:null};
 }}};
 const builder={
  select:()=>builder,
  eq:()=>builder,
  ilike:()=>{calls.push("SEARCH");return builder;},
  maybeSingle:async()=>({data:{official_code:"00000000",name:"Centro ficticio",
       municipality:"Madrid",province:"Madrid",postal_code:"28001"},
       error:o.dbError?{message:"PRIVATE_DB_ERROR"}:null}),
  order:()=>builder,
  limit:()=>builder,
  returns:async()=>({data:[{official_code:"00000000",name:"Centro ficticio",
       municipality:"Madrid",province:"Madrid",postal_code:"28001"}],
       error:o.dbError?{message:"PRIVATE_DB_ERROR"}:null})
 };
 const mocks={
  "next/server":{NextResponse:{json:(body,options={})=>new Response(JSON.stringify(body),
   {status:options.status??200,headers:options.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
   calls.push("CLIENT");if(o.throwClient)throw Error("PRIVATE_CLIENT");return supabase;
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{
   calls.push("ADMIN");return {from:()=>builder};
  }}
 };
 const path="app/api/account/schools/directory/route.ts";
 const transpiled=ts.transpileModule(readFileSync(path,"utf8"),{
   fileName:path,reportDiagnostics:true,compilerOptions:{
     target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true
   }
 });
 assert.equal((transpiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(transpiled.outputText,{
   exports:exp,require:name=>mocks[name]??{},Request,Response,URL,Promise,
   console:{error:()=>{}}
 },{filename:path,timeout:1500});
 return {calls,get:async(q="q=Centro")=>{
   const response=await exp.GET(new Request("https://fixture.invalid/api?"+q));
   return {status:response.status,cache:response.headers.get("cache-control"),
     body:await response.json()};
 }};
}
for(const [name,o,status] of [
 ["sin usuario",{guest:true},401],
 ["sesión ausente con usuario residual",{missing:true},401],
 ["session_not_found con usuario residual",{missingCode:true},401],
 ["proveedor fallido con usuario residual",{provider:true},503],
 ["getUser lanza error",{throwAuth:true},503],
 ["createClient lanza error",{throwClient:true},503],
 ["correo no confirmado",{unconfirmed:true},401]
]){
 test(name+" => "+status+" sin consultas privilegiadas",async()=>{
  const h=setup(o),r=await h.get();
  assert.equal(r.status,status);assert.equal(r.cache,"private, no-store");
  assert.ok(!h.calls.includes("ADMIN"));
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
 });
}
test("q corto no consulta al servicio privilegiado",async()=>{
 const h=setup(),r=await h.get("q=ab");
 assert.equal(r.status,200);assert.deepEqual(Array.from(r.body.centres),[]);
 assert.ok(!h.calls.includes("ADMIN"));
});
test("q demasiado largo no usa service_role",async()=>{
 const h=setup(),r=await h.get("q="+("a".repeat(91)));
 assert.equal(r.status,200);assert.ok(!h.calls.includes("ADMIN"));
});
test("código oficial no válido devuelve 400 sin admin",async()=>{
 const h=setup(),r=await h.get("code=ABC");
 assert.equal(r.status,400);assert.ok(!h.calls.includes("ADMIN"));
});
test("código oficial de ocho dígitos obtiene un centro",async()=>{
 const h=setup(),r=await h.get("code=00000000");
 assert.equal(r.status,200);assert.equal(r.cache,"private, no-store");
 assert.equal(r.body.centre.official_code,"00000000");assert.ok(h.calls.includes("ADMIN"));
});
test("búsqueda por nombre devuelve como máximo configuración de centros permitidos",async()=>{
 const h=setup(),r=await h.get("q=Centro");
 assert.equal(r.status,200);assert.equal(r.body.limit,20);
 assert.ok(h.calls.includes("ADMIN"));assert.ok(h.calls.includes("SEARCH"));
});
test("error leyendo directorio es 503 sin eco del proveedor",async()=>{
 const h=setup({dbError:true}),r=await h.get("code=00000000");
 assert.equal(r.status,503);assert.equal(r.cache,"private, no-store");
 assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
});
test("search input mantiene límite de términos y no se imprimen errores personales",()=>{
 const s=readFileSync("app/api/account/schools/directory/route.ts","utf8");
 assert.match(s,/\.slice\(0, 7\)/);
 assert.match(s,/school_directory_lookup_failed/);
 assert.doesNotMatch(s,/console\.error\([^)]*, error\)/);
});
