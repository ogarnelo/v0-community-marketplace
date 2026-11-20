import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const F="28000001";
const lookup=readFileSync("lib/schools/listed-directory-centre.ts","utf8");
const route=readFileSync("app/api/school-directory/[code]/qr/route.ts","utf8");
const page=readFileSync("app/centros/[code]/page.tsx","utf8");
const list=readFileSync("components/schools/national-school-directory.tsx","utf8");
const transpile=(code)=>ts.transpileModule(code,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const centre={official_code:F,name:"Cole ficticio",school_type:"Centro",
 category:"Público",municipality:"Madrid",province:"Madrid",
 autonomous_community:"Comunidad de Madrid",postal_code:"28001",address:null};

function makeFixture({enabled=false,listed=true,failed=false}={}) {
 const calls=[];
 const query={
  select(columns){calls.push(["select",columns]);return query;},
  eq(field,value){calls.push(["eq",field,value]);return query;},
  async maybeSingle(){return failed?{data:null,error:{code:"db_error"}}:
    {data:listed?centre:null,error:null};}
 };
 const mod={exports:{}};
 vm.runInNewContext(transpile(lookup),{
  module:mod,exports:mod.exports,
  require(name){assert.equal(name,"@/lib/supabase/admin");return {
   createAdminClient:()=>({from(table){
    assert.equal(table,"school_directory");calls.push(["from",table]);return query;
   }})
  };}
 });
 const qrCalls=[];
 class ResponseMock {
  constructor(body,opts={}){this.body=body;this.status=opts.status??200;
   this.headers=opts.headers||{};}
 }
 const q={exports:{}};
 vm.runInNewContext(transpile(route),{
  module:q,exports:q.exports,URL,Uint8Array,
  process:{env:{WETUDY_PUBLIC_SCHOOL_DIRECTORY_ENABLED:enabled?"true":""}},
  console:{error:()=>{}},
  require(name){
   if(name==="next/server")return{NextResponse:ResponseMock};
   if(name==="qrcode")return {__esModule:true,default:{
    async toBuffer(url){qrCalls.push(["png",url]);return Uint8Array.from([1,2]);},
    async toString(url){qrCalls.push(["svg",url]);return "<svg/>";}
   }};
   if(name==="@/lib/schools/listed-directory-centre")return mod.exports;
   throw Error("Unexpected import: "+name);
  }
 });
 return {GET:q.exports.GET,calls,qrCalls,lookup:mod.exports};
}
const request=(suffix="")=>new Request("https://wetudy.test/api/school-directory/"+F+"/qr"+suffix);
const params=(code=F)=>({params:Promise.resolve({code})});

test("no QR lookup before gate; invalid and unlisted codes reveal nothing",async()=>{
 const off=makeFixture();
 assert.equal((await off.GET(request(),params())).status,404);
 assert.equal(off.calls.length,0);
 const invalid=makeFixture({enabled:true});
 assert.equal((await invalid.GET(request(),params("not-code"))).status,404);
 assert.equal(invalid.calls.length,0);
 const unpublished=makeFixture({enabled:true,listed:false});
 assert.equal((await unpublished.GET(request(),params())).status,404);
 assert.equal(unpublished.qrCalls.length,0);
 assert.deepEqual(unpublished.calls.filter(x=>x[0]==="eq"),
   [["eq","official_code",F],["eq","is_listed",true]]);
});

test("listed QR is canonical informational-only link, not an invite",async()=>{
 const f=makeFixture({enabled:true});
 const svg=await f.GET(request(),params());
 assert.equal(svg.status,200);
 assert.equal(svg.headers["Content-Type"],"image/svg+xml; charset=utf-8");
 assert.equal(svg.headers["Cache-Control"],"private, no-store");
 assert.deepEqual(f.qrCalls,[["svg","https://www.wetudy.com/centros/"+F]]);
 const png=await f.GET(request("?format=png&download=1"),params());
 assert.equal(png.status,200);
 assert.equal(png.headers["Content-Type"],"image/png");
 assert.match(png.headers["Content-Disposition"],/^attachment/);
 assert.deepEqual(f.qrCalls[1],["png","https://www.wetudy.com/centros/"+F]);
 assert.doesNotMatch(JSON.stringify(f.qrCalls),/school_access_codes|join|token|invite/);
});

test("failed DB does not generate QR or disclose provider errors",async()=>{
 const f=makeFixture({enabled:true,failed:true});
 const r=await f.GET(request(),params());
 assert.equal(r.status,503);
 assert.equal(f.qrCalls.length,0);
 assert.equal(String(r.body).includes("db_error"),false);
});

test("detail and QR share gate, editorial lookup, noindex, no secret links",()=>{
 assert.match(page,/WETUDY_PUBLIC_SCHOOL_DIRECTORY_ENABLED/);
 assert.match(route,/WETUDY_PUBLIC_SCHOOL_DIRECTORY_ENABLED/);
 assert.match(lookup,/\.eq\("is_listed", true\)/);
 assert.match(page,/robots: \{ index: false, follow: false \}/);
 assert.match(page,/readListedDirectoryCentre/);
 assert.match(route,/readListedDirectoryCentre/);
 assert.match(list,/\/centros\//);
 for(const str of [page,route,lookup]){
  assert.doesNotMatch(str,/school_access_codes|service_role|\/api\/school\/share-qr/);
 }
});
