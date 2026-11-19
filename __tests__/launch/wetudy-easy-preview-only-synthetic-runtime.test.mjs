import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const path="app/demo/wetudy-easy/page.tsx";
const src=readFileSync(path,"utf8");
const demo=readFileSync("components/marketplace/wetudy-easy-demo.tsx","utf8");
function execute(env){
 const result=ts.transpileModule(src,{reportDiagnostics:true,compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,
  esModuleInterop:true
 }});
 assert.equal((result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const mod={exports:{}};
 vm.runInNewContext(result.outputText,{exports:mod.exports,module:mod,process:{env},require(name){
  if(name==="next/navigation")return {notFound:()=>{throw Error("NO_DEMO_IN_PRODUCTION")}};
  if(name==="@/components/marketplace/wetudy-easy-demo")return {WetudyEasyDemo:()=>null};
  if(name==="react/jsx-runtime")return {jsx:()=>({kind:"synthetic-page"}),jsxs:()=>({kind:"synthetic-page"})};
  throw Error("Unexpected import "+name);
 }},{timeout:1000});
 return mod.exports;
}
for(const env of [{VERCEL_ENV:"production"},{VERCEL_ENV:undefined},{}]){
 test("preview-only Wetudy Easy demo fails closed without preview",()=>{
  assert.throws(()=>execute(env).default(),/NO_DEMO_IN_PRODUCTION/);
 });
}
test("preview-only gate permits synthetic nonpublishing visualization",()=>{
 assert.doesNotThrow(()=>execute({VERCEL_ENV:"preview"}).default());
 assert.match(src,/index: false/);
 assert.match(src,/follow: false/);
});
test("demo makes no Supabase / OpenAI / Meta or backend calls",()=>{
 assert.match(demo,/Esta pantalla es una simulación/);
 assert.match(demo,/URL.createObjectURL\(file\)/);
 assert.match(demo,/URL.revokeObjectURL\(url\)/);
 assert.match(demo,/Publicación desactivada en esta demo/);
 assert.doesNotMatch(demo,/fetch\s*\(|createAdminClient|createClient\s*\(|OPENAI_API_KEY|supabase\.|stripe|whatsapp.*api/i);
 assert.match(demo,/disabled className=/);
});
test("demo only accepts bounded image types and leaves price condition to family",()=>{
 assert.match(demo,/image\/jpeg/);
 assert.match(demo,/chosen\.size <= 10 \* 1024 \* 1024/);
 assert.match(demo,/Lo decide la familia/);
 assert.match(demo,/Estado \(lo confirma la familia\)/);
});
