#!/usr/bin/env node
"use strict";
/* WETUDY #787 — real Chromium + Next 16 production routes + Supabase CLI Auth,
 * RLS, PostgREST and SERVICE ROLE, before/after five-table local-only revoke.
 * Entirely synthetic, only loopback. Not a whole WETUDY production browser.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {spawn,execFileSync}=require("node:child_process");
const mods=process.env.WETUDY_ANON_NEXT_MODULES||"/tmp/wetudy-anon-next-local/node_modules";
const fixture=process.env.WETUDY_ANON_NEXT_FIXTURE||"/tmp/wetudy-anon-next-local";
const {chromium}=require(path.join(mods,"playwright"));
const {createClient}=require(path.join(mods,"@supabase/supabase-js"));
const root=process.cwd(),api=process.env.LOCAL_SUPABASE_URL||"",
  anon=process.env.LOCAL_SUPABASE_ANON_KEY||"",
  service=process.env.LOCAL_SUPABASE_SERVICE_KEY||"",
  db=process.env.LOCAL_DB_URL||"";
const local=h=>["127.0.0.1","localhost","[::1]","::1"].includes(h);
if(!api||!anon||!service||!db||!local(new URL(api).hostname)||
   !local(new URL(db).hostname)||!api.startsWith("http://")||
   process.env.PGAPPNAME!=="wetudy_disposable_next_browser_20261120")
  throw Error("Only disposable loopback Supabase CLI Auth/PostgREST/DB permitted");
const fixedSchool="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const listingId="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const agreementId="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const target=["agreements","demand_requests","profiles","saved_searches","schools"];
const origin="http://127.0.0.1:31389";
const nextBin=path.join(fixture,"node_modules/next/dist/bin/next");
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function sql(query) {
  return execFileSync("psql",["-X","-q","-t","-A","-v","ON_ERROR_STOP=1",db,"-c",query],
    {encoding:"utf8",timeout:18000});
}
function onlyUUID(value) {
  assert.match(value,/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  return value;
}
function copy(relative) {
  const dest=path.join(fixture,relative);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(path.join(root,relative),dest);
}
function installQAApplication() {
  if(fs.existsSync(path.join(fixture,".next")))
    fs.rmSync(path.join(fixture,".next"),{recursive:true,force:true});
  for(const file of [
    "app/api/schools/public/route.ts",
    "app/api/marketplace/feed/route.ts",
    "app/account/saved-searches/page.tsx",
    "lib/supabase/client.ts","lib/supabase/server.ts",
    "lib/supabase/admin.ts","lib/supabase/proxy.ts","proxy.ts",
    "lib/marketplace/feed-filters.ts","lib/marketplace/postal-distance.ts",
    "lib/marketplace/postal-centroids.ts","lib/types/marketplace.ts"
  ]) copy(file);
  const writes={
    "app/layout.tsx":'import React from "react";export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>;}',
    "qa/button.tsx":'import React from "react";export const Button=({children,asChild}:any)=>asChild?<>{children}</>:<button>{children}</button>;',
    "qa/saved-searches-list.tsx":'import React from "react";export const SavedSearchesList=({initialSearches}:any)=><ul data-testid="private-saved-searches">{initialSearches.map((s:any)=><li key={s.id}>{s.query}</li>)}</ul>;',
    "qa/saved-search-matches-list.tsx":'import React from "react";export const SavedSearchMatchesList=({initialMatches}:any)=><ul data-testid="private-matched-listings">{initialMatches.map((m:any)=><li key={m.id}>{m.listingTitle}</li>)}</ul>;',
    "app/page.tsx":[
      '"use client";',
      'import {useEffect} from "react";',
      'import {createClient} from "@/lib/supabase/client";',
      'export default function QA(){useEffect(()=>{',
      'const client=createClient();',
      '(window as any).__qaLogin=async(email:string,password:string)=>{',
      'const {data,error}=await client.auth.signInWithPassword({email,password});',
      'return {id:data?.user?.id||null,error:error?.message||null};};',
      '(window as any).__qaRead=async(table:string,columns:string="*")=>{',
      'const {data,error,status}=await client.from(table).select(columns);',
      'return {data:data||[],error:error?{code:error.code||null}:null,status};};',
      '(window as any).__qaHttp=async(route:string)=>{',
      'const response=await fetch(route,{credentials:"same-origin",cache:"no-store"});',
      'return {status:response.status,body:await response.json(),',
      'cache:response.headers.get("cache-control")};};',
      'return ()=>{};',
      '},[]);return <main data-testid="anon-qa">WETUDY LOCAL BROWSER QA ONLY</main>;}'
    ].join("\n")
  };
  for(const [name,body] of Object.entries(writes)) {
    const dest=path.join(fixture,name);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.writeFileSync(dest,body);
  }
  fs.writeFileSync(path.join(fixture,"package.json"),JSON.stringify({
    name:"wetudy-anon-local-next-qa",version:"0.0.0",private:true,
    dependencies:{next:"16.3.5",react:"19.2.4","react-dom":"19.2.4",
      "@supabase/ssr":"0.6.1","@supabase/supabase-js":"2.58.0",
      "lucide-react":"0.468.0"}
  },null,2));
  fs.writeFileSync(path.join(fixture,"tsconfig.json"),JSON.stringify({
    compilerOptions:{target:"ES2020",lib:["dom","dom.iterable","esnext"],
      allowJs:true,skipLibCheck:true,strict:false,noEmit:true,
      esModuleInterop:true,module:"esnext",moduleResolution:"bundler",
      resolveJsonModule:true,isolatedModules:true,jsx:"preserve",
      baseUrl:".",paths:{
        "@/components/ui/button":["./qa/button.tsx"],
        "@/components/account/saved-searches-list":["./qa/saved-searches-list.tsx"],
        "@/components/account/saved-search-matches-list":["./qa/saved-search-matches-list.tsx"],
        "@/*":["./*"]}},
    include:["**/*.ts","**/*.tsx",".next/types/**/*.ts"],exclude:["node_modules"]
  },null,2));
}
const apiClient=()=>createClient(api,anon,{auth:{
  persistSession:false,autoRefreshToken:false,detectSessionInUrl:false
}});
async function account(label) {
  const client=apiClient();
  const email="anon-next-"+label+"@example.invalid";
  const password="LOCAL-ANON-QA-"+label+"-2026!932#";
  const signup=await client.auth.signUp({email,password});
  assert.ifError(signup.error);
  const {data,error}=await client.auth.signInWithPassword({email,password});
  assert.ifError(error);
  return {id:onlyUUID(data.user.id),email,password};
}
async function ready(proc,tail) {
  for(let i=0;i<95;i++) {
    if(proc.exitCode!==null)throw Error("Local Next ended before readiness: "+tail().slice(-4000));
    try {
      const r=await fetch(origin,{signal:AbortSignal.timeout(3500)});
      if(r.ok&&(await r.text()).includes("WETUDY LOCAL BROWSER QA ONLY"))return;
    }catch{}
    await sleep(1600);
  }
  throw Error("Actual Next server did not become ready: "+tail().slice(-4000));
}
async function visit(browser,identity) {
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.route("**/*",r=>{
    const url=new URL(r.request().url());
    return [origin,new URL(api).origin].includes(url.origin)?r.continue():r.abort();
  });
  await page.goto(origin,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForFunction(()=>typeof window.__qaHttp==="function",{timeout:15000});
  if(identity) {
    const auth=await page.evaluate(([email,password])=>
      window.__qaLogin(email,password),[identity.email,identity.password]);
    assert.equal(auth.error,null);
    assert.equal(auth.id,identity.id);
    assert.ok((await context.cookies(origin)).some(c=>c.name.startsWith("sb-")),
      "Verified localhost Supabase SSR cookies must be persisted");
  }
  return {context,page};
}
async function rawRead(actor,table,columns="*") {
  return actor.page.evaluate(([table,columns])=>window.__qaRead(table,columns),
    [table,columns]);
}
async function route(actor,url) {
  return actor.page.evaluate(u=>window.__qaHttp(u),url);
}
async function publicRoutes(guest,expectedSeller) {
  const list=await route(guest,"/api/schools/public?q=DELTA");
  assert.equal(list.status,200,JSON.stringify(list.body));
  assert.deepEqual(list.body.schools,[{id:fixedSchool,name:"COLEGIO QA DELTA",city:"Ciudad ficticia"}]);
  assert.deepEqual(Object.keys(list.body.schools[0]).sort(),["city","id","name"]);
  const byId=await route(guest,"/api/schools/public?id="+fixedSchool);
  assert.equal(byId.status,200,JSON.stringify(byId.body));
  assert.equal(byId.body.school.id,fixedSchool);
  assert.equal(byId.cache,"private, no-store, max-age=0");
  const hidden=await route(guest,"/api/schools/public?id=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.equal(hidden.status,200);
  assert.equal(hidden.body.school,null);
  const feed=await route(guest,"/api/marketplace/feed?offset=0");
  assert.equal(feed.status,200,JSON.stringify(feed.body).slice(0,1000));
  assert.equal(feed.cache,"private, no-store");
  assert.equal(feed.body.listings.length,1);
  assert.equal(feed.body.listings[0].id,listingId);
  assert.equal(feed.body.listings[0].sellerId,expectedSeller);
  assert.equal(feed.body.listings[0].postalCode,null);
  assert.deepEqual(feed.body.listings[0].photos,[]);
  assert.doesNotMatch(JSON.stringify(feed.body),/PRIVATE_BUYER_|PRIVATE_SELLER_|PRIVATE_OTHER_/);
  const distance=await route(guest,"/api/marketplace/feed?radiusKm=5");
  assert.equal(distance.status,401);
  return {list:list.body,feed:feed.body};
}
async function guestReads(guest,revoked) {
  for(const table of target) {
    const r=await rawRead(guest,table);
    if(revoked) {
      assert.equal(r.error?.code,"42501",
        "Guest must lose "+table+" table permission after REVOKE, got "+JSON.stringify(r));
      assert.deepEqual(r.data,[]);
    }else{
      assert.equal(r.error,null,"Guest RLS must return empty before REVOKE on "+table);
      assert.deepEqual(r.data,[]);
    }
  }
}
async function authenticatedReads(buyer,seller,outsider,identities) {
  for(const [actor,id] of [[buyer,identities.buyer],[seller,identities.seller],
                           [outsider,identities.outsider]]) {
    const profile=await rawRead(actor,"profiles","id,full_name");
    assert.equal(profile.error,null,JSON.stringify(profile));
    assert.deepEqual(profile.data.map(x=>x.id),[id.id]);
    for(const row of profile.data)assert.equal(row.full_name,"PRIVATE_"+(id===identities.buyer?
      "BUYER":id===identities.seller?"SELLER":"OTHER")+"_LOCAL");
    const schools=await rawRead(actor,"schools","id,name");
    assert.equal(schools.error,null);
    assert.equal(schools.data.length,2); // active school and synthetic test school, but no inactive
  }
  for(const actor of [buyer,seller,outsider]){
    const agreements=await rawRead(actor,"agreements","id,buyer_id,seller_id,status");
    assert.equal(agreements.error,null,JSON.stringify(agreements));
    const allow=actor!==outsider;
    assert.deepEqual(agreements.data.map(a=>a.id),allow?[agreementId]:[]);
    const saved=await rawRead(actor,"saved_searches","id,user_id,query");
    assert.equal(saved.error,null,JSON.stringify(saved));
    assert.equal(saved.data.length,actor===buyer?1:0);
    const demand=await rawRead(actor,"demand_requests","id,owner_id,title");
    assert.equal(demand.error,null,JSON.stringify(demand));
    assert.equal(demand.data.length,actor===buyer?1:0);
  }
}
async function privateFamilyPage(actor,expectedSearch,expectedMatch) {
  const page=await actor.context.newPage();
  try {
    await page.goto(origin+"/account/saved-searches",{
      waitUntil:"domcontentloaded",timeout:40000
    });
    if(expectedSearch===null){
      await page.waitForURL(u=>u.pathname==="/auth",{timeout:12000});
      assert.equal(await page.getByTestId("private-saved-searches").count(),0);
      return {redirect:"/auth"};
    }
    const header=page.getByRole("heading",{name:"Mis búsquedas"});
    await header.waitFor({timeout:35000});
    const own=await page.getByTestId("private-saved-searches").innerText();
    const matched=await page.getByTestId("private-matched-listings").innerText();
    if(expectedSearch===""){
      assert.equal(own.trim(),"","Non-owner must see zero saved searches");
    }else{
      assert.ok(own.includes(expectedSearch),"Own saved search unavailable");
    }
    assert.equal(matched.trim(),expectedMatch);
    for(const forbidden of ["PRIVADA_BUYER_LIBROS","PRIVADA_SELLER_MATERIAL"])
      if(forbidden!==expectedSearch)
        assert.ok(!own.includes(forbidden),"Cross-account saved-search leak: "+forbidden);
    assert.ok(!matched.includes("PRIVATE_OTHER_LOCAL"));
    return {saved:own.trim(),matched:matched.trim()};
  } finally {await page.close();}
}
async function privateFamilyPages(guest,buyer,seller,outsider) {
  const result={
    guest:await privateFamilyPage(guest,null,""),
    buyer:await privateFamilyPage(buyer,"PRIVADA_BUYER_LIBROS",
      "LIBRO QA DE SEGUNDA MANO"),
    seller:await privateFamilyPage(seller,"PRIVADA_SELLER_MATERIAL",""),
    outsider:await privateFamilyPage(outsider,"",""),
  };
  return result;
}

function revokeOnlyLocally(){
  // This is the same five-table SELECT ACL delta; the hardened review SQL
  // targets a separately named disposable PG17 DB, not Supabase CLI postgres.
  // Enforce both localhost DB URL (above) and a distinct PGAPPNAME fixture.
  const before=sql("select bool_and(has_table_privilege('anon',oid,'SELECT')) "+
    "from pg_class where oid in "+
    "('public.agreements'::regclass,'public.demand_requests'::regclass,"+
    "'public.profiles'::regclass,'public.saved_searches'::regclass,'public.schools'::regclass)");
  assert.equal(before.trim(),"t");
  sql("DO $$ BEGIN IF current_database()<>'postgres' "+
      "OR current_setting('application_name')<>'wetudy_disposable_next_browser_20261120' "+
      "THEN RAISE EXCEPTION 'not local CLI QA'; END IF; END $$; "+
      "REVOKE SELECT ON public.agreements,public.demand_requests,public.profiles,"+
      "public.saved_searches,public.schools FROM anon; NOTIFY pgrst,'reload schema';");
  for(const table of target) {
    const effective=sql("select has_table_privilege('anon','public."+table+"','SELECT'), "+
                        "has_table_privilege('authenticated','public."+table+"','SELECT'), "+
                        "has_table_privilege('service_role','public."+table+"','SELECT')");
    assert.equal(effective.trim(),"f|t|t",table+" ACL changed unexpectedly: "+effective);
  }
}
let next=null,nextLogs="",browser=null,allActors=[];
(async()=>{
  installQAApplication();
  assert.ok(fs.existsSync(nextBin));
  const [buyer,seller,outsider]=await Promise.all([
    account("buyer"),account("seller"),account("outsider")]);
  const ids={buyer,seller,outsider};
  sql("INSERT INTO public.profiles(id,full_name,postal_code) VALUES "+
    "('"+buyer.id+"','PRIVATE_BUYER_LOCAL','28001'),"+
    "('"+seller.id+"','PRIVATE_SELLER_LOCAL','28002'),"+
    "('"+outsider.id+"','PRIVATE_OTHER_LOCAL','28003');"+
    "INSERT INTO public.listings(id,title,description,seller_id,status,school_id,postal_code) VALUES "+
    "('"+listingId+"','LIBRO QA DE SEGUNDA MANO','Solo anuncio ficticio','"+
    seller.id+"','available','"+fixedSchool+"',NULL);"+
    "INSERT INTO public.agreements(id,buyer_id,seller_id,status) VALUES "+
    "('"+agreementId+"','"+buyer.id+"','"+seller.id+"','proposed');"+
    "INSERT INTO public.saved_searches(id,user_id,query) VALUES "+
    "('11111111-1111-4111-8111-111111111111','"+buyer.id+"','QA prueba');"+
    "INSERT INTO public.demand_requests(id,owner_id,title) VALUES "+
    "('22222222-2222-4222-8222-222222222222','"+buyer.id+"','Material ficticio');"+
    "INSERT INTO public.saved_searches(id,user_id,query,intent_source) VALUES "+
    "('33333333-3333-4333-8333-333333333333','"+seller.id+"','PRIVADA_SELLER_MATERIAL','manual');"+
    "UPDATE public.saved_searches SET query='PRIVADA_BUYER_LIBROS', intent_source='manual' WHERE id='11111111-1111-4111-8111-111111111111';"+
    "INSERT INTO public.saved_search_matches(id,user_id,listing_id,saved_search_id) VALUES "+
    "('44444444-4444-4444-8444-444444444444','"+buyer.id+"','"+listingId+"','11111111-1111-4111-8111-111111111111');"+
    "NOTIFY pgrst,'reload schema';");
  await sleep(1400);
  next=spawn(process.execPath,[nextBin,"dev","--hostname","127.0.0.1","--port","31389"],{
    cwd:fixture,env:{...process.env,NEXT_TELEMETRY_DISABLED:"1",
      NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,
      SUPABASE_SERVICE_ROLE_KEY:service},
    stdio:["ignore","pipe","pipe"]
  });
  for(const stream of [next.stderr,next.stdout]) stream.on("data",data=>{
    nextLogs=(nextLogs+String(data).replaceAll(anon,"[local-key]")
      .replaceAll(service,"[local-service]")).slice(-12500);
  });
  await ready(next,()=>nextLogs);
  browser=await chromium.launch({headless:true});
  const guest=await visit(browser,null),b=await visit(browser,buyer),
    s=await visit(browser,seller),o=await visit(browser,outsider);
  allActors=[guest,b,s,o];
  await guestReads(guest,false);
  await authenticatedReads(b,s,o,ids);
  const publicBefore=await publicRoutes(guest,seller.id);
  const familyBefore=await privateFamilyPages(guest,b,s,o);
  revokeOnlyLocally();
  await sleep(1200);
  await guestReads(guest,true);
  await authenticatedReads(b,s,o,ids);
  const publicAfter=await publicRoutes(guest,seller.id);
  const familyAfter=await privateFamilyPages(guest,b,s,o);
  assert.deepEqual(familyAfter,familyBefore,
    "Actual private saved-search SSR page changed after local anon revoke");
  assert.deepEqual(publicAfter,publicBefore,
    "Real Next public routes changed after isolated anon revoke");
  console.log("PASS REAL Next 16 SSR + Chromium + local GoTrue/PostgREST: "+
    "anonymous five-table grants revoked; 3 signed users preserve RLS; "+
    "two public routes remain equivalent with live synthetic listing and school; "+
    "private saved-search SSR page preserves buyer/seller isolation and guest redirect.");
  console.log("LIMIT: isolated small Next QA app copies unchanged production API routes, "+
    "NOT full WETUDY page bundle, external client inventory, or production rollout.");
})().catch(error=>{
  console.error("FAIL REAL isolated Next/Supabase/browser privacy E2E:",
    String(error.message||error).slice(0,2100),"\nLOCAL Next output: "+nextLogs.slice(-2600));
  process.exitCode=1;
}).finally(async()=>{
  for(const a of allActors)await a.context.close().catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
  if(next&&next.exitCode===null)next.kill("SIGTERM");
});
