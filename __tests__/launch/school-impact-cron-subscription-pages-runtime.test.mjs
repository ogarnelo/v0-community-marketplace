import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const UUID=n=>String(n).padStart(8,"0")+"-1111-4111-8111-111111111111";
const source=readFileSync("lib/reports/school-impact-cron-subscriptions.ts","utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exported={};
vm.runInNewContext(compiled,{exports:exported,Promise,Number,Array,Error},{timeout:1500});
const DAY=18;
function harness({size=1201,countDrift=0,missingCount=false,truncate=false,
 badOrder=false,badDay=false}={}){
 const rows=Array.from({length:size},(_,i)=>({
  id:UUID(i+1),school_id:UUID(90000+i),user_id:UUID(40000+i),
  email:"fictitious"+i+"@example.invalid",day_of_month:badDay&&i===2?17:DAY,
  last_sent_month:null,
 }));
 const queries=[];let countReads=0,pageReads=0;
 const admin={from(table){
  assert.equal(table,"school_impact_report_subscriptions");
  const q={filters:{},select(fields,options){q.filters.fields=fields;q.filters.selectOptions=options;return q},
    eq(key,val){q.filters[key]=val;return q},
    gt(key,val){q.filters[key+"-gt"]=val;return q},
    order(key,options){q.filters.order=key;return q},
    limit(n){q.filters.limit=n;return q},
    returns:async()=>result(),
    then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)},
  };
  function result(){
   queries.push({...q.filters});
   if(q.filters.selectOptions?.head){
    countReads++;
    return {count:missingCount?null:size+(countReads>1?countDrift:0),error:null};
   }
   pageReads++;
   let match=rows.filter(x=>!q.filters["id-gt"] || x.id>q.filters["id-gt"]);
   let data=match.slice(0,q.filters.limit);
   if(truncate&&pageReads===2)data=data.slice(0,50);
   if(badOrder&&pageReads===2)data=[...data].reverse();
   return {data,error:null};
  }
  return q;
 }};
 return {queries,load:()=>exported.loadDueSchoolImpactSubscriptions(admin,DAY)};
}
test("due-day subscriptions beyond PostgREST 1000 cap are fully scanned before any send",async()=>{
 const h=harness({size:1201}),rows=await h.load();
 assert.equal(rows.length,1201);
 const pages=h.queries.filter(q=>q.limit);
 assert.equal(pages.length,5);
 assert.deepEqual(Array.from(pages.map(q=>q.limit)),[250,250,250,250,250]);
 assert.ok(pages.every(q=>q.order==="id"&&q.enabled===true&&q.day_of_month===DAY));
 assert.equal(h.queries.filter(q=>q.selectOptions?.head).length,2);
});
test("due-day dataset changed between count fences rejects whole batch",async()=>{
 const h=harness({size:301,countDrift:1});
 await assert.rejects(h.load(),/SCHOOL_REPORT_SUBSCRIPTIONS_INCOMPLETE/);
});
test("silent partial page cannot become incomplete scheduled email batch",async()=>{
 const h=harness({size:401,truncate:true});
 await assert.rejects(h.load(),/SCHOOL_REPORT_SUBSCRIPTIONS_INCOMPLETE/);
});
test("missing exact count and oversized subscriber population fail closed",async()=>{
 await assert.rejects(harness({size:30,missingCount:true}).load(),/SCHOOL_REPORT_SUBSCRIPTIONS_UNAVAILABLE/);
 await assert.rejects(harness({size:5001}).load(),/SCHOOL_REPORT_SUBSCRIPTIONS_UNAVAILABLE/);
});
test("unsorted, wrong-day or invalid scheduled records cannot authorize delivery",async()=>{
 await assert.rejects(harness({size:400,badOrder:true}).load(),/SCHOOL_REPORT_SUBSCRIPTIONS_INCOMPLETE/);
 await assert.rejects(harness({size:5,badDay:true}).load(),/SCHOOL_REPORT_SUBSCRIPTIONS_INCOMPLETE/);
});
test("invalid due-day never creates privileged queries",async()=>{
 const h=harness();
 await assert.rejects(exported.loadDueSchoolImpactSubscriptions({
  from:()=>{throw Error("NO_QUERY_ALLOWED")}
 },32),/SCHOOL_REPORT_INVALID_CRON_DAY/);
});

test("days 29-31 skip all scheduled subscriptions without database access",async()=>{
 for(const day of [29,30,31]){
  const rows=await exported.loadDueSchoolImpactSubscriptions({
    from:()=>{throw Error("UNEXPECTED_DB_READ")}
  },day);
  assert.equal(rows.length,0);
 }
});
