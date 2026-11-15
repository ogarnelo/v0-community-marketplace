import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const route="app/api/marketplace/my-school/route.ts";
const U="11111111-1111-4111-8111-111111111111";
const SA="22222222-2222-4222-8222-222222222222";
const SB="33333333-3333-4333-8333-333333333333";
const A="44444444-4444-4444-8444-444444444444";
const B="55555555-5555-4555-8555-555555555555";
const C="66666666-6666-4666-8666-666666666666";
const listings=[
 {id:A,title:"Libro A",school_id:SA,directory_school_code:null,status:"available",seller_id:U,postal_code:"28001"},
 {id:B,title:"Libro B",school_id:SB,directory_school_code:null,status:"available",seller_id:"seller-b",postal_code:"28002"},
 {id:C,title:"Libro C",school_id:SA,directory_school_code:"CODEB",status:"available",seller_id:"seller-c",postal_code:"28003"}
];
function harness({guest=false,profileSchool=SA,student=null,schoolAdmin=null,fail=null}={}){
 const calls=[];let scoped=null;
 const from=role=>table=>{
  calls.push("from:"+role+":"+table);
  let filters={};
  const q=new Proxy({}, {get(_target,name){
    if(name==="eq")return(k,v)=>{filters[k]=v;return q};
    if(name==="in")return(k,v)=>{filters[k]=v;return q};
    if(name==="or")return(expr)=>{scoped=expr;calls.push("SCHOOL_SCOPE:"+expr);return q};
    if(name==="range")return async(start,end)=>{
      calls.push("LISTINGS_PAGE");
      assert.equal(table,"listings");
      if(!scoped)return{data:null,count:null,error:{message:"SCOPE_MISSING"}};
      const school=scoped.match(/school_id\.eq\.([0-9a-f-]+)/)?.[1];
      const directory=scoped.match(/directory_school_code\.in\.\(([^)]*)\)/)?.[1];
      const list=listings.filter(x=>x.status===filters.status &&
       ((school&&x.school_id===school)||(directory&&x.directory_school_code===directory)));
      return{data:list.slice(start,end+1),count:list.length,error:null};
    };
    if(name==="maybeSingle")return async()=>{
      if(table==="profiles")return {data:{school_id:profileSchool,postal_code:"28001"},error:fail==="profiles"?{message:"PRIVATE_SQL"}:null};
      if(table==="account_students")return {data:student,error:fail==="account_students"?{message:"PRIVATE_SQL"}:null};
      if(table==="user_roles")return {data:schoolAdmin,error:fail==="user_roles"?{message:"PRIVATE_SQL"}:null};
      throw Error("Unexpected maybeSingle "+table);
    };
    if(name==="then")return(res,rej)=>{
      const ids=filters.listing_id||filters.id||[];
      let data=[];
      if(table==="listing_photos")data=[{id:"photo-a",listing_id:A,url:"https://fixture.invalid/a.jpg",sort_order:0}].filter(x=>ids.includes(x.listing_id));
      else if(table==="profiles")data=[{id:U,school_id:SA,postal_code:"28001"},{id:"seller-b",school_id:SB,postal_code:"28002"}];
      else if(table==="favorites")data=[{listing_id:A}];
      else throw Error("Unexpected then "+table);
      return Promise.resolve({data,error:fail===table?{message:"PRIVATE_SQL"}:null}).then(res,rej);
    };
    return()=>q;
  }});
  return q;
 };
 const supabase={auth:{getUser:async()=>({data:{user:guest?null:{id:U}},error:null})},from:from("session")};
 const admin={from:from("admin")};
 const mocks={
  "next/server":{NextResponse:{json:(payload,opts={})=>new Response(JSON.stringify(payload),{status:opts.status??200,headers:opts.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>supabase},
  "@/lib/supabase/admin":{createAdminClient:()=>{calls.push("ADMIN_CREATED");return admin}},
  "@/lib/marketplace/feed-filters":{
    parseMarketplaceFeedFilters:()=>({}),
    hasServerMarketplaceFilters:()=>false,
    applyMarketplaceFeedFilters:(q,_filters,expression)=>{if(!expression)throw Error("NO_SCOPE");return q.or(expression)}
  },
  "@/lib/marketplace/school-scope":{
    resolveMarketplaceSchoolScope:async(schoolId,directoryCode)=>{
      calls.push("RESOLVE:"+schoolId+":"+directoryCode);
      return{schoolIds:schoolId?[schoolId]:[],directoryCodes:directoryCode?[directoryCode]:[]};
    },
    makeMarketplaceSchoolFilter:scope=>[
      ...scope.schoolIds.map(x=>"school_id.eq."+x),
      ...(scope.directoryCodes.length?["directory_school_code.in.("+scope.directoryCodes.join(",")+")"]:[])
    ].join(",")||null
  },
  "@/lib/marketplace/postal-distance":{approximateDistanceKm:()=>3},
  "@/lib/types/marketplace":{buildPhotosMap:rows=>{
    const map=new Map();
    for(const row of rows){map.set(row.listing_id,[row.url])}
    return map;
  }}
 };
 const compiled=ts.transpileModule(readFileSync(route,"utf8"),{fileName:route,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 const exp={};
 vm.runInNewContext(compiled.outputText,{exports:exp,require:k=>mocks[k]??{},Promise,Map,Set,Date,URL,Request,Response,console},
   {filename:route,timeout:1500});
 return{calls,request:async(path="/api/marketplace/my-school")=>{
   const response=await exp.GET(new Request("https://synthetic.invalid"+path));
   return{status:response.status,cache:response.headers.get("cache-control"),body:await response.json()};
 }};
}
test("guest gets 401 without any admin access",async()=>{
 const h=harness({guest:true});const r=await h.request();
 assert.equal(r.status,401);assert.equal(r.cache,"private, no-store");
 assert.equal(h.calls.includes("ADMIN_CREATED"),false);
});
test("school A family receives only its own available listings",async()=>{
 const h=harness();const r=await h.request();
 assert.equal(r.status,200);assert.equal(r.cache,"private, no-store");
 assert.deepEqual(Array.from(r.body.listings,x=>x.id),[A,C]);
 assert.equal(r.body.total,2);
 assert.equal(r.body.listings.every(x=>x.postalCode===null),true);
});
test("forged schoolId and directorySchoolCode URL parameters cannot change signed-in scope",async()=>{
 const h=harness();const r=await h.request("/api/marketplace/my-school?schoolId="+SB+"&directorySchoolCode=CODEB");
 assert.deepEqual(Array.from(r.body.listings,x=>x.id),[A,C]);
 assert.ok(h.calls.includes("RESOLVE:"+SA+":"));
 assert.equal(h.calls.some(x=>x==="RESOLVE:"+SB+":CODEB"),false);
});
test("student's directory code overrides a previous profile school",async()=>{
 const h=harness({student:{school_id:null,directory_school_code:"CODEB",is_primary:true}});
 const r=await h.request();
 assert.equal(r.status,200);
 assert.deepEqual(Array.from(r.body.listings,x=>x.id),[C]);
 assert.ok(h.calls.includes("RESOLVE::CODEB"));
});
test("authorized school-admin role overrides profile's prior school",async()=>{
 const h=harness({schoolAdmin:{school_id:SB}});
 const r=await h.request();
 assert.deepEqual(Array.from(r.body.listings,x=>x.id),[B]);
 assert.ok(h.calls.includes("RESOLVE:"+SB+":"));
});
test("no chosen school returns no listings without creating an admin client",async()=>{
 const h=harness({profileSchool:null});
 const r=await h.request();
 assert.equal(r.status,200);assert.equal(r.body.listings.length,0);
 assert.equal(h.calls.includes("ADMIN_CREATED"),false);
});
for(const table of ["profiles","account_students","user_roles"]){
 test("failed "+table+" read is 503 and never queries listings",async()=>{
  const h=harness({fail:table});const r=await h.request();
  assert.equal(r.status,503);assert.equal(r.cache,"private, no-store");
  assert.equal(h.calls.includes("ADMIN_CREATED"),false);
  assert.equal(JSON.stringify(r.body).includes("PRIVATE_SQL"),false);
 });
}
test("page 2 returns no additional data and never changes school scope",async()=>{
 const h=harness();const r=await h.request("/api/marketplace/my-school?offset=60");
 assert.equal(r.status,200);assert.equal(r.body.listings.length,0);
 assert.ok(h.calls.includes("RESOLVE:"+SA+":"));
});
test("failed seller photo enrichment aborts without partial listing data",async()=>{
 const h=harness({fail:"listing_photos"});const r=await h.request();
 assert.equal(r.status,503);assert.equal(r.cache,"private, no-store");
 assert.equal("listings" in r.body,false);
});
