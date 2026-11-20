import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadTs(path, map={}) {
 const raw=readFileSync(path,"utf8");
 const compiled=ts.transpileModule(raw,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const mod={exports:{}};
 vm.runInNewContext(compiled,{module:mod,exports:mod.exports,
  URL,URLSearchParams,Number,
  require(name){assert.ok(name in map,"Unexpected import "+name);return map[name];}});
 return mod.exports;
}
const parser=loadTs("lib/schools/public-directory-search.ts");
const page=readFileSync("app/centros/page.tsx","utf8");
const client=readFileSync("components/schools/national-school-directory.tsx","utf8");
const route=readFileSync("app/api/school-directory/route.ts","utf8");
const query=(input)=>parser.getDirectorySearch(new URL("https://wetudy.test/?"+input).searchParams);

test("bounded, literal national filters reject hostile pages/communities",()=>{
 assert.equal(query("page=1").ok,true);
 assert.equal(query("page=2000").ok,true);
 for(const v of ["0","2001","-1","1.2","999999999","1e4"]){
  assert.equal(query("page="+encodeURIComponent(v)).ok,false,v);
 }
 assert.equal(query("community=MadeUp").ok,false);
 assert.equal(query("province=%3BDELETE").ok,false);
 assert.equal(query("q="+"a".repeat(81)).ok,false);
 const p=query("q="+encodeURIComponent("A%_\\B"));
 assert.equal(p.ok,true);
 assert.equal(p.pattern,"%A\\%\\_\\\\B%");
});
function fixture({enabled=false,failed=false,rows=[]}={}){
 const calls=[];
 const queryObject={
  select(fields,opts){
   calls.push(["select",fields,opts]);
   return queryObject;
  },
  eq(key,value){calls.push(["eq",key,value]);return queryObject;},
  ilike(key,value){calls.push(["ilike",key,value]);return queryObject;},
  order(key,opts){calls.push(["order",key,opts]);return queryObject;},
  range(from,to){
   calls.push(["range",from,to]);
   return Promise.resolve(failed?{data:null,count:null,error:{message:"private"}}
      :{data:rows,count:rows.length,error:null});
  },
 };
 const map={
  "next/server":{NextResponse:{json:(body,init)=>({body,status:init.status,headers:init.headers})}},
  "@/lib/supabase/admin":{createAdminClient:()=>({from(name){
   calls.push(["from",name]);return queryObject;
  }})},
  "@/lib/schools/public-directory-search":parser
 };
 const output=ts.transpileModule(route,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const mod={exports:{}};
 vm.runInNewContext(output,{exports:mod.exports,module:mod,URL,Request,
  process:{env:{WETUDY_PUBLIC_SCHOOL_DIRECTORY_ENABLED:enabled?"true":""}},
  console:{error:()=>{}},require(name){assert.ok(name in map,name);return map[name];}});
 return {get:mod.exports.GET,calls};
}
test("public route disabled by default before any service query",async()=>{
 const f=fixture();
 const r=await f.get(new Request("https://wetudy.test/api/school-directory?q=abc"));
 assert.equal(r.status,404);
 assert.equal(r.body.error,"feature_disabled");
 assert.equal(f.calls.length,0);
 assert.equal(r.headers["Cache-Control"],"private, no-store");
});
test("enabled route lists only editorially approved schools",async()=>{
 const f=fixture({enabled:true,rows:[{
  official_code:"28000001",name:"Colegio ficticio",school_type:"Colegio",
  category:"público",municipality:"Madrid",province:"Madrid",
  autonomous_community:"Comunidad de Madrid",postal_code:"28001"
 }]});
 const r=await f.get(new Request("https://wetudy.test/api/school-directory?q=colegio&page=2&community=Comunidad%20de%20Madrid"));
 assert.equal(r.status,200);
 assert.equal(r.body.page,2);
 assert.equal(r.body.pageSize,24);
 assert.deepEqual(Array.from(f.calls.find(x=>x[0]==="eq"&&x[1]==="is_listed")),["eq","is_listed",true]);
 assert.ok(f.calls.some(x=>x[0]==="ilike"&&x[1]==="search_text"));
 assert.ok(f.calls.some(x=>x[0]==="range"&&x[1]===24&&x[2]===47));
 assert.doesNotMatch(f.calls.find(x=>x[0]==="select")[1],/phone|email|linked_school_id|school_access_codes/);
});
test("invalid page never hits service, provider error never leaks details",async()=>{
 const f=fixture({enabled:true});
 assert.equal((await f.get(new Request("https://wetudy.test/api/school-directory?page=9999"))).status,400);
 assert.equal(f.calls.length,0);
 const broken=fixture({enabled:true,failed:true});
 const r=await broken.get(new Request("https://wetudy.test/api/school-directory"));
 assert.equal(r.status,503);
 assert.equal(JSON.stringify(r.body).includes("private"),false);
});
test("page is independent from the private family selector and noindexed",()=>{
 assert.match(page,/WETUDY_PUBLIC_SCHOOL_DIRECTORY_ENABLED\\s*!==\\s*"true"/);
 assert.match(page,/notFound\(\)/);
 assert.match(page,/robots:\{index:false,follow:false\}/);
 assert.match(route,/\.eq\("is_listed",true\)/);
});
test("UI never pretends listings are verified AMPAs, or links unpublished records",()=>{
 assert.match(client,/Adhesión a WETUDY no confirmada/);
 assert.match(client,/Solo aparecen centros aprobados para publicación/);
 assert.match(client,/new AbortController/);
 assert.match(client,/cache:"no-store"/);
 assert.doesNotMatch(client,/href=\{\x60\/centros\/|school_access_codes|createAdminClient/);
 assert.doesNotMatch(route,/\.from\("schools"\)|\.from\("profiles"\)|\.from\("user_roles"\)/);
});
