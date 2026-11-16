import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
const ID = "11111111-1111-4111-8111-111111111111";
class ApiError extends Error {
  constructor(message, status = 400, code = "invalid_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const cases = [
  ["account list", "app/api/account/students/route.ts", "GET", true, 200],
  ["account create", "app/api/account/students/route.ts", "POST", true, 201],
  ["account edit", "app/api/account/students/[id]/route.ts", "PATCH", true, 200],
  ["account remove", "app/api/account/students/[id]/route.ts", "DELETE", true, 200],
  ["course list", "app/api/my-course/needs/route.ts", "GET", true, 200],
  ["course create", "app/api/my-course/needs/route.ts", "POST", true, 201],
  ["course archive", "app/api/my-course/needs/[id]/route.ts", "DELETE", false, 200],
  ["course activate", "app/api/my-course/needs/[id]/search/route.ts", "POST", true, 200],
  ["course pause", "app/api/my-course/needs/[id]/search/route.ts", "DELETE", true, 200],
];
function harness(path, method, opt={}) {
  const actions=[];
  const {guest=false,missing=false,missingCode=false,provider=false,throws=false,
    clientThrows=false,unconfirmed=false}=opt;
  const user={id: ID,email_confirmed_at:unconfirmed?null:"2026-11-01T00:00:00Z"};
  const fake={
    auth:{getUser:async()=>{
      actions.push("GET_USER");
      if(throws)throw Error("PRIVATE_AUTH_EXCEPTION");
      return {data:{user:guest?null:user},
        error:missing?{name:"AuthSessionMissingError"}:
          missingCode?{code:"session_not_found"}:
          provider?{message:"PRIVATE_PROVIDER_ERROR",name:"ProviderDown"}:null};
    }},
    from:()=>{actions.push("DATABASE_ACCESS");throw Error("DATABASE_SHOULD_NOT_BE_ACCESSED");},
  };
  const act=name=>(...args)=>{actions.push("SERVICE:"+name);return Promise.resolve({
    id:ID, search_active:true, owner_user_id:args[0]});};
  const mocks={
    "next/server": {NextResponse:{json:(body,options={})=>
      new Response(JSON.stringify(body),{status:options.status??200,headers:options.headers??{}})}},
    "@/lib/supabase/server":{createClient:async()=>{
      actions.push("CLIENT");
      if(clientThrows)throw Error("PRIVATE_CREATE_ERROR");
      return fake;
    }},
    "@/lib/account-students/server":{
      AccountStudentError:ApiError, parseStudentInput:()=>({}),
      listAccountStudents:act("listAccountStudents"),
      createAccountStudent:act("createAccountStudent"),
      updateAccountStudent:act("updateAccountStudent"),
      deactivateAccountStudent:act("deactivateAccountStudent"),
    },
    "@/lib/my-course/course-needs-server":{
      CourseNeedError:ApiError,parseCourseNeedInput:()=>({}),
      listCourseNeeds:act("listCourseNeeds"),
      createCourseNeed:act("createCourseNeed"),
    },
    "@/lib/my-course/course-need-search-server":{
      archiveCourseNeedAndStopSearch:act("archiveCourseNeedAndStopSearch"),
      activateCourseNeedSearch:act("activateCourseNeedSearch"),
      pauseCourseNeedSearch:act("pauseCourseNeedSearch"),
    },
    "@/lib/analytics/product-events.server":{deferProductEvent:()=>actions.push("DEFER_EVENT")},
  };
  const src=readFileSync(path,"utf8");
  const transpiled=ts.transpileModule(src,{
    fileName:path,reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  });
  assert.equal(transpiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
  const exp={};
  vm.runInNewContext(transpiled.outputText,{
    exports:exp,require:id=>{if(!(id in mocks))throw Error("Unexpected import "+id);return mocks[id];},
    Date,Request,Response,Promise,URL,
    console:{error:()=>{}},
  },{timeout:1500,filename:path});
  return {actions,call:async()=>{
    const init={method};
    if(method==="POST"||method==="PATCH") {
      init.headers={"content-type":"application/json"};
      init.body=JSON.stringify({studentId:ID,title:"Prueba",gradeLevel:"ESO",code:"00000000"});
    }
    const response=await exp[method](new Request("https://synthetic.invalid/api/test",init),
      {params:Promise.resolve({id:ID})});
    return {status:response.status,cache:response.headers.get("cache-control"),
      body:await response.json()};
  }};
}
for(const [label,path,method,confirmed,success] of cases){
  for(const [scenario,opt,status] of [
    ["invitado", {guest:true},401],
    ["AuthSessionMissingError con usuario residual", {missing:true},401],
    ["session_not_found con usuario residual", {missingCode:true},401],
    ["proveedor caído con usuario residual", {provider:true},503],
    ["excepción Auth", {throws:true},503],
    ["excepción al crear cliente", {clientThrows:true},503],
  ]){
    test(label+" — "+scenario+" => "+status+" sin servicios",async()=>{
      const h=harness(path,method,opt),res=await h.call();
      assert.equal(res.status,status);
      assert.equal(res.cache,"private, no-store");
      assert.equal(h.actions.some(x=>x.startsWith("SERVICE:")||x==="DATABASE_ACCESS"||x==="DEFER_EVENT"),false);
      assert.doesNotMatch(JSON.stringify(res.body),/PRIVATE_|PROVIDER_ERROR|EXCEPTION/);
    });
  }
  if(confirmed)test(label+" — email sin confirmar => 403",async()=>{
    const h=harness(path,method,{unconfirmed:true}),r=await h.call();
    assert.equal(r.status,403);
    assert.equal(r.cache,"private, no-store");
    assert.equal(h.actions.some(x=>x.startsWith("SERVICE:")),false);
  });
  test(label+" — usuario verificado mantiene operación "+success,async()=>{
    const h=harness(path,method),r=await h.call();
    assert.equal(r.status,success);
    assert.equal(r.cache,"private, no-store");
    assert.equal(h.actions.some(x=>x.startsWith("SERVICE:")),true);
  });
}
