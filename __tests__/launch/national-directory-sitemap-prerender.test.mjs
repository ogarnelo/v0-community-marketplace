import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";

const source=readFileSync("app/sitemap.ts","utf8");
const compiled=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

function loadSitemap({seo=false,failListings=false}={}) {
 const calls=[];
 const listing={
  id:"11111111-1111-4111-8111-111111111111",title:"Libro real",
  school_id:null,updated_at:"2026-11-20T00:00:00Z"
 };
 const admin={from(table) {
  calls.push(table);
  const q={
   select(){return q;},
   eq(){return q;},
   not(){return q;},
   order(){return q;},
   limit(){return Promise.resolve(table==="listings"
     ?(failListings?{data:null,error:{code:"unavailable"}}:
       {data:[listing],error:null}):{data:[],error:null});},
   in(){return Promise.resolve({data:[],error:null});}
  };
  return q;
 }};
 const mod={exports:{}};
 vm.runInNewContext(compiled,{
  module:mod,exports:mod.exports,Date,Set,
  console:{error:()=>{}},
  require(name) {
   if(name==="@/lib/supabase/admin")return {createAdminClient:()=>admin};
   if(name==="@/lib/blog-data")return {posts:[]};
   if(name==="@/lib/seo/demo-listing")return {isDemoListing:()=>false};
   if(name==="@/lib/schools/directory-seo-eligibility")return {
    isDirectorySeoEnabled:()=>seo,
    isDirectoryCentreSeoEligible:async()=>false,
   };
   if(name==="@/lib/schools/listed-directory-centre")return {
    directoryPageUrl:(code)=>"https://www.wetudy.com/centros/"+code,
   };
   throw new Error("unexpected import "+name);
  }
 });
 return {sitemap:mod.exports.default,calls};
}

test("sitemap can render with directory SEO off without recursion or undefined variable",async()=>{
 const f=loadSitemap();
 const rows=await f.sitemap();
 assert.ok(rows.some(x=>x.url==="https://www.wetudy.com/"));
 assert.ok(rows.some(x=>x.url.includes("/marketplace/listing/")));
 assert.ok(rows.every(x=>!x.url.includes("/centros/")));
 assert.equal(f.calls.filter(x=>x==="school_directory").length,0);
});
test("flag enabled but no eligible schools never adds centres",async()=>{
 const f=loadSitemap({seo:true});
 const rows=await f.sitemap();
 assert.ok(rows.every(x=>!x.url.includes("/centros/")));
 assert.equal(f.calls.filter(x=>x==="school_directory").length,1);
});
test("sitemap failure to list marketplace does not break base/static entries",async()=>{
 const f=loadSitemap({failListings:true});
 const rows=await f.sitemap();
 assert.ok(rows.some(x=>x.url==="https://www.wetudy.com/"));
});
test("SEO helper cannot recursively initialize itself or lack parent initializer",()=>{
 const helper=source.slice(source.indexOf("async function approvedDirectorySeoPages"),
   source.indexOf("export const revalidate"));
 assert.doesNotMatch(helper,/const directoryPages = await approvedDirectorySeoPages\(/);
 const main=source.slice(source.indexOf("export default async function sitemap"));
 assert.match(main,/const directoryPages = await approvedDirectorySeoPages\(\)/);
});
