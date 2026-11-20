import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
const uid="11111111-1111-4111-8111-111111111111";
const fakeSchool={id:uid,name:"Centro QA sintético",city:"Ciudad ficticia"};
const target = new Set(["agreements","demand_requests","profiles","saved_searches","schools"]);

function compile(path, mocks) {
  const compiled=ts.transpileModule(readFileSync(path,"utf8"),{
    fileName:path,reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  });
  assert.equal((compiled.diagnostics||[])
    .filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  const exports={};
  vm.runInNewContext(compiled.outputText,{
    exports,
    require:(id)=>{
      if(!Object.hasOwn(mocks,id))throw Error("UNMOCKED_MODULE:"+id);
      return mocks[id];
    },
    Request,Response,URL,Date,Map,Set,Promise,console:{error:()=>{}}
  },{filename:path,timeout:2000});
  return exports;
}
const next={NextResponse:{json:(value,{status=200,headers={}}={})=>
  new Response(JSON.stringify(value),{status,headers})}};

function publicSchools() {
  const operations=[];
  const dataClient={
    from:(table)=>{
      operations.push("ADMIN:"+table);
      assert.equal(table,"schools");
      const params=[];
      const query={
        select:(columns)=>{
          operations.push("FIELDS:"+columns);
          assert.equal(columns,"id, name, city");
          return query;
        },
        eq:(key,value)=>{params.push([key,value]);return query;},
        order:()=>query,limit:()=>query,or:()=>query,
        maybeSingle:async()=>{
          assert.ok(params.some(([k,v])=>k==="is_active"&&v===true));
          return {data:fakeSchool,error:null};
        },
        returns:async()=>{
          assert.ok(params.some(([k,v])=>k==="is_active"&&v===true));
          assert.ok(params.some(([k,v])=>k==="is_test"&&v===false));
          return {data:[fakeSchool],error:null};
        }
      };
      return query;
    }
  };
  const mods={
    "next/server":next,
    "@/lib/supabase/admin":{createAdminClient:()=>dataClient}
  };
  const handler=compile("app/api/schools/public/route.ts",mods);
  return {operations,async get(path){
    const result=await handler.GET(new Request("https://qa.invalid"+path));
    return {status:result.status,body:await result.json()};
  }};
}

function guestFeed({authError=false}={}) {
  const operations=[];
  const adminQuery=new Proxy({},{
    get(_obj,key) {
      if (key==="range")return async()=>({data:[],error:null});
      return ()=>adminQuery;
    }
  });
  const session={
    auth:{getUser:async()=>({data:{user:null},
      error:authError?{message:"FAKE_AUTH_UNAVAILABLE"}:null})},
    from:(table)=>{
      operations.push("ANON:"+table);
      if(target.has(table))throw Error("42501 anonymous table SELECT REVOKED");
      throw Error("Anonymous data access in guest route: "+table);
    }
  };
  const admin={
    from:(table)=>{operations.push("ADMIN:"+table);return adminQuery;},
    rpc:()=>{throw Error("Public feed must not invoke authenticated-radius RPC");}
  };
  const mods={
    "next/server":next,
    "@/lib/supabase/server":{createClient:async()=>session},
    "@/lib/supabase/admin":{createAdminClient:()=>admin},
    "@/lib/marketplace/feed-filters":{
      parseMarketplaceFeedFilters:()=>({text:"",isbn:null,category:null,
        gradeLevel:null,listingType:null,condition:null,since:null,
        priceMin:null,priceMax:null,sort:"newest"}),
      applyMarketplaceFeedFilters:(q)=>q
    },
    "@/lib/marketplace/postal-distance":{
      approximateDistanceKm:()=>null,
      hasKnownPostalCode:()=>false
    },
    "@/lib/types/marketplace":{buildPhotosMap:()=>new Map()}
  };
  const handler=compile("app/api/marketplace/feed/route.ts",mods);
  return {operations,async get(path) {
    const result=await handler.GET(new Request("https://qa.invalid"+path));
    return {status:result.status,body:await result.json(),
      cache:result.headers.get("cache-control")};
  }};
}

test("public schools API works without ANY guest table grants; server returns only whitelist",async()=>{
  const f=publicSchools();
  const list=await f.get("/api/schools/public?q=QA");
  assert.equal(list.status,200);
  assert.equal(list.body.schools.length,1);
  assert.deepEqual(Object.keys(list.body.schools[0]).sort(),["city","id","name"]);
  const byId=await f.get("/api/schools/public?id="+uid);
  assert.equal(byId.status,200);
  assert.equal(byId.body.school.id,uid);
  assert.equal(f.operations.filter(s=>s==="ADMIN:schools").length,2);
  assert.equal(f.operations.some(s=>s.startsWith("ANON:")),false);
});

test("guest feed remains 200 if anon SELECT is revoked on all five tables",async()=>{
  for(const authError of [false,true]){
    const f=guestFeed({authError});
    const r=await f.get("/api/marketplace/feed?offset=0");
    assert.equal(r.status,200);
    assert.equal(r.cache,"private, no-store");
    assert.deepEqual(r.body.listings,[]);
    assert.deepEqual(f.operations,["ADMIN:listings"]);
  }
});

test("guest distance search still fails before privileged DB lookup",async()=>{
  const f=guestFeed();
  const r=await f.get("/api/marketplace/feed?radiusKm=5");
  assert.equal(r.status,401);
  assert.deepEqual(f.operations,[]);
});

test("public navigation and saved search readers remain behind Auth guards",()=>{
  const rules=[
    ["app/blog/page.tsx","if (user?.id)",'from("profiles")'],
    ["app/admin/login/page.tsx","if (user?.id)",'from("profiles")'],
    ["app/account/saved-searches/page.tsx",'if (!user) redirect(', 'from("saved_searches")'],
    ["lib/navbar/get-navbar-data.ts","if (!user) {",'from("profiles")'],
  ];
  for(const [file,guard,read] of rules){
    const code=readFileSync(file,"utf8");
    assert.ok(code.indexOf(guard)>0 && code.indexOf(read)>code.indexOf(guard),
      file+": target read moved before established identity");
  }
  const homepage=readFileSync("app/marketplace/page.tsx","utf8");
  assert.ok(homepage.indexOf("if (user) {")>=0 &&
    homepage.indexOf('from("profiles")')>homepage.indexOf("if (user) {"));
  assert.match(homepage, /const admin = createAdminClient\(\)/);
});
