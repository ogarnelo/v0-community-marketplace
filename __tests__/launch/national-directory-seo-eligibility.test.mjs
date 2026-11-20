import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import {readFileSync} from "node:fs";

const src=readFileSync("lib/schools/directory-seo-eligibility.ts","utf8");
const page=readFileSync("app/centros/[code]/page.tsx","utf8");
const sitemap=readFileSync("app/sitemap.ts","utf8");
const js=ts.transpileModule(src,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const CODE="28000001";
const linked="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const good={official_code:CODE,is_listed:true,seo_indexable:true,linked_school_id:linked};
const school={id:linked};
const demo={id:"d0000000-0000-4000-8000-abcdef123456",title:"Demo · material"};
const genuine={id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",title:"Libro real"};

function fixture({publicFlag=true,seoFlag=true,centre=good,
 schoolRow=school,offers=[genuine],fail=null}={}) {
 const calls=[];
 const env={WETUDY_PUBLIC_SCHOOL_DIRECTORY_ENABLED:publicFlag?"true":"",
  WETUDY_DIRECTORY_SEO_ENABLED:seoFlag?"true":""};
 const admin={from(table){
  const filters=[];
  const query={
   select(fields){calls.push({table,method:"select",fields});return query;},
   eq(key,value){filters.push([key,value]);return query;},
   limit(max){
    calls.push({table,method:"limit",max,filters:[...filters]});
    if(table!=="listings")throw Error("unexpected limit");
    if(fail===table)return Promise.resolve({data:null,error:{message:"internal"}});
    return Promise.resolve({data:offers,error:null});
   },
   maybeSingle(){
    calls.push({table,method:"single",filters:[...filters]});
    if(fail===table)return Promise.resolve({data:null,error:{message:"internal"}});
    return Promise.resolve({data:table==="school_directory"?centre:schoolRow,error:null});
   }
  };
  return query;
 }};
 const m={exports:{}};
 vm.runInNewContext(js,{
  module:m,exports:m.exports,process:{env},
  require(name){
   if(name==="@/lib/supabase/admin")return{createAdminClient:()=>admin};
   if(name==="@/lib/seo/demo-listing")return{isDemoListing:(x)=>
    x.id?.startsWith("d0000000-")||/^demo[·:—-]/i.test(x.title||"")};
   if(name==="@/lib/schools/listed-directory-centre")return{
    VALID_OFFICIAL_SCHOOL_CODE:/^[0-9]{8}$/};
   throw Error("unexpected "+name);
  }
 });
 return {eligible:m.exports.isDirectoryCentreSeoEligible,
  enabled:m.exports.isDirectorySeoEnabled,calls};
}

test("both flags OFF by default: no service client or candidate lookup",async()=>{
 for(const option of [{publicFlag:false},{seoFlag:false},
  {publicFlag:false,seoFlag:false}]){
  const f=fixture(option);
  assert.equal(f.enabled(),false);
  assert.equal(await f.eligible(CODE),false);
  assert.equal(f.calls.length,0);
 }
 const f=fixture();
 assert.equal(await f.eligible("not-a-code"),false);
 assert.equal(f.calls.length,0);
});
test("only double-approved listed, linked and live school with genuine material may index",async()=>{
 const f=fixture();
 assert.equal(await f.eligible(CODE),true);
 assert.ok(f.calls.some(c=>c.table==="school_directory"&&
   c.filters.some(([k,v])=>k==="is_listed"&&v===true)&&
   c.filters.some(([k,v])=>k==="seo_indexable"&&v===true)));
 assert.ok(f.calls.some(c=>c.table==="schools"&&
   c.filters.some(([k,v])=>k==="is_active"&&v===true)&&
   c.filters.some(([k,v])=>k==="is_test"&&v===false)));
 assert.ok(f.calls.some(c=>c.table==="listings"&&
   c.filters.some(([k,v])=>k==="school_id"&&v===linked)&&
   c.filters.some(([k,v])=>k==="status"&&v==="available")));
 assert.ok(f.calls.every(c=>c.method!=="limit"||c.max<=40));
});
test("reject unpublished, unapproved, unlinked, demo and empty listings",async()=>{
 const options=[
  {centre:{...good,is_listed:false}},
  {centre:{...good,seo_indexable:false}},
  {centre:{...good,linked_school_id:null}},
  {centre:null},{schoolRow:null},
  {offers:[demo]},{offers:[]},{offers:[{...genuine,title:"   "}]},
 ];
 for(const opts of options)assert.equal(await fixture(opts).eligible(CODE),false);
});
test("provider failure cannot turn SEO on",async()=>{
 for(const fail of ["school_directory","schools","listings"]){
  assert.equal(await fixture({fail}).eligible(CODE),false,fail);
 }
});
test("metadata and sitemap use same separate eligibility gate; bounded indexing",()=>{
 assert.match(page,/isDirectoryCentreSeoEligible/);
 assert.match(page,/robots: \{ index: canIndex, follow: canIndex \}/);
 assert.match(page,/if \(!gate\(\)\) return disabled/);
 assert.match(sitemap,/isDirectorySeoEnabled\(\)/);
 assert.match(sitemap,/isDirectoryCentreSeoEligible\(centre\.official_code\)/);
 assert.match(sitemap,/\.eq\("is_listed", true\)/);
 assert.match(sitemap,/\.eq\("seo_indexable", true\)/);
 assert.match(sitemap,/\.limit\(24\)/);
 assert.doesNotMatch(src,/school_access_codes|auth\.users|user_roles|\.from\("profiles"\)/);
});
