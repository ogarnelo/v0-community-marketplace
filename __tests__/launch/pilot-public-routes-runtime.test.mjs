import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import vm from "node:vm";

const nativeRequire = createRequire(import.meta.url);
const ts = nativeRequire("typescript");
const ROOT = process.cwd();

function loadHandler(path, deps, logs = []) {
  const source = readFileSync(resolve(ROOT, path), "utf8");
  const result = ts.transpileModule(source, {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  assert.equal((result.diagnostics || []).filter(d =>
    d.category === ts.DiagnosticCategory.Error).length, 0,
    "Route must be parseable TypeScript");
  const outputs = {};
  const mockedRequire = id => {
    if (!(id in deps)) throw Error("Unexpected module import: " + id);
    return deps[id];
  };
  vm.runInNewContext(result.outputText, {
    exports: outputs, require: mockedRequire,
    URL, Request, Response, console: { error: (...parts) => logs.push(parts) },
  }, { filename: path, timeout: 1500 });
  assert.equal(typeof outputs.GET, "function");
  return outputs.GET;
}

const fakeResponse = { NextResponse: { json(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: options.headers ?? {},
  });
} } };

const schools = [
  { id: "real-a", name: "CEIP Río", city: "Madrid", is_active: true, is_test: false,
    postal_code: "28001", internal_phone: "DO_NOT_LEAK" },
  { id: "test-b", name: "Colegio Prueba", city: "Madrid", is_active: true, is_test: true,
    postal_code: "28002", internal_phone: "DO_NOT_LEAK" },
  { id: "inactive-c", name: "CEIP Antiguo", city: "Madrid", is_active: false, is_test: false,
    postal_code: "28003", internal_phone: "DO_NOT_LEAK" },
];
function schoolAdmin({ fail = false } = {}) {
  let queries = 0;
  return { get queries() { return queries; }, from(table) {
    assert.equal(table, "schools"); ++queries;
    let fields = []; const eq = []; let filter = null; let cap = 100;
    const data = () => {
      let rows = schools.filter(row => eq.every(([k,v]) => row[k] === v));
      if (filter) {
        const match = /^name\.ilike\.%(.+)%,city\.ilike\.%(.+)%$/.exec(filter);
        assert.ok(match, "Validated OR grammar only");
        rows = rows.filter(row => [row.name,row.city].some(x =>
          String(x).toLowerCase().includes(match[1].toLowerCase())));
      }
      return rows.slice(0,cap).map(row =>
        Object.fromEntries(fields.map(f => [f, row[f]])));
    };
    const q = {
      select(s){ fields=s.split(",").map(x=>x.trim()); return this; },
      eq(k,v){ eq.push([k,v]); return this; },
      order(){return this;},
      limit(n){cap=n;return this;},
      or(s){filter=s;return this;},
      async maybeSingle(){return {data:fail?null:data()[0]??null,
        error:fail?{message:"private_table_column",details:"PII"}:null};},
      async returns(){return {data:fail?null:data(),
        error:fail?{message:"private_table_column",details:"PII"}:null};}
    };
    return q;
  }};
}
function schoolRoute(admin, logs = []) {
  return loadHandler("app/api/schools/public/route.ts", {
    "next/server": fakeResponse,
    "@/lib/supabase/admin": { createAdminClient: () => admin },
  }, logs);
}

test("public school ID lookup refuses active test and inactive centres", async () => {
  const admin=schoolAdmin(), get=schoolRoute(admin);
  for (const id of ["test-b","inactive-c"]) {
    const response=await get(new Request("http://test.invalid/api/schools/public?id="+id));
    assert.equal(response.status,200);
    assert.equal((await response.json()).school,null);
  }
  const response=await get(new Request("http://test.invalid/api/schools/public?id=real-a"));
  assert.deepEqual(await response.json(),{school:{id:"real-a",name:"CEIP Río",city:"Madrid"}});
  assert.match(response.headers.get("cache-control"),/no-store/);
});

test("public school search excludes tests and returns only public columns",async () => {
  const get=schoolRoute(schoolAdmin());
  const resp=await get(new Request("http://test.invalid/api/schools/public?q=Rio"));
  assert.equal(resp.status,200);
  const all=await (await get(new Request("http://test.invalid/api/schools/public"))).json();
  assert.deepEqual(all.schools,[{id:"real-a",name:"CEIP Río",city:"Madrid"}]);
  assert.equal(JSON.stringify(all).includes("28001"),false);
  assert.equal(JSON.stringify(all).includes("DO_NOT_LEAK"),false);
});

test("PostgREST grammar, wildcards and oversized public school filters fail before admin",async () => {
  const admin=schoolAdmin(),get=schoolRoute(admin);
  for (const q of ["(id.eq.real-a)", "Madrid,city.eq.Madrid", "%", "_", "a\"b", "x".repeat(81)]) {
    const resp=await get(new Request("http://test.invalid/api/schools/public?q="+encodeURIComponent(q)));
    assert.equal(resp.status,400,q);
    assert.match(resp.headers.get("cache-control"),/no-store/);
  }
  assert.equal(admin.queries,0);
});

test("public school API suppresses privileged error content",async () => {
  const logs=[],get=schoolRoute(schoolAdmin({fail:true}),logs);
  const response=await get(new Request("http://test.invalid/api/schools/public"));
  assert.equal(response.status,500);
  assert.equal(JSON.stringify(await response.json()).includes("private_table_column"),false);
  assert.equal(JSON.stringify(logs),JSON.stringify([["public_schools_lookup_failed"]]));
});

const dbListing={id:"listing1",title:"Producto ficticio",postal_code:"28002",
  seller_id:"seller1",user_id:"seller1",status:"available",lat:40.5,lng:-3.7,
  school_id:"school1",price:15,created_at:"2026-11-15T00:00:00Z"};
function feedContext({viewer = null, profilePostal = "28001", dbError = false} = {}) {
  const state={rpcCalls:[],errors:[],adminCreated:0};
  const rows=[dbListing];
  const admin={
    rpc:async (name,args)=>{state.rpcCalls.push({name,args});
      return {data:[{listing_id:"listing1",distance_km:5.2}],error:null};},
    from(table){
      assert.ok(["listings","listing_photos","profiles"].includes(table));
      const data= table === "listings" ? rows :
        table === "listing_photos" ? [{id:"photo1",listing_id:"listing1",url:"/fake.jpg",sort_order:1}] :
          [{id:"seller1",school_id:"school1",postal_code:"28002",private_phone:"DO_NOT_LEAK"}];
      const answer=()=>({data:dbError&&table==="listings"?null:data,
          error:dbError&&table==="listings"?{message:"private_Supabase_error"}:null});
      const q={select(){return this;},eq(){return this;},in(){return this;},
        order(){return Promise.resolve(answer());},range(){return Promise.resolve(answer());},
        then(resolve,reject){return Promise.resolve(answer()).then(resolve,reject);}};
      return q;
    },
  };
  const supabase={
    auth:{getUser:async()=>({data:{user:viewer}})},
    from(table){
      assert.ok(["profiles","favorites"].includes(table));
      return {select(){return this;},eq(){return this;},
        async maybeSingle(){return {data:{postal_code:profilePostal},error:null};},
        in(){return Promise.resolve({data:[],error:null});}};
    },
  };
  const get=loadHandler("app/api/marketplace/feed/route.ts",{
    "next/server":fakeResponse,
    "@/lib/supabase/server":{createClient:async()=>supabase},
    "@/lib/supabase/admin":{createAdminClient:()=>{state.adminCreated++;return admin;}},
    "@/lib/marketplace/feed-filters":{
      parseMarketplaceFeedFilters:()=>({sort:"newest",text:null,category:null}),
      applyMarketplaceFeedFilters:q=>q,
    },
    "@/lib/marketplace/postal-distance":{
      approximateDistanceKm:()=>5.2,
      hasKnownPostalCode:s=>/^[0-9]{5}$/.test(s),
    },
    "@/lib/types/marketplace":{buildPhotosMap:photos=>
      new Map([["listing1",photos.map(x=>x.url)]])},
  },state.errors);
  return {get,state};
}

test("public marketplace feed executes handler but never serializes DB postal code",async()=>{
  const {get}=feedContext();
  const response=await get(new Request("http://test.invalid/api/marketplace/feed?offset=0"));
  assert.equal(response.status,200);
  assert.match(response.headers.get("cache-control"),/no-store/);
  const {listings,hasMore}=await response.json();
  assert.equal(hasMore,false);
  assert.equal(listings.length,1);
  assert.equal(listings[0].postalCode,null);
  assert.equal("postal_code" in listings[0],false);
  assert.equal("lat" in listings[0],false);
  assert.equal("lng" in listings[0],false);
  assert.equal(JSON.stringify(listings).includes("DO_NOT_LEAK"),false);
});

test("radius requires auth, and never trusts caller-supplied postcode",async()=>{
  const anonymous=feedContext();
  const denied=await anonymous.get(new Request("http://test.invalid/api/marketplace/feed?radiusKm=5"));
  assert.equal(denied.status,401);
  assert.equal(anonymous.state.rpcCalls.length,0);
  assert.equal(anonymous.state.adminCreated,0);
  const signed=feedContext({viewer:{id:"familyA"},profilePostal:"28001"});
  const allowed=await signed.get(new Request(
    "http://test.invalid/api/marketplace/feed?radiusKm=5&postal_code=99999"));
  assert.equal(allowed.status,200);
  assert.equal(signed.state.rpcCalls[0].args.p_postal_code,"28001");
  const noPostal=feedContext({viewer:{id:"familyA"},profilePostal:""});
  const invalid=await noPostal.get(new Request("http://test.invalid/api/marketplace/feed?radiusKm=5"));
  assert.equal(invalid.status,422);
});

test("privileged feed error is not reflected to client or console",async()=>{
  const {get,state}=feedContext({dbError:true});
  const resp=await get(new Request("http://test.invalid/api/marketplace/feed"));
  assert.equal(resp.status,503);
  assert.equal(JSON.stringify(await resp.json()).includes("private_Supabase_error"),false);
  assert.deepEqual(state.errors,[["marketplace_feed_read_failed"]]);
});
