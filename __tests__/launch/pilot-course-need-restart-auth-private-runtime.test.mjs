import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
class CourseNeedError extends Error {
 constructor(message,status,code){super(message);this.status=status;this.code=code;this.name="CourseNeedError";}
}
function harness(opts={}){
 const events=[],exp={},user={id:ID,email_confirmed_at:opts.unconfirmed?null:"2026-11-17T00:00:00Z"};
 const mock={
  "next/server":{NextResponse:{json:(body,opts={})=>new Response(JSON.stringify(body),
   {status:opts.status??200,headers:opts.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
    events.push("CLIENT");if(opts.clientThrows)throw Error("PRIVATE_CLIENT");
    return {auth:{getUser:async()=>{
      events.push("AUTH");if(opts.authThrows)throw Error("PRIVATE_AUTH");
      return {data:{user:opts.guest?null:user},error:
        opts.missing?{name:"AuthSessionMissingError"}:
        opts.missingCode?{code:"session_not_found"}:
        opts.provider?{name:"ServiceDown",message:"PRIVATE_PROVIDER"}:null};
    }}};
  }},
  "@/lib/my-course/course-needs-server":{CourseNeedError},
  "@/lib/my-course/course-need-restart-server":{restartFulfilledCourseNeed:async(uid,id)=>{
    events.push("SERVICE:"+uid+":"+id);
    if(opts.serviceError==="known")throw new CourseNeedError("Esa necesidad no está disponible en Conseguidos.",404,"fulfilled_need_not_found");
    if(opts.serviceError==="unknown")throw Error("PRIVATE_SQL");
    return {need:{id,status:"active"},restarted_from_id:id,
      previous_demand_request_id:null,reused_existing:false};
  }}
 };
 const src=readFileSync("app/api/my-course/needs/[id]/restart/route.ts","utf8");
 const output=ts.transpileModule(src,{fileName:"route.ts",reportDiagnostics:true,
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal(output.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(output.outputText,{exports:exp,require:name=>mock[name]??{},
  Date,Promise,Request,Response,console:{error:()=>{}}},{filename:"route.ts",timeout:1500});
 return {events,post:async()=>{
   const r=await exp.POST(new Request("https://fixture.invalid/api",{method:"POST"}),
    {params:Promise.resolve({id:ID})});
   return {status:r.status,cache:r.headers.get("cache-control"),body:await r.json()};
 }};
}
for(const [name,opts,code] of [
 ["guest",{guest:true},401],
 ["AuthSessionMissingError with residual user",{missing:true},401],
 ["session_not_found with residual user",{missingCode:true},401],
 ["Auth outage with residual user",{provider:true},503],
 ["getUser throws",{authThrows:true},503],
 ["createClient throws",{clientThrows:true},503],
 ["email not confirmed",{unconfirmed:true},403],
 ["known missing need",{serviceError:"known"},404],
 ["unexpected service SQL fails",{serviceError:"unknown"},500],
 ["valid restart",{},200],
]){
 test(name+" => "+code,async()=>{
  const h=harness(opts),r=await h.post();
  assert.equal(r.status,code);assert.equal(r.cache,"private, no-store");
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
  if(code===401||code===503&&(opts.provider||opts.authThrows||opts.clientThrows)||code===403)
   assert.equal(h.events.some(x=>x.startsWith("SERVICE:")),false);
  if(code===200){
   assert.equal(r.body.need.search_active,true);assert.equal(r.body.restarted_from_id,ID);
   assert.ok(h.events.includes("SERVICE:"+ID+":"+ID));
  }
 });
}
test("restart route mirrors other Mi curso routes' privacy/fail-closed contract",()=>{
 const s=readFileSync("app/api/my-course/needs/[id]/restart/route.ts","utf8");
 assert.match(s,/export const dynamic = "force-dynamic"/);
 assert.match(s,/private, no-store/);
 assert.match(s,/if \(authError\)/);
 assert.match(s,/data\?\.user \?\? null/);
 assert.doesNotMatch(s,/console.error\([^\n]*,\s*error/);
});
