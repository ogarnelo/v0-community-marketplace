import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const file=readFileSync("lib/reports/school-impact-report.ts","utf8");
const js=ts.transpileModule(file,{fileName:"school-impact-report.ts",
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const uuid=n=>String(n).padStart(8,"0")+"-1111-4111-8111-111111111111";
const schoolId=uuid(1),otherSchool=uuid(2);
function harness({listingCount=151,viewCount=2,incidentError=false,missingViewCount=false,
 membersCount=2400,adminsCount=20,missingMembersCount=false,missingAdminsCount=false}={}){
 const records=[];
 const listings=Array.from({length:listingCount},(_,i)=>({
  id:uuid(100+i),title:"Libro",category:"libros",isbn:null,
  status:"available",created_at:"2026-01-01T00:00:00Z",
 }));
 const allReports=[{id:uuid(50001),listing_id:uuid(100),status:"open",target_type:"listing"},
  {id:uuid(50002),listing_id:uuid(101),status:"reviewing",target_type:"listing"},
  {id:uuid(50003),listing_id:uuid(9999),status:"open",target_type:"listing",schoolId:otherSchool}];
 function makeQuery(table){
  const filters={};
  const q={
   select(...args){filters.select=args;return q},
   order(column,opts){filters.order=[column,opts];return q},
   range(first,last){filters.range=[first,last];return q},
   eq(key,value){filters[key]=value;return q},
   in(key,value){filters[key]=value;return q},
   lt(key,value){filters[key+"-lt"]=value;return q},
   gte(key,value){filters[key+"-gte"]=value;return q},
   maybeSingle(){return Promise.resolve(result())},
   returns(){return Promise.resolve(result())},
   then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)},
  };
  function result(){
   records.push({table,filters:{...filters}});
   if(table==="schools")return {data:{id:schoolId,name:"Colegio",is_active:true,city:null,region:null},error:null};
   if(table==="listings")return {data:filters.range
     ? listings.slice(filters.range[0],filters.range[1]+1):listings,error:null};
   if(table==="profiles")return {data:null,count:missingMembersCount?null:membersCount,error:null};
   if(table==="user_roles")return {data:null,count:missingAdminsCount?null:adminsCount,error:null};
   if(table==="agreements")return {data:[],error:null};
   if(table==="listing_views")return {data:null,count:missingViewCount?null:viewCount,error:null};
   if(table==="reports"){
    if(incidentError)return {data:null,error:new Error("REPORTS_DB_FAILURE")};
    if(!Array.isArray(filters.listing_id))throw Error("CROSS_SCHOOL_REPORT_QUERY");
    const matching=allReports.filter(x=>filters.listing_id.includes(x.listing_id));
    return {data:filters.range
      ? matching.slice(filters.range[0],filters.range[1]+1):matching,error:null};
   }
   throw Error("unexpected "+table);
  }
  return q;
 }
 const out={};
 vm.runInNewContext(js,{exports:out,require:name=>{
  if(name==="server-only")return {};
  if(name==="@/lib/supabase/admin")return {createAdminClient:()=>({from:makeQuery})};
  throw Error(name);
 },Date,Set,Map,Intl,Number,Error,TextEncoder,Array,Math},
 {filename:"school-impact-report.cjs",timeout:1500});
 return {records,listings,load:()=>out.loadSchoolImpactReport({
  schoolId,start:new Date("2026-01-01T00:00:00Z"),
  end:new Date("2026-12-01T00:00:00Z"),periodLabel:"Informe",periodKey:"365d",
 })};
}
test("open incident reads stay scoped to each school's listing IDs with bounded chunks",async()=>{
 const h=harness(),result=await h.load();
 const incidents=h.records.filter(q=>q.table==="reports");
 const views=h.records.filter(q=>q.table==="listing_views");
 assert.equal(incidents.length,3);assert.equal(views.length,3);
 for(const q of incidents){
  assert.ok(q.filters.listing_id.length<=75);
  assert.equal(q.filters.target_type,"listing");
  assert.deepEqual(Array.from(q.filters.status),["open","reviewing"]);
  assert.ok(q.filters.listing_id.every(id=>h.listings.some(l=>l.id===id)));
 }
 assert.equal(result.openReports,2);
 assert.equal(result.listingViews,6);
 assert.equal(h.records.some(q=>q.table==="reports" && !q.filters.listing_id),false);
});
test("empty school performs no global incident or views lookup",async()=>{
 const h=harness({listingCount:0}),report=await h.load();
 assert.equal(report.openReports,0);assert.equal(report.listingViews,0);
 assert.equal(h.records.filter(q=>["reports","listing_views"].includes(q.table)).length,0);
});
test("incident database failures fail closed rather than reporting zero",async()=>{
 const h=harness({incidentError:true});
 await assert.rejects(h.load(),/REPORTS_DB_FAILURE/);
});
test("missing authoritative listing-view count fails rather than reporting zero",async()=>{
 const h=harness({missingViewCount:true});
 await assert.rejects(h.load(),/SCHOOL_REPORT_VIEW_COUNT_UNAVAILABLE/);
});

test("member and school-admin counts use exact head-only queries, even beyond 1000 users",async()=>{
 const h=harness({membersCount:2400,adminsCount:1100}),result=await h.load();
 assert.equal(result.members,2400);
 assert.equal(result.administrators,1100);
 for(const table of ["profiles","user_roles"]){
  const q=h.records.find(entry=>entry.table===table);
  assert.equal(q.filters.select[1].head,true);
  assert.equal(q.filters.select[1].count,"exact");
  assert.equal(q.filters.school_id,schoolId);
 }
});
test("null authoritative member count blocks report and prevents false small-group privacy",async()=>{
 const h=harness({missingMembersCount:true});
 await assert.rejects(h.load(),/SCHOOL_REPORT_MEMBERS_COUNT_UNAVAILABLE/);
});
test("null authoritative admin count fails instead of showing zero",async()=>{
 const h=harness({missingAdminsCount:true});
 await assert.rejects(h.load(),/SCHOOL_REPORT_ADMINS_COUNT_UNAVAILABLE/);
});

test("more than 1000 school listings are loaded completely across ordered bounded pages",async()=>{
 const h=harness({listingCount:1101}),report=await h.load();
 assert.equal(report.activeListings,1101);
 const pages=h.records.filter(q=>q.table==="listings");
 assert.equal(pages.length,5);
 assert.deepEqual(Array.from(pages.map(q=>q.filters.range)),[
  [0,249],[250,499],[500,749],[750,999],[1000,1249],
 ]);
 assert.ok(pages.every(q=>q.filters.order[0]==="id"));
 assert.equal(h.records.filter(q=>q.table==="reports").length,15);
});
test("pagination fails closed rather than silently showing first 1000 of >10000",async()=>{
 const h=harness({listingCount:10001});
 await assert.rejects(h.load(),/SCHOOL_REPORT_ROW_LIMIT_EXCEEDED/);
});
