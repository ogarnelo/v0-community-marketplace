import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const source=readFileSync("lib/emails/school-impact-report-email.ts","utf8");
const transpiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
}}).outputText;
const report={
 school:{id:"11111111-1111-4111-8111-111111111111",name:"Escuela sintética"},
 periodLabel:"Octubre 2026",periodKey:"2026-10",reusedItems:0,donatedItems:0,
 soldItems:0,estimatedAvoidedCo2:0,
};
async function send(providerResult){
 const out={};let calls=0,mailArgs=null;
 const brand={
  EMAIL_BRAND:{text:"#111",muted:"#555"},
  brandedEmailShell:()=>"<html>mock</html>",
  emailButton:()=>"<a>mock</a>",
  escapeEmailHtml:x=>x,
  getEmailBaseUrl:()=> "https://example.invalid",
  sendBrandedEmail:async(args)=>{calls++;mailArgs=args;return providerResult}
 };
 vm.runInNewContext(transpiled,{exports:out,require:n=>{
  assert.equal(n,"@/lib/emails/brand");return brand;
 },Buffer,Promise},{filename:"school-mail.js",timeout:1500});
 try{
  const result=await out.sendMonthlySchoolImpactEmail({
   to:"admin@example.invalid",report,pdf:new Uint8Array([37,80,68,70])
  });
  return {result,calls,mailArgs};
 }catch(e){return {error:String(e),calls,mailArgs}}
}
test("missing mail provider is never reported as accepted delivery",async()=>{
 const r=await send({skipped:true});
 assert.match(r.error,/school_impact_mail_provider_not_configured/);
 assert.equal(r.calls,1);
 assert.ok(r.mailArgs.idempotencyKey.includes("2026-10"));
});
test("provider-accepted email result remains usable for audit",async()=>{
 const r=await send({id:"synthetic-provider-id"});
 assert.equal(r.error,undefined);
 assert.equal(r.result.id,"synthetic-provider-id");
 assert.equal(r.calls,1);
});
