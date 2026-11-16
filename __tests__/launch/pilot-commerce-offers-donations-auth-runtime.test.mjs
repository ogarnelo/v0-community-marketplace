import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
const routes=[
 ["oferta nueva","app/api/offers/create/route.ts","offerCreate"],
 ["responder oferta","app/api/offers/respond/route.ts","offerRespond"],
 ["solicitud donación","app/api/donations/request/route.ts","donationRequest"],
 ["responder donación","app/api/donations/respond/route.ts","donationRespond"],
];
function runtime(path,op,opts={}){
 const calls=[],logs=[],exp={};
 const user={id:ID,email:"member@example.invalid"};
 const supabase={auth:{getUser:async()=>{
   calls.push("GET_USER");
   if(opts.throwAuth)throw Error("PRIVATE_AUTH_CRASH");
   return {data:{user:opts.guest?null:user},error:
      opts.missing?{name:"AuthSessionMissingError"}:
      opts.missingCode?{code:"session_not_found"}:
      opts.provider?{name:"AuthProviderDown",message:"PRIVATE_AUTH_DOWN"}:null};
 }}};
 const mocks={
  "next/server":{NextResponse:{json:(body,options={})=>new Response(JSON.stringify(body),
     {status:options.status??200,headers:options.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
    calls.push("CLIENT");if(opts.throwClient)throw Error("PRIVATE_CLIENT_CRASH");
    return supabase;
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{
    calls.push("ADMIN");
    if(opts.forbidAdmin)throw Error("MUST_NOT_USE_ADMIN");
    return {kind:"mock"};
  }},
  "@/lib/launch/feature-gates":{isLegacyCommerceEnabled:()=>opts.disabled?false:true},
  "@/lib/services/offers.service":{
    createOfferFlow:async(args)=>{
      calls.push("OFFER_CREATE:"+args.actorUserId);
      if(opts.throwService)throw Error("PRIVATE_SERVICE_SQL");
      if(opts.businessError)throw Error("La oferta ya no admite cambios.");
      return {offerId:ID,conversationId:ID,alreadyExists:opts.alreadyExists??false};
    },
    respondToOfferFlow:async(args)=>{
      calls.push("OFFER_RESPOND:"+args.actorUserId);
      if(opts.throwService)throw Error("PRIVATE_SERVICE_SQL");
      if(opts.businessError)throw Error("Esta oferta no admite cambios.");
      return {offerId:ID};
    }
  },
  "@/lib/services/donations.service":{
    requestDonationFlow:async(args)=>{
      calls.push("DONATION_REQUEST:"+args.actorUserId);
      if(opts.throwService)throw Error("PRIVATE_SERVICE_SQL");
      return {requestId:ID,conversationId:ID};
    },
    respondToDonationFlow:async(args)=>{
      calls.push("DONATION_RESPOND:"+args.actorUserId);
      if(opts.throwService)throw Error("PRIVATE_SERVICE_SQL");
      return {requestId:ID};
    }
  },
  "@/lib/demand/need-attribution":{attributeNeedToConversation:async()=>{
    calls.push("ATTRIBUTION");
  }}
 };
 const code=readFileSync(path,"utf8");
 const result=ts.transpileModule(code,{fileName:path,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal(result.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(result.outputText,{
  exports:exp,require:x=>mocks[x]??{},console:{error:(...args)=>logs.push(args)},
  Request,Response,URL,Promise,Date,Number
 },{filename:path,timeout:1500});
 const payload={
   offerCreate:{listingId:ID,offeredPrice:10},
   offerRespond:{offerId:ID,action:"accept"},
   donationRequest:{listingId:ID,note:"interesado"},
   donationRespond:{requestId:ID,action:"accept"}
 };
 return {calls,logs,post:async(body=payload[op])=>{
   const req=new Request("https://fixture.invalid/api",{method:"POST",body:JSON.stringify(body),headers:{"content-type":"application/json"}});
   const response=await exp.POST(req);
   return {status:response.status,cache:response.headers.get("cache-control"),body:await response.json()};
 }};
}
for(const [label,path,op] of routes){
 for(const [scenario,config,status] of [
  ["sin usuario",{guest:true},401],
  ["AuthSessionMissingError con user residual",{missing:true},401],
  ["session_not_found con user residual",{missingCode:true},401],
  ["proveedor Auth caído con user residual",{provider:true},503],
  ["getUser lanza",{throwAuth:true},500],
  ["createClient lanza",{throwClient:true},500],
 ]){
  test(label+" · "+scenario+" → "+status,async()=>{
   const t=runtime(path,op,config),r=await t.post();
   assert.equal(r.status,status);
   assert.equal(r.cache,"private, no-store");
   assert.equal(t.calls.includes("ADMIN"),false);
   assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_|MUST_NOT/);
  });
 }
 test(label+" · entrada inválida no invoca servicio",async()=>{
  const t=runtime(path,op,{forbidAdmin:true}),r=await t.post({});
  assert.equal(r.status,400);
  assert.equal(r.cache,"private, no-store");
  assert.equal(t.calls.includes("ADMIN"),false);
 });
 test(label+" · usuario válido conserva resultado de negocio",async()=>{
  const t=runtime(path,op),r=await t.post();
  assert.equal(r.status,200);
  assert.equal(r.cache,"private, no-store");
  assert.equal(t.calls.includes("ADMIN"),true);
  assert.equal(r.body.ok,true);
  const operation={offerCreate:"OFFER_CREATE:",offerRespond:"OFFER_RESPOND:",
    donationRequest:"DONATION_REQUEST:",donationRespond:"DONATION_RESPOND:"}[op];
  assert.ok(t.calls.includes(operation+ID));
 });
 test(label+" · excepción de proveedor no se expone",async()=>{
  const t=runtime(path,op,{throwService:true}),r=await t.post();
  assert.equal(r.status,500);assert.equal(r.cache,"private, no-store");
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_|SQL|MUST_NOT/);
 });
}
for(const [label,path,op] of routes.slice(0,2)){
 test(label+" · feature gate LegacyCommerce apagado retorna 404 sin auth",async()=>{
  const t=runtime(path,op,{disabled:true}),r=await t.post();
  assert.equal(r.status,404);assert.equal(r.cache,"private, no-store");
  assert.ok(!t.calls.includes("GET_USER"));
 });
}
test("responder oferta · error conocido mantiene estado y mensaje controlado",async()=>{
 const t=runtime("app/api/offers/respond/route.ts","offerRespond",{businessError:true}),r=await t.post();
 assert.equal(r.status,400);assert.match(r.body.error,/no admite cambios/);
 assert.equal(r.cache,"private, no-store");
});
test("crear oferta · negociación abierta se conserva como conflicto 409 con ruta del chat",async()=>{
 const t=runtime("app/api/offers/create/route.ts","offerCreate",{alreadyExists:true}),r=await t.post();
 assert.equal(r.status,409);assert.match(r.body.redirectTo,/^\/messages\//);
 assert.equal(r.cache,"private, no-store");
});
test("crear donación · mantiene atribución interna tras éxito",async()=>{
 const t=runtime("app/api/donations/request/route.ts","donationRequest"),r=await t.post();
 assert.equal(r.status,200);assert.ok(t.calls.includes("ATTRIBUTION"));
});
