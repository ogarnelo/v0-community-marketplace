import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const USER="11111111-1111-4111-8111-111111111111",SCHOOL="22222222-2222-4222-8222-222222222222";
async function run(mode,payload={enabled:true,dayOfMonth:12}){
 const writes=[],out={};
 const from=name=>{
  const q={select:()=>q,eq:()=>q,update:body=>{writes.push(["update",body]);return q;},
   insert:async body=>{writes.push(["insert",body]);return {error:mode==="race"?{code:"23505"}:null}},
   maybeSingle:async()=>name==="schools"?{data:{id:SCHOOL,is_active:true},error:null}:
    {data:mode==="missing"||mode==="race"||mode==="error"?null:{id:"existing"},
     error:mode==="error"?{message:"PRIVATE_SQL"}:null}};
  return q;
 };
 const modules={
  "next/server":{NextResponse:{json:(b,o={})=>new Response(JSON.stringify(b),{status:o.status||200,headers:o.headers})}},
  "@/lib/supabase/server":{createClient:async()=>({
   auth:{getUser:async()=>({data:{user:{id:USER,email:"test@example.invalid",email_confirmed_at:"2026-11-01"}},error:null})},
   from:()=>({select:()=>({eq:async()=>({data:[{role:"school_admin",school_id:SCHOOL}],error:null})})})
  })},
  "@/lib/supabase/admin":{createAdminClient:()=>({from})}
 };
 const js=ts.transpileModule(readFileSync("app/api/school/report-subscription/route.ts","utf8"),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(js,{exports:out,require:n=>{assert.ok(n in modules,n);return modules[n]},Response,Request,Date,console:{error:()=>{}}});
 const response=await out.POST(new Request("https://example.invalid",{method:"POST",body:mode==="invalid-json"?"{":JSON.stringify(payload)}));
 return {status:response.status,body:await response.json(),cache:response.headers.get("cache-control"),writes};
}
test("update preserves the report delivery marker",async()=>{
 const r=await run("existing");assert.equal(r.status,200);assert.deepEqual(r.writes.map(w=>w[0]),["update"]);
 assert.equal(Object.hasOwn(r.writes[0][1],"last_sent_month"),false);
});
test("new subscription uses INSERT only after no UPDATE match",async()=>{
 const r=await run("missing");assert.equal(r.status,200);assert.deepEqual(r.writes.map(w=>w[0]),["update","insert"]);
});
test("concurrent creation 23505 does not reset marker",async()=>{
 const r=await run("race");assert.equal(r.status,409);assert.equal(r.cache,"private, no-store");
 assert.deepEqual(r.writes.map(w=>w[0]),["update","insert"]);
});
test("SQL failure never falls through to insert",async()=>{
 const r=await run("error");assert.equal(r.status,503);assert.deepEqual(r.writes.map(w=>w[0]),["update"]);
 assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_SQL/);
});

test("missing enabled cannot silently turn off monthly email",async()=>{
 const r=await run("existing",{dayOfMonth:12});
 assert.equal(r.status,400);assert.equal(r.writes.length,0);
});
test("malformed JSON and string-valued enabled are rejected without writes",async()=>{
 for(const [mode,payload] of [["invalid-json",{}],["existing",{enabled:"false",dayOfMonth:12}]]) {
  const r=await run(mode,payload);assert.equal(r.status,400);assert.equal(r.writes.length,0);
 }
});
test("malformed email type cannot cause an unexpected server exception",async()=>{
 const r=await run("existing",{enabled:true,email:123,dayOfMonth:12});
 assert.equal(r.status,400);assert.equal(r.writes.length,0);
});
