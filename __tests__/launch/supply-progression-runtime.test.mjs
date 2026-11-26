import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const req=createRequire(import.meta.url),ts=req("typescript");
const source=readFileSync("lib/admin/demand-opportunities.ts","utf8");
const transformed=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const mod={};
vm.runInNewContext(transformed,{exports:mod,require(name){
 if(name==="server-only")return {};
 if(name==="node:crypto")return req(name);
 if(name==="@/lib/books/isbn")return {normalizeIsbn:s=>s?{canonicalIsbn:s}:null,extractIsbnFromText:()=>null};
 throw Error(name);
},Date,Intl,Map,Set,Promise,console},{timeout:1500});
const id=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0"),school=id(9000);
const now=new Date();const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",year:"numeric",month:"numeric"}).formatToParts(now);
const y=+parts.find(x=>x.type==="year").value,m=+parts.find(x=>x.type==="month").value,start=m>=9?y:y-1,year=start+"/"+String(start+1).slice(-2);
const opp={key:"opp_synthetic",schoolId:school,schoolName:"Ficticio",supplyCount:0,familiesCount:3,status:"new",
 gradeLevel:"3o Primaria",category:"libros",isbn:null,demandUserIds:[id(3)]};
function fixture(){
 const students=Array.from({length:1050},(_,i)=>({owner_user_id:id(i+1),school_id:school,active:true,academic_year:year,grade_level:"4o Primaria"}));
 students.splice(100,0,{...students[99]});
 const db={account_students:[...students,
  {owner_user_id:id(2001),school_id:school,active:false,academic_year:year,grade_level:"4o Primaria"},
  {owner_user_id:id(2002),school_id:school,active:true,academic_year:"1999/00",grade_level:"4o Primaria"},
  {owner_user_id:id(2003),school_id:id(6666),active:true,academic_year:year,grade_level:"4o Primaria"}],
 profiles:[...new Set(students.map(x=>x.owner_user_id))].map(id=>({id,full_name:"Confidencial"})),
 listings:[],reports:[],demand_opportunity_actions:[{target_user_id:id(7),opportunity_key:opp.key,action_type:"seller_contacted",sent_at:new Date().toISOString(),created_at:new Date().toISOString()}],
 user_marketplace_preferences:students.filter(x=>x.owner_user_id!==id(8)).map(x=>({user_id:x.owner_user_id,supply_outreach_opt_in:true}))};
 let studentQueries=0, budgetOK=true;
 return {db,admin:{from(table){
  const filters=[];let max=Infinity,sort=null;const q={
   select(){return this;},eq(k,v){filters.push(x=>x[k]===v);return this;},
   gt(k,v){filters.push(x=>x[k]>v);return this;},gte(k,v){filters.push(x=>x[k]>=v);return this;},
   in(k,v){filters.push(x=>v.includes(k.includes(".")?x.listings?.seller_id:x[k]));return this;},
   not(k,_,v){filters.push(x=>x[k]!==v);return this;},
   order(k){sort=k;return this;},limit(n){max=n;return this;},
   then(resolve,reject){let rows=(db[table]||[]).filter(x=>filters.every(fn=>fn(x)));
    if(sort)rows.sort((a,b)=>String(a[sort]).localeCompare(String(b[sort])));
    if(table==="account_students"){studentQueries++;budgetOK=budgetOK&&max===101||max===1001;}
    return Promise.resolve({data:rows.slice(0,max),error:null}).then(resolve,reject);}
  };return q;}},getCount:()=>studentQueries,budget:()=>budgetOK};
}
test("resumable >1000 distinct owners, boundary sibling and excluded identities",async()=>{
 const f=fixture(),seen=new Set();let cursor=null,n=0;
 do{const batch=await mod.findSupplyCandidates(f.admin,opp,{cursor});n++;
  assert.ok(batch.candidates.length<=100);
  for(const c of batch.candidates){assert.ok(!seen.has(c.userId));seen.add(c.userId);}
  assert.equal(batch.hasMore,Boolean(batch.nextCursor));cursor=batch.nextCursor;
 }while(cursor&&n<15);
 assert.ok(n>=11);assert.ok(seen.has(id(1050)));
 for(const rejected of [3,7,2001,2002,2003])assert.ok(!seen.has(id(rejected)));
 assert.ok(f.budget());
});
test("revoked opt-in stays non-contactable, no student alias or Auth email",async()=>{
 const f=fixture(),batch=await mod.findSupplyCandidates(f.admin,opp);
 const rejected=batch.candidates.find(c=>c.userId===id(8));
 assert.equal(rejected.contactAllowed,false);
 assert.ok(batch.candidates.every(c=>c.name==="Familia potencial"));
 assert.doesNotMatch(source,/admin\\.auth\\.admin\\.getUserById/);
});
test("direct revalidation does not scan 11 previous pages",async()=>{
 const f=fixture();
 const allowed=await mod.revalidateSupplyTargets(f.admin,opp,[id(4),id(7),id(8),id(3),id(2001)]);
 assert.deepEqual([...allowed],[id(4)]);
 assert.equal(f.getCount(),1);
});
test("satisfied demand is blocked",async()=>{
 assert.equal(mod.demandIsSatisfied({...opp,supplyCount:3}),true);
 const f=fixture();
 assert.equal((await mod.revalidateSupplyTargets(f.admin,{...opp,status:"satisfied"},[id(4)])).length,0);
});

test("moderation reports deny contacted owner; national ISBN remains valid", async()=>{
  const f=fixture(),listingId=id(7000);
  f.db.reports.push({listing_id:listingId,status:"open",listings:{seller_id:id(5)}});
  f.db.listings.push({id:listingId,seller_id:id(5),isbn:null,category:"libros",school_id:school});
  const blocked=await mod.revalidateSupplyTargets(f.admin,opp,[id(4),id(5)]);
  assert.deepEqual([...blocked],[id(4)]);
  f.db.listings.push({id:id(7001),seller_id:id(9),isbn:"9780001234567",category:"otros",school_id:id(6666)});
  const national={...opp,schoolId:null,isbn:"9780001234567",category:"otros"};
  const accepted=await mod.revalidateSupplyTargets(f.admin,national,[id(9)]);
  assert.deepEqual([...accepted],[id(9)]);
});
test("failed consent query blocks target revalidation rather than permitting send", async()=>{
  const f=fixture(),original=f.admin.from.bind(f.admin);
  f.admin.from=(table)=>{
    if(table!=="user_marketplace_preferences")return original(table);
    return {select(){return this;},in(){return this;},eq(){return Promise.resolve({data:null,error:{code:"42703"}});}};
  };
  await assert.rejects(()=>mod.revalidateSupplyTargets(f.admin,opp,[id(4)]),/supply_revalidation_unavailable/);
});
test("partial generated supply must not be mistaken for all demand satisfied",()=>{
  assert.equal(mod.demandIsSatisfied({...opp,status:"supply_generated",supplyCount:1,familiesCount:3}),false);
  assert.equal(mod.demandIsSatisfied({...opp,status:"supply_generated",supplyCount:3,familiesCount:3}),true);
});
