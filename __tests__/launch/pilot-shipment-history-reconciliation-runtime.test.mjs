import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
const PAYMENT="22222222-2222-4222-8222-222222222222";
function setup(kind,opts={}){
 const calls=[],exp={},user={id:ID,email:"qa@example.invalid"};
 const client={auth:{getUser:async()=>({data:{user},error:null})}};
 const query=(name)=>{
  const q={
   select:()=>q,eq:()=>q,
   maybeSingle:async()=>{
    if(name==="shipments"){
     if(opts.shipmentReadError)return {data:null,error:{message:"PRIVATE_SHIP_SQL"}};
     return {data:{id:ID,seller_id:ID,buyer_id:ID,status:kind==="dispatch"?"label_ready":"in_transit",
         payment_intent_id:PAYMENT,payload:{}},error:null};
    }
    if(name==="payment_intents")return {data:{id:PAYMENT,status:"succeeded",metadata:{}},
      error:opts.paymentReadError?{message:"PRIVATE_PAY_SQL"}:null};
    return {data:null,error:null};
   },
   update:(_row)=>{
    calls.push("UPDATE:"+name);
    return {
     eq:()=>({
      eq:()=>({select:()=>({maybeSingle:async()=>({
       data:opts.updateMissing&&name==="shipments"?null:
         opts.paymentUpdateMissing&&name==="payment_intents"?null:{id:name==="shipments"?ID:PAYMENT},
       error:opts.updateError&&name==="shipments"?{message:"PRIVATE_UPDATE"}:
         opts.paymentUpdateError&&name==="payment_intents"?{message:"PRIVATE_PAYMENT_UPDATE"}:null
      })})})
     })
    };
   },
   insert:async()=>{calls.push("INSERT:"+name);return {error:opts.eventError?{message:"PRIVATE_EVENT_SQL"}:null};}
  };return q;
 };
 const admin={from:name=>{calls.push("FROM:"+name);return query(name)}};
 const mocks={
  "next/server":{NextResponse:{json:(body,o={})=>new Response(JSON.stringify(body),
      {status:o.status??200,headers:o.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>client},
  "@/lib/supabase/admin":{createAdminClient:()=>admin},
  "@/lib/commerce/private-access":{canUserUseCommerce:async()=>true,
    isPublicCommerceEnabled:()=>false,assertStripeTestMode:()=>{},isPrivateShippingLabelCreationEnabled:()=>true}
 };
 const path="app/api/shipments/mark-"+(kind==="dispatch"?"dispatched":"delivered")+"/route.ts";
 const code=readFileSync(path,"utf8"),output=ts.transpileModule(code,{fileName:path,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true},
  reportDiagnostics:true});
 assert.equal((output.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(output.outputText,{exports:exp,require:x=>mocks[x]??{},Request,Response,Date,URL,Promise,
  console:{error:()=>{}}},{filename:path,timeout:2000});
 return {calls,post:async()=>{
  const r=await exp.POST(new Request("https://fixture.invalid/api",{method:"POST",
   headers:{"content-type":"application/json"},body:JSON.stringify({shipmentId:ID})}));
  return {status:r.status,cache:r.headers.get("cache-control"),body:await r.json()};
 }};
}
for(const [kind,options,expected] of [
 ["dispatch",{},200],["dispatch",{eventError:true},503],
 ["dispatch",{updateError:true},503],["dispatch",{updateMissing:true},409],
 ["delivery",{},200],["delivery",{eventError:true},503],
 ["delivery",{paymentUpdateError:true},503],["delivery",{paymentUpdateMissing:true},503],
 ["delivery",{paymentReadError:true},503],["delivery",{updateError:true},503],
 ["delivery",{updateMissing:true},409]
]){
 test(kind+" "+JSON.stringify(options)+" => "+expected,async()=>{
  const h=setup(kind,options),r=await h.post();
  assert.equal(r.status,expected);assert.equal(r.cache,"private, no-store");
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
  if(options.eventError)assert.ok(h.calls.includes("INSERT:shipment_events"));
  if(options.paymentReadError||options.updateError||options.updateMissing)
   assert.ok(!h.calls.includes("INSERT:shipment_events"));
  if(kind==="delivery"&&options.eventError)assert.ok(h.calls.includes("UPDATE:payment_intents"));
 });
}
test("el historial no se declara consistente si falla su escritura",()=>{
 const a=readFileSync("app/api/shipments/mark-dispatched/route.ts","utf8");
 const b=readFileSync("app/api/shipments/mark-delivered/route.ts","utf8");
 assert.match(a,/shipment_dispatch_event_write_failed/);
 assert.match(b,/shipment_delivery_event_write_failed/);
 assert.match(b,/reconciliationRequired/);
 assert.match(b,/paymentUpdated/);
});
