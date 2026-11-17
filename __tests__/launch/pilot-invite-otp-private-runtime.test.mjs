import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
function setup(o={}){
 const calls=[],exp={};
 const src=readFileSync("app/api/auth/activate-school-invite/route.ts","utf8");
 const code=ts.transpileModule(src,{fileName:"route.ts",reportDiagnostics:true,
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 assert.equal((code.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const mocks={
  "next/server":{NextResponse:{json:(data,options={})=>new Response(JSON.stringify(data),
   {status:options.status??200,headers:options.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
    calls.push("CLIENT");
    if(o.clientThrows)throw Error("PRIVATE_CLIENT");
    return {auth:{verifyOtp:async args=>{
      calls.push("OTP:"+args.type+":"+args.token_hash);
      if(o.verifyThrows)throw Error("PRIVATE_VERIFY");
      return {data:o.empty?null:{user:o.noUser?null:{id:"synthetic"}},
       error:o.error??null};
    }}};
  }}
 };
 vm.runInNewContext(code.outputText,{exports:exp,require:n=>mocks[n]??{},
  Date,Promise,Request,Response,console:{error:()=>{}}},
 {filename:"school-invite-otp.ts",timeout:1600});
 return {calls,post:async(body={tokenHash:"abc123",type:"invite"},raw)=>{
  const request=new Request("https://fixture.invalid/auth/activate",{method:"POST",
   headers:{"content-type":"application/json"},
   body:raw??JSON.stringify(body)});
  const r=await exp.POST(request);
  return {status:r.status,cache:r.headers.get("cache-control"),
    pragma:r.headers.get("pragma"),referrer:r.headers.get("referrer-policy"),body:await r.json()};
 }};
}
test("valid invite produces onboarding next path with private response",async()=>{
 const h=setup(),r=await h.post();
 assert.equal(r.status,200);assert.equal(r.body.ok,true);
 assert.equal(r.body.next,"/auth/complete-invite?next=/admin/school");
 assert.equal(r.cache,"private, no-store");
 assert.equal(r.pragma,"no-cache");
 assert.equal(r.referrer,"no-referrer");
 assert.deepEqual(h.calls,["CLIENT","OTP:invite:abc123"]);
});
test("valid magiclink retains legacy activation contract",async()=>{
 const h=setup(),r=await h.post({tokenHash:"a".repeat(64),type:"magiclink"});
 assert.equal(r.status,200);
 assert.equal(h.calls.length,2);
});
for(const [label,body] of [
 ["no token",{type:"invite"}],
 ["empty token",{tokenHash:" ",type:"invite"}],
 ["token not string",{tokenHash:{"sql":"PRIVATE"},type:"invite"}],
 ["empty type",{tokenHash:"xxx"}],
 ["unsupported type",{tokenHash:"xxx",type:"recovery"}],
 ["type not string",{tokenHash:"xxx",type:{x:true}}],
 ["hash length over bound",{tokenHash:"x".repeat(257),type:"invite"}]
]){
 test(label+" stops before Auth provider",async()=>{
  const h=setup(),r=await h.post(body);
  assert.equal(r.status,400);assert.equal(r.cache,"private, no-store");
  assert.deepEqual(h.calls,[]);
 });
}
test("invalid JSON stays 400 and does not invoke Auth",async()=>{
 const h=setup(),r=await h.post({},"invalid-json!");
 assert.equal(r.status,400);assert.deepEqual(h.calls,[]);
});
for(const [label,options,expected] of [
 ["invalid hash",{error:{status:400,message:"PRIVATE_BAD_TOKEN"}},400],
 ["expired hash",{error:{status:422,message:"PRIVATE_EXPIRED"}},400],
 ["coded expired hash",{error:{status:500,code:"otp_expired",message:"PRIVATE_EXP"}},400],
 ["Auth outage",{error:{status:503,message:"PRIVATE_AUTH"}},503],
 ["Auth unknown failure",{error:{message:"PRIVATE_AUTH_UNKNOWN"}},503],
 ["empty response",{empty:true},400],
 ["valid provider but no user",{noUser:true},400],
 ["verifyOtp throws",{verifyThrows:true},503],
 ["createClient throws",{clientThrows:true},503]
]){
 test(label+" is safely classified without raw exception",async()=>{
  const h=setup(options),r=await h.post();
  assert.equal(r.status,expected);assert.equal(r.cache,"private, no-store");
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
 });
}
test("route forbids raw error and token echo, caches none of the response",()=>{
 const src=readFileSync("app/api/auth/activate-school-invite/route.ts","utf8");
 assert.match(src,/MAX_TOKEN_HASH_LENGTH/);
 assert.match(src,/private, no-store/);
 assert.match(src,/if \(!data\?\.user\)/);
 assert.doesNotMatch(src,/cause\?\.message|error\.message|console\.error\([^\n]*,\s*error/);
});
