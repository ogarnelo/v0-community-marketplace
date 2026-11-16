import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
const OTHER="22222222-2222-4222-8222-222222222222";
function setup(opts={}){
 const calls=[],exp={},user={id:ID,email:"admin@example.invalid"};
 const req={id:ID,listing_id:ID,requester_id:ID,school_id:ID,status:opts.status||"pending"};
 const qRoles={select:()=>qRoles,eq:()=>qRoles,then:(r,j)=>Promise.resolve({
   data:opts.noRole?[]:[{role:"school_admin",school_id:ID}],error:opts.roleError?{message:"PRIVATE_ROLE_SQL"}:null
 }).then(r,j)};
 const db={auth:{getUser:async()=>{
   calls.push("AUTH");
   if(opts.throwAuth)throw Error("PRIVATE_AUTH");
   return {data:{user:opts.guest?null:user},error:opts.missing?{name:"AuthSessionMissingError"}:
     opts.missingCode?{code:"session_not_found"}:opts.authDown?{name:"ProviderError"}:null};
 }},from:()=>qRoles};
 const admin={from:(table)=>{
   calls.push("ADMIN_FROM:"+table);
   const q={
     select:()=>q,eq:()=>q,neq:()=>q,
     maybeSingle:async()=>{
      if(table==="donation_requests")return {data:opts.noRequest?null:req,error:opts.requestError?{message:"PRIVATE_SQL"}:null};
      if(table==="listings")return {data:{id:ID,school_id:opts.otherSchool?OTHER:ID,title:"QA",seller_id:OTHER},
        error:opts.listingError?{message:"PRIVATE_SQL"}:null};
      if(table==="conversations")return {data:null,error:opts.conversationError?{message:"PRIVATE_SQL"}:null};
      return {data:null,error:null};
     },
     update:()=>{
       calls.push("WRITE:"+table);
       return {eq:()=>({
        eq:()=>({select:()=>({maybeSingle:async()=>({
          data:opts.race?null:{id:ID},error:opts.writeError?{message:"PRIVATE_SQL"}:null
        })})})
       })};
     }
   };
   return q;
 }};
 const mocks={
  "next/server":{NextResponse:{json:(body,o={})=>new Response(JSON.stringify(body),
   {status:o.status??200,headers:o.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{if(opts.throwClient)throw Error("PRIVATE_CLIENT");return db;}},
  "@/lib/supabase/admin":{createAdminClient:()=>{calls.push("ADMIN");return admin;}},
  "@/lib/admin/roles":{getAdminFlags:({roles})=>{
   const school=roles?.find(x=>x.role==="school_admin");
   return {canAccessAdmin:!!school,isSuperAdmin:false,schoolAdminSchoolId:school?.school_id||null};
  }},
  "@/lib/notifications":{createNotifications:async()=>({error:null})}
 };
 const path="app/api/donations/review/route.ts",src=readFileSync(path,"utf8");
 const c=ts.transpileModule(src,{fileName:path,reportDiagnostics:true,compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true
 }});
 assert.equal((c.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(c.outputText,{exports:exp,require:x=>mocks[x]??{},Request,Response,Date,Promise,
  console:{error:()=>{}}},{filename:path,timeout:2000});
 return {calls,post:async(body={donationRequestId:ID,action:"approve"})=>{
  const r=await exp.POST(new Request("https://fixture.invalid/api",{method:"POST",
   headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}));
  return {status:r.status,cache:r.headers.get("cache-control"),body:await r.json()};
 }};
}
for(const [label,opts,code] of [
 ["invitado",{guest:true},401],
 ["sesión ausente con user residual",{missing:true},401],
 ["session_not_found residual",{missingCode:true},401],
 ["Auth caída residual",{authDown:true},503],
 ["lectura roles falla",{roleError:true},503],
 ["sin rol admin",{noRole:true},403],
 ["consulta solicitud falla",{requestError:true},503],
 ["solicitud no existe",{noRequest:true},404],
 ["solicitud ya resuelta",{status:"approved"},409],
 ["centro de anuncio distinto",{otherSchool:true},409],
 ["consulta listado falla",{listingError:true},503],
 ["consulta conversación falla",{conversationError:true},503],
]){
 test(label+" => "+code+" antes de escribir",async()=>{
  const h=setup(opts),r=await h.post();
  assert.equal(r.status,code);assert.equal(r.cache,"private, no-store");
  assert.equal(h.calls.some(x=>x.startsWith("WRITE:")),false);
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
 });
}
test("acción desconocida no equivale a rechazar",async()=>{
 const h=setup(),r=await h.post({donationRequestId:ID,action:"undo"});
 assert.equal(r.status,400);assert.equal(h.calls.includes("ADMIN"),false);
});
for(const action of ["approve","reject"]){
 test(action+" con carrera de estado => 409 sin efectos posteriores",async()=>{
  const h=setup({race:true}),r=await h.post({donationRequestId:ID,action});
  assert.equal(r.status,409);assert.equal(r.cache,"private, no-store");
  assert.equal(h.calls.filter(x=>x.startsWith("WRITE:")).length,1);
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
 });
 test(action+" con SQL fallido => 503 sin efectos posteriores",async()=>{
  const h=setup({writeError:true}),r=await h.post({donationRequestId:ID,action});
  assert.equal(r.status,503);assert.equal(h.calls.filter(x=>x.startsWith("WRITE:")).length,1);
 });
}
test("ninguna ruta de actualización primaria omite status=pending ni confirmación de fila",()=>{
 const s=readFileSync("app/api/donations/review/route.ts","utf8");
 assert.equal((s.match(/\.eq\("status", "pending"\)\s*\.select\("id"\)\s*\.maybeSingle\(\)/g)||[]).length,2);
});
