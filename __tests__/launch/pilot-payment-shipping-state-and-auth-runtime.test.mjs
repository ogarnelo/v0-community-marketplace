import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
const ELSE="22222222-2222-4222-8222-222222222222";
const endpoints=[
 ["payments","app/api/payments/create-intent/route.ts",{offerId:ID}],
 ["label","app/api/shipments/create-label/route.ts",{shipmentId:ID}],
 ["dispatch","app/api/shipments/mark-dispatched/route.ts",{shipmentId:ID}],
 ["delivered","app/api/shipments/mark-delivered/route.ts",{shipmentId:ID}]
];
const price={itemAmount:20,buyerFeeAmount:1,shippingAmount:2,sellerNetAmount:19,
 shipmentTier:"small",deliveryMethod:"shipping",totalBuyerAmount:23};
const payrow={id:ELSE,status:"requires_payment_method",offer_id:ID,listing_id:ID,
 buyer_id:ID,seller_id:ELSE,amount:20,currency:"EUR",buyer_fee_amount:1,shipping_amount:2,
 seller_net_amount:19,shipment_tier:"small",metadata:{delivery_method:"shipping"}};
function runtime(op,path,opts={}){
 const call=[],logs=[],exp={};
 const user={id:ID,email:"qa@example.invalid"};
 const offer={id:ID,listing_id:ID,buyer_id:ID,seller_id:ELSE,status:"accepted",offered_price:20,accepted_amount:20};
 const shipping={id:ID,shipment_id:ID,seller_id:ID,buyer_id:ID,status:"label_ready",
    payment_intent_id:ELSE,payload:null};
 const client={auth:{getUser:async()=>{
  call.push("AUTH");
  if(opts.throwAuth)throw Error("PRIVATE_AUTH_THROW");
  return {data:{user:opts.guest?null:user},error:
   opts.missing?{name:"AuthSessionMissingError"}:
   opts.missingCode?{code:"session_not_found"}:
   opts.provider?{name:"AuthDown",message:"PRIVATE_AUTH_PROVIDER"}:null};
 }}};
 const admin={from:(name)=>{
  call.push("FROM:"+name);
  const q={select:()=>q,eq:()=>q,limit:()=>q,
   maybeSingle:async()=>{
    if(name==="payment_intents")return {data:opts.previous||null,error:opts.readError?{message:"PRIVATE_SQL"}:null};
    if(name==="listing_offers")return {data:offer,error:null};
    if(name==="listings")return {data:{id:ID,status:"available"},error:null};
    if(name==="conversations")return {data:{id:ID},error:null};
    if(name==="shipments")return {data:opts.shipment||null,error:opts.shipError?{message:"PRIVATE_SQL"}:null};
    return {data:null,error:null};
   },
   insert:(row)=>{
    call.push("INSERT:"+name);
    if(name==="payment_intents"){
      call.push("PAYMENT_ROW:"+row.status);
      return {select:()=>({single:async()=>({data:opts.uniqueConflict?null:payrow,
        error:opts.uniqueConflict?{code:"23505"}:null})})};
    }
    return Promise.resolve({error:null});
   },
   upsert:()=>{call.push("UPSERT:"+name);throw Error("NEVER_UPSERT_PAYMENT");},
   update:()=>{call.push("UPDATE:"+name);return q;},
   then:(resolve,reject)=>Promise.resolve({error:null}).then(resolve,reject)
  };
  return q;
 }};
 const mocks={
  "next/server":{NextResponse:{json:(data,config={})=>new Response(JSON.stringify(data),
    {status:config.status??200,headers:config.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
   call.push("CLIENT");if(opts.throwClient)throw Error("PRIVATE_CLIENT_THROW");return client;
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{call.push("ADMIN");return admin;}},
  "@/lib/payments/pricing":{buildMarketplacePricing:()=>price},
  "@/lib/payments/offer-amount":{getAcceptedOfferAmount:()=>20},
  "@/lib/commerce/private-access":{
   canUserUseCommerce:async()=>opts.disallowed?false:true,
   isPublicCommerceEnabled:()=>false,
   assertStripeTestMode:()=>{},
   isPrivateShippingLabelCreationEnabled:()=>true
  },
  "@/lib/logistics/sendcloud":{
   isSendcloudConfigured:()=>true,
   createSendcloudParcel:async()=>{call.push("SENDCLOUD");throw Error("MUST_NOT_CREATE_LABEL");}
  }
 };
 const content=readFileSync(path,"utf8"),compiled=ts.transpileModule(content,{
  fileName:path,reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}
 });
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(compiled.outputText,{
  exports:exp,require:x=>mocks[x]??{},Request,Response,Date,URL,Promise,Number,
  console:{error:(...args)=>logs.push(args)}
 },{filename:path,timeout:1500});
 return {call,post:async(body)=>{
  const response=await exp.POST(new Request("https://fixture.invalid/api",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify(body)
  }));
  return {status:response.status,cache:response.headers.get("cache-control"),body:await response.json()};
 }};
}
for(const [name,path,valid] of endpoints){
 for(const [scenario,opts,code] of [
  ["invitado",{guest:true},401],
  ["AuthSessionMissingError con user residual",{missing:true},401],
  ["session_not_found con user residual",{missingCode:true},401],
  ["proveedor caído con user residual",{provider:true},503],
  ["getUser lanza",{throwAuth:true},name==="label"?503:500],
  ["createClient lanza",{throwClient:true},name==="label"?503:500]
 ]){
  test(name+" | "+scenario+" | "+code,async()=>{
   const h=runtime(name,path,opts),r=await h.post(valid);
   assert.equal(r.status,code);
   assert.equal(r.cache,"private, no-store");
   assert.equal(h.call.includes("ADMIN"),false);
   assert.equal(h.call.includes("SENDCLOUD"),false);
   assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_|MUST_NOT/);
  });
 }
 test(name+" | no hay acceso a service_role con cuerpo incompleto",async()=>{
  const h=runtime(name,path),r=await h.post({});
  assert.equal(r.status,400);
  assert.equal(r.cache,"private, no-store");
  assert.equal(h.call.includes("ADMIN"),false);
 });
 test(name+" | la feature gate se evalúa antes que el cliente privilegiado",async()=>{
  const h=runtime(name,path,{disallowed:true}),r=await h.post(valid);
  assert.equal(r.status,404);assert.equal(r.cache,"private, no-store");
  assert.equal(h.call.includes("ADMIN"),false);
 });
}
const payment=endpoints[0];
for(const [scenario,opts,expected,shouldInsert] of [
 ["pago confirmado NO puede reiniciarse",{previous:{...payrow,status:"succeeded"}},409,false],
 ["pago en proceso NO puede rebajarse",{previous:{...payrow,status:"processing"}},409,false],
 ["condiciones económicas diferentes NO se sobrescriben",{previous:{...payrow,amount:21}},409,false],
 ["reintento compatible reutiliza intento SIN escribir",{previous:payrow},200,false],
 ["primer intento genera INSERT, nunca UPSERT",{},200,true],
 ["colisión de índice único 23505 se trata como concurrencia",{uniqueConflict:true},409,true],
 ["fallo leyendo intento anterior es 503, nunca INSERT",{readError:true},503,false]
]){
 test("payment_intents | "+scenario,async()=>{
  const h=runtime(payment[0],payment[1],opts),r=await h.post(payment[2]);
  assert.equal(r.status,expected);
  assert.equal(r.cache,"private, no-store");
  assert.equal(h.call.some(x=>x.startsWith("UPSERT:")),false);
  assert.equal(h.call.includes("INSERT:payment_intents"),shouldInsert);
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_SQL|NEVER_UPSERT/);
 });
}
test("shipment label | error consulta SQL no simula envío inexistente",async()=>{
 const h=runtime("label",endpoints[1][1],{shipError:true}),r=await h.post({shipmentId:ID});
 assert.equal(r.status,503);assert.equal(r.cache,"private, no-store");
 assert.equal(h.call.includes("SENDCLOUD"),false);
});
for(const idx of [2,3]){
 test(endpoints[idx][0]+" | error SQL no simula envío inexistente",async()=>{
  const h=runtime(endpoints[idx][0],endpoints[idx][1],{shipError:true}),r=await h.post({shipmentId:ID});
  assert.equal(r.status,503);assert.equal(r.cache,"private, no-store");
 });
}
test("Sendcloud | proveedor ya creó etiqueta, fallo de escritura NO fuerza fallback manual",()=>{
 const src=readFileSync(endpoints[1][1],"utf8");
 assert.match(src,/sendcloud_label_created_but_db_update_failed/);
 assert.match(src,/requiere conciliación antes de reintentar/);
 assert.ok(src.indexOf("return privateJson(")<src.indexOf("const adminSupabase = createAdminClient()"));
 assert.doesNotMatch(src,/message: error\?\.message/);
});
