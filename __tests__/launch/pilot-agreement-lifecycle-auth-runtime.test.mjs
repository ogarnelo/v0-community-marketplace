import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const U="11111111-1111-4111-8111-111111111111";
const cases=[
 ["propose",{conversationId:U,amount:12}],
 ["confirm",{agreementId:U}],
 ["counter",{agreementId:U,amount:12}],
 ["cancel",{agreementId:U}],
 ["dispute",{agreementId:U,reason:"other",details:"Descripción suficientemente larga para revisión"}],
 ["review",{agreementId:U,rating:5}],
];
function setup(op,opts={}){
 const path="app/api/agreements/"+op+"/route.ts";
 const exports={},calls=[],user={id:U,email:"qa@example.invalid"};
 const c={auth:{getUser:async()=>{
  calls.push("AUTH");
  if(opts.throwAuth)throw Error("PRIVATE_AUTH_THROW");
  return {data:{user:opts.guest?null:user},error:
   opts.missing?{name:"AuthSessionMissingError"}:
   opts.missingCode?{code:"session_not_found"}:
   opts.provider?{name:"AuthDown",message:"PRIVATE_AUTH_PROVIDER"}:null};
 }}};
 const admin={rpc:async(name)=>{
  calls.push("RPC:"+name);
  return {data:null,error:{message:opts.rpcError||"not allowed"}};
 },from:(table)=>{
  calls.push("TABLE:"+table);
  const query={select:()=>query,eq:()=>query,
   maybeSingle:async()=>{
    if(opts.readError)return {data:null,error:{message:"PRIVATE_SQL_READ_ERROR"}};
    if(op==="dispute"&&table==="agreements")return {data:{listing_id:U,buyer_id:U,seller_id:"qa-seller"},error:null};
    if(op==="dispute"&&table==="listings")return {data:{id:U,title:"QA listing"},error:null};
    return {data:null,error:null};
   }};
  return query;
 }};
 const mocks={
  "next/server":{NextResponse:{json:(obj,config={})=>new Response(JSON.stringify(obj),
   {status:config.status??200,headers:config.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
   calls.push("CLIENT");if(opts.throwClient)throw Error("PRIVATE_CLIENT_ERROR");return c;
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{calls.push("ADMIN");return admin;}},
  "@/lib/emails/mvp-event-emails":{},
  "@/lib/notifications":{},
  "@/lib/emails/delivery-idempotency":{},
  "@/lib/demand/need-attribution":{},
  "@/lib/growth/server-attribution":{},
  "@/lib/analytics/product-events.server":{},
  "@/lib/seo/demo-listing":{isDemoListing:()=>false}
 };
 const source=readFileSync(path,"utf8");
 const compiled=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(compiled.outputText,{
  exports,require:id=>mocks[id]??{},Request,Response,URL,Date,Promise,Number,
  console:{error:()=>{}}
 },{filename:path,timeout:1500});
 return {calls,post:async(body)=>{
  const response=await exports.POST(new Request("https://fixture.invalid/api",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)
  }));
  return {status:response.status,cache:response.headers.get("cache-control"),body:await response.json()};
 }};
}
for(const [op,valid] of cases){
 for(const [label,opts,status] of [
  ["invitado",{guest:true},401],
  ["AuthSessionMissingError con user residual",{missing:true},401],
  ["session_not_found con user residual",{missingCode:true},401],
  ["proveedor caído con user residual",{provider:true},503],
  ["getUser arroja excepción",{throwAuth:true},500],
  ["createClient arroja excepción",{throwClient:true},500],
 ]){
  test(op+" · "+label+" => "+status,async()=>{
   const h=setup(op,opts),r=await h.post(valid);
   assert.equal(r.status,status);assert.equal(r.cache,"private, no-store");
   assert.equal(h.calls.includes("ADMIN"),false);
   assert.ok(!h.calls.some(x=>x.startsWith("RPC:")||x.startsWith("TABLE:")));
   assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
  });
 }
 test(op+" · sin entrada suficiente => 400 sin servicio",async()=>{
  const h=setup(op),r=await h.post({});
  assert.equal(r.status,400);assert.equal(r.cache,"private, no-store");
  assert.equal(h.calls.includes("ADMIN"),false);
 });
 test(op+" · usuario verificado alcanza comprobación de titularidad",async()=>{
  const h=setup(op),r=await h.post(valid);
  assert.equal(h.calls.includes("ADMIN"),true);
  assert.equal(r.cache,"private, no-store");
  assert.equal(r.status,op==="review"?404:403);
  if(op!=="review")assert.ok(h.calls.some(x=>x.startsWith("RPC:server_")));
 });
}
for(const [op,valid] of cases.slice(0,5)){
 test(op+" · error SQL inesperado se oculta",async()=>{
  const h=setup(op,{rpcError:"PRIVATE_SQL_DIAGNOSTIC"}),r=await h.post(valid);
  assert.equal(r.status,500);assert.equal(r.cache,"private, no-store");
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_SQL/);
 });
}
test("review · error de lectura devuelve 503 (no simula acuerdo inexistente)",async()=>{
 const h=setup("review",{readError:true}),r=await h.post({agreementId:U,rating:5});
 assert.equal(r.status,503);assert.equal(r.cache,"private, no-store");
 assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_SQL/);
});
