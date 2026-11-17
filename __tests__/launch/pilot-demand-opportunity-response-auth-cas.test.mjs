import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111",KEY="opp_abcdefabcdefabcdefabcdef";
function h(o={}){
 const events=[],exp={};
 const c={auth:{getUser:async()=>({data:{user:o.guest?null:{id:ID}},
 error:o.missing?{name:"AuthSessionMissingError"}:o.provider?{name:"AuthDown",message:"PRIVATE_AUTH"}:null})}};
 const admin={from:name=>{
  events.push("ADMIN");
  const state={writing:false},q={
   select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,is:()=>q,
   update:obj=>{events.push("UPDATE:"+obj.response);state.writing=true;return q;},
   maybeSingle:async()=>state.writing?{data:o.race?null:{id:ID},
     error:o.writeError?{message:"PRIVATE_WRITE"}:null}:
     {data:o.missingAction?null:{id:ID,response:o.previous??null,
       responded_at:o.answered?"2026-11-16T22:00:00Z":null},
       error:o.readError?{message:"PRIVATE_READ"}:null}
  };return q;
 }};
 const src=readFileSync("app/api/demand/opportunities/[key]/response/route.ts","utf8");
 const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,
 target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
 assert.equal(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(compiled.outputText,{
 exports:exp,require:n=>n==="next/server"?{NextResponse:{json:(body,opts={})=>
   new Response(JSON.stringify(body),{status:opts.status??200,headers:opts.headers??{}})}}:
 n==="@/lib/supabase/server"?{createClient:async()=>c}:
 n==="@/lib/supabase/admin"?{createAdminClient:()=>admin}:{},
 Date,Promise,Request,Response,encodeURIComponent,console:{error:()=>{}}
 },{filename:"opportunity-route.ts",timeout:1800});
 return {events,post:async(body={response:"have_one"},key=KEY)=>{
  const r=await exp.POST(new Request("https://fixture.invalid/api",{method:"POST",
   body:JSON.stringify(body),headers:{"Content-Type":"application/json"}}),
   {params:Promise.resolve({key})});
  return {status:r.status,cache:r.headers.get("cache-control"),body:await r.json()};
 }};
}
for(const [name,o,status] of [
 ["guest",{guest:true},401],["missing with residual user",{missing:true},401],
 ["provider down residual",{provider:true},503],["missing action",{missingAction:true},404],
 ["read SQL fails",{readError:true},503],["CAS lost",{race:true},409],
 ["write SQL fails",{writeError:true},503]
]){
 test(name+" => "+status,async()=>{
  const x=h(o),r=await x.post();
  assert.equal(r.status,status);assert.equal(r.cache,"private, no-store");
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
  if(o.guest||o.missing||o.provider)assert.equal(x.events.includes("ADMIN"),false);
 });
}
test("valid have_one => publication link and one conditional update",async()=>{
 const x=h(),r=await x.post();assert.equal(r.status,200);
 assert.equal(r.body.publishHref,"/marketplace/new?opportunity="+KEY);
 assert.deepEqual(x.events,["ADMIN","UPDATE:have_one"]);
});
test("dont_have => no publication link",async()=>{
 const x=h(),r=await x.post({response:"dont_have"});
 assert.equal(r.status,200);assert.equal(r.body.publishHref,null);
});
test("duplicate exact answer has no write",async()=>{
 const x=h({previous:"have_one",answered:true}),r=await x.post();
 assert.equal(r.status,200);assert.equal(r.body.alreadyExists,true);
 assert.ok(!x.events.some(e=>e.startsWith("UPDATE:")));
});
test("confirmed different answer cannot be overwritten",async()=>{
 const x=h({previous:"dont_have",answered:true}),r=await x.post();
 assert.equal(r.status,409);assert.ok(!x.events.some(e=>e.startsWith("UPDATE:")));
});
test("invalid response and invalid key rejected without service role",async()=>{
 for(const args of [[{response:"undo"},KEY],[{response:"have_one"},"../../invalid"]]){
  const x=h(),r=await x.post(args[0],args[1]);
  assert.equal(r.status,400);assert.equal(x.events.includes("ADMIN"),false);
 }
});
test("opportunity page fails closed on authError and privileged read errors",()=>{
 const s=readFileSync("app/supply-opportunity/[key]/page.tsx","utf8");
 assert.match(s,/data: authData, error: authError/);
 assert.ok(s.indexOf("if (authError)")<s.indexOf("const admin = createAdminClient()"));
 assert.match(s,/actionResult.error \|\| campaignResult.error/);
});
