import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts=createRequire(import.meta.url)("typescript");
const cases=[
  ["app/api/offers/buy-now/route.ts","No se pudo iniciar la compra.","buy_now_checkout_failed"],
  ["app/api/payments/create-intent/route.ts","No se pudo preparar el pago.","payment_intent_prepare_failed"],
  ["app/api/reports/route.ts","No se pudo enviar el reporte.","moderation_report_create_failed"],
];
function load(routePath){
  const src=readFileSync(routePath,"utf8");
  const compile=ts.transpileModule(src,{fileName:routePath,reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
  assert.equal((compile.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
  const exports={};
  const logs=[];
  const next={NextResponse:{json:(body,opts={})=>new Response(JSON.stringify(body),{
    status:opts.status??200,headers:opts.headers??{}
  })}};
  const modules={
    "next/server":next,
    "@/lib/supabase/server":{createClient:async()=>{throw Error("SQL_PRIVATE_DO_NOT_LEAK")}},
  };
  vm.runInNewContext(compile.outputText,{
    exports,require:name=>modules[name]??{},Request,Response,URL,Date,
    console:{error:(...args)=>logs.push(args)},
  },{filename:routePath,timeout:1500});
  return {handler:exports.POST,logs,src};
}
for(const [route,error,log] of cases){
  test(route+" returns private generic 500 on sensitive dependency failure",async()=>{
    const {handler,logs}=load(route);
    const response=await handler(new Request("https://fixture.invalid/endpoint",{
      method:"POST",body:JSON.stringify({listingId:"not-real"}),
      headers:{"content-type":"application/json"}
    }));
    assert.equal(response.status,500);
    assert.match(response.headers.get("cache-control")??"",/private, no-store/);
    const body=await response.text();
    assert.ok(body.includes(error));
    assert.ok(!body.includes("SQL_PRIVATE_DO_NOT_LEAK"));
    assert.deepEqual(logs,[[log]]);
  });
  test(route+" never reflects privileged exception messages in the handler",()=>{
    const {src}=load(route);
    assert.doesNotMatch(src,/error\?\.message\s*\|\||error\?\.details\s*\|\|/);
    assert.doesNotMatch(src,/console\.error\([^)]*,\s*error/);
  });
}
