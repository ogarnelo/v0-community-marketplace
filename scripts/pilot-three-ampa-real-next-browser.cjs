#!/usr/bin/env node
"use strict";
// REAL Next 16 SSR of the EXACT app/admin/school/page.tsx + REAL server/admin
// clients + 3 REAL local GoTrue sessions, RLS, PostgREST and SQL count RPC.
// ONLY child navbar/dashboard/donation visuals are tiny QA renderers.
// NEVER point this script at hosted services, and never print secret keys.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {spawn,execFileSync}=require("node:child_process");
const mods=process.env.PILOT_AMPA_NEXT_MODULES||"/tmp/wetudy-ampa-next-local/node_modules";
const fixture=process.env.PILOT_AMPA_NEXT_FIXTURE||"/tmp/wetudy-ampa-next-local";
const {chromium}=require(path.join(mods,"playwright"));
const {createClient}=require(path.join(mods,"@supabase/supabase-js"));
const root=process.cwd();
const api=process.env.LOCAL_SUPABASE_URL||"";
const anon=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const service=process.env.LOCAL_SUPABASE_SERVICE_KEY||"";
const db=process.env.LOCAL_DB_URL||"";
const loopback=h=>["localhost","127.0.0.1","[::1]","::1"].includes(h);
if(!api||!anon||!service||!db||!loopback(new URL(api).hostname)||
  !loopback(new URL(db).hostname)||!api.startsWith("http://"))
    throw Error("Refusing a nonlocal Supabase service, DB or nonlocal API");
function sql(s){
  execFileSync("psql",["-X","-v","ON_ERROR_STOP=1",db,"-c",s],{
    stdio:["ignore","pipe","pipe"],timeout:18000
  });
}
function copy(filename){
  const target=path.join(fixture,filename);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(path.join(root,filename),target);
}
async function account(label){
  const client=createClient(api,anon,{auth:{
    persistSession:false,autoRefreshToken:false,detectSessionInUrl:false
  }});
  const email="next-ampa-"+label+"@example.invalid";
  const password="QA-Next-"+label+"-2026-Safe!X39";
  const {error:signupError}=await client.auth.signUp({email,password});
  assert.ifError(signupError);
  const {data:login,error}=await client.auth.signInWithPassword({email,password});
  assert.ifError(error);
  assert.match(login.user?.id||"",/^[0-9a-f-]{36}$/i);
  return {email,password,userId:login.user.id};
}
const schools=[
 {label:"ALFA",id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
 {label:"BETA",id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"},
 {label:"GAMMA",id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}
];
function prepareFiles(){
 for(const name of [
   "app/admin/school/page.tsx",
   "lib/supabase/server.ts",
   "lib/supabase/client.ts",
   "lib/supabase/admin.ts",
   "lib/supabase/proxy.ts","proxy.ts",
   "app/api/school/share-qr/route.ts","lib/auth/public-origin.ts",
   "components/admin/school-admin-dashboard.tsx",
   "components/ui/tabs.tsx","components/ui/button.tsx","components/ui/card.tsx",
   "components/ui/badge.tsx","lib/utils.ts","lib/growth/attribution.ts"
 ])copy(name);
 if(fs.existsSync(path.join(fixture,".next")))
   fs.rmSync(path.join(fixture,".next"),{recursive:true,force:true});
 fs.mkdirSync(path.join(fixture,"qa"),{recursive:true});
 const files={
 "app/layout.tsx":'import React from "react";export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>;}',
 "app/page.tsx":[
  '"use client";',
  'import {useEffect} from "react";',
  'import {createClient} from "@/lib/supabase/client";',
  'const client=createClient();',
  'export default function Landing(){useEffect(()=>{',
  '  (window as any).__login=async(email:string,password:string)=>{',
  '    const {data,error}=await client.auth.signInWithPassword({email,password});',
  '    return {id:data?.user?.id||null,error:error?.message||null};',
  '  };',
  '  (window as any).__logout=async()=>{const {error}=await client.auth.signOut();return error?.message||null;};',
  '},[]);return <main data-testid="qa-login">LOCAL THREE-AMPA LOGIN</main>;}'
 ].join("\n"),
 "qa/navbar.tsx":'import React from "react";export const Navbar=()=> <nav>WETUDY QA NAV</nav>;',
 "qa/footer.tsx":'import React from "react";export const Footer=()=> <footer>QA FOOTER</footer>;',
 "qa/dashboard.tsx":[
  'import React from "react";',
  'import RealSchoolAdminDashboard from "@/components/admin/school-admin-dashboard";',
  'export default function SchoolAdminDashboard(p:any){',
  'return <section data-testid="school-dashboard">',
  ' <h2 data-testid="school-title">{p.school?.name}</h2>',
  ' <span data-testid="member-count">{p.memberCount}</span>',
  ' <ul data-testid="listing-list">{p.listings.map((x:any)=><li key={x.id}>{x.title}</li>)}</ul>',
  ' <ul data-testid="access-code-list">{p.accessCodes.map((x:any)=><li key={x.code}>{x.code}</li>)}</ul>',
  ' <ul data-testid="report-list">{p.reports.map((x:any)=><li key={x.id}>{x.reason}</li>)}</ul>',
  ' <RealSchoolAdminDashboard {...p} />',
  '</section>}',
 ].join("\n"),
 "qa/donations.tsx":'import React from "react";export type DonationRequestAdminItem=any;export function DonationRequestsPanel(_p:any){return <aside>QA DONATIONS</aside>;}'
 };
 for(const [name,body] of Object.entries(files)){
   const dest=path.join(fixture,name);
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.writeFileSync(dest,body);
 }
 fs.writeFileSync(path.join(fixture,"tsconfig.json"),JSON.stringify({compilerOptions:{
  target:"ES2020",lib:["dom","dom.iterable","esnext"],allowJs:true,skipLibCheck:true,
  strict:false,noEmit:true,esModuleInterop:true,module:"esnext",moduleResolution:"bundler",
  resolveJsonModule:true,isolatedModules:true,jsx:"preserve",baseUrl:".",
  paths:{
   "@/components/navbar":["./qa/navbar.tsx"],
   "@/components/footer":["./qa/footer.tsx"],
   "@/components/admin/school-admin-dashboard":["./qa/dashboard.tsx"],
   "@/components/admin/donation-requests-panel":["./qa/donations.tsx"],
   "@/*":["./*"]
  }
 },include:["**/*.ts","**/*.tsx",".next/types/**/*.ts"],exclude:["node_modules"]},null,2));
 fs.writeFileSync(path.join(fixture,"package.json"),JSON.stringify({
  name:"wetudy-ampa-page-real-local",version:"0.0.0",private:true,
  dependencies:{
    next:"16.3.5",react:"19.2.4","react-dom":"19.2.4",
    "@supabase/ssr":"0.6.1","@supabase/supabase-js":"2.58.0",
    "lucide-react":"0.468.0",
    "@radix-ui/react-tabs":"1.1.13",
    "@radix-ui/react-slot":"1.2.4",
    "class-variance-authority":"0.7.1",
    "clsx":"2.1.1",
    "tailwind-merge":"3.3.1",
    "qrcode":"1.5.4"
  }
 },null,2));
}
async function ready(next,origin){
 for(let i=0;i<90;i++){
  if(next.exitCode!==null)throw Error("Next exited early");
  try{
   const r=await fetch(origin,{signal:AbortSignal.timeout(1800)});
   if(r.ok&&(await r.text()).includes("LOCAL THREE-AMPA LOGIN"))return;
  }catch{}
  await new Promise(res=>setTimeout(res,1700));
 }
 throw Error("Next school-page fixture never became ready");
}
(async()=>{
 prepareFiles();
 const users=await Promise.all(schools.map(x=>account(x.label.toLowerCase())));
 const outsider=await account("outsider");
 for(let i=0;i<schools.length;i++){
  const s=schools[i],u=users[i];
  sql("insert into public.profiles(id,full_name,school_id) values ('"+
    u.userId+"','ADMIN QA "+s.label+"','"+s.id+"');"+
    "insert into public.user_roles(user_id,role,school_id) values ('"+
    u.userId+"','school_admin','"+s.id+"');");
 }
 // Force PostgREST to discover the fixture tables and actual aggregate RPC.
 sql("notify pgrst,'reload schema';");
 const port=31387,origin="http://127.0.0.1:"+port;
 const bin=path.join(fixture,"node_modules/next/dist/bin/next");
 assert.ok(fs.existsSync(bin),"Next 16 must be installed in disposable fixture");
 let child=spawn(process.execPath,[bin,"dev","--hostname","127.0.0.1","--port",String(port)],{
  cwd:fixture,env:{...process.env,
   NEXT_TELEMETRY_DISABLED:"1",
   NEXT_PUBLIC_SUPABASE_URL:api,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,
   SUPABASE_SERVICE_ROLE_KEY:service
  },stdio:["ignore","pipe","pipe"]
 });
 let serverErrors="";
 for(const stream of [child.stdout,child.stderr]){
  stream.on("data",data=>{
   const out=data.toString().replaceAll(service,"[redacted]").replaceAll(anon,"[redacted]");
   if(/error|fatal|not found|failed/i.test(out))serverErrors=(serverErrors+out).slice(-5000);
  });
 }
 let browser;
 try{
  await ready(child,origin);
  browser=await chromium.launch({headless:true});
  const actors=[];
  async function createSession(identity){
   const context=await browser.newContext({acceptDownloads:true});
   await context.grantPermissions(["clipboard-read","clipboard-write"],{origin});
   const page=await context.newPage();
   page.setDefaultNavigationTimeout(90000);
   await page.route("**/*",route=>{
     const target=new URL(route.request().url());
     return [origin,new URL(api).origin].includes(target.origin)?route.continue():route.abort();
   });
   console.log("QA Next client page navigation:",identity?.email?"authenticated":"guest");
   await page.goto(origin,{waitUntil:"domcontentloaded"});
   await page.waitForFunction(()=>typeof window.__login==="function");
   if(identity){
    const login=await page.evaluate(([email,password])=>window.__login(email,password),
      [identity.email,identity.password]);
    assert.equal(login.error,null);
    assert.equal(login.id,identity.userId);
    assert.ok((await context.cookies(origin)).some(c=>c.name.startsWith("sb-")),
      "Actual SSR browser cookies must exist");
   }
   actors.push({page,context});
   return {page,context};
  }
  const sessions=await Promise.all(users.map(createSession));
  const noRole=await createSession(outsider);
  const guest=await createSession(null);
  for(let i=0;i<schools.length;i++){
    const {page}=sessions[i];
    console.log("QA Next actual school dashboard load:",schools[i].label);
    await page.goto(origin+"/admin/school",{waitUntil:"domcontentloaded"});
    await page.getByTestId("school-title").waitFor({timeout:30000});
    const html=await page.locator("body").innerText();
    assert.ok(html.includes("COLEGIO QA "+schools[i].label));
    assert.ok(html.includes("LIBRO EXCLUSIVO "+schools[i].label));
    assert.ok(html.includes("QA-CODIGO-"+schools[i].label));
    assert.ok(html.includes("RAZON RESERVADA "+schools[i].label));
    assert.equal(await page.getByTestId("member-count").innerText(),"1");
    // ACTUAL interactive dashboard (real Radix Tabs + real copy handlers).
    // Verify access code, school-specific growth link and QR belong to user school.
    await page.getByRole("tab",{name:"Código del centro"}).click();
    await page.getByText("QA-CODIGO-"+schools[i].label).last().waitFor();
    await page.getByRole("button",{name:"Copiar código"}).click();
    await page.getByRole("button",{name:"Copiado"}).waitFor();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),
      "QA-CODIGO-"+schools[i].label);
    await page.getByRole("button",{name:"Copiar enlace"}).click();
    await page.getByRole("button",{name:"Enlace copiado"}).waitFor();
    const shareUrl=await page.evaluate(()=>navigator.clipboard.readText());
    assert.ok(shareUrl.includes("school="+schools[i].id),
      "school invite points to wrong center");
    assert.ok(shareUrl.includes("utm_source=school") &&
      shareUrl.includes("utm_campaign=school_invite"));
    assert.equal(await page.locator("img[alt^='QR para unirse']").count(),1);
    const svgResponse=await page.evaluate(async()=>{
      const r=await fetch("/api/school/share-qr",{cache:"no-store"});
      return {status:r.status,type:r.headers.get("content-type"),body:await r.text()};
    });
    assert.equal(svgResponse.status,200,"Active AMPA must generate a QR");
    assert.match(svgResponse.type||"",/^image\/svg\+xml/);
    assert.ok(svgResponse.body.includes("<svg"));
    const pngResponse=await page.evaluate(async()=>{
      const r=await fetch("/api/school/share-qr?format=png&download=1");
      const buf=new Uint8Array(await r.arrayBuffer());
      return {status:r.status,type:r.headers.get("content-type"),
        disposition:r.headers.get("content-disposition"),
        signature:Array.from(buf.slice(0,8)),length:buf.length};
    });
    assert.equal(pngResponse.status,200);
    assert.equal(pngResponse.type,"image/png");
    assert.match(pngResponse.disposition||"",/^attachment/);
    assert.deepEqual(pngResponse.signature,[137,80,78,71,13,10,26,10]);
    assert.ok(pngResponse.length>1000);
    await page.getByRole("tab",{name:"Comunidad"}).click();
    await page.getByText("Administradores del centro").waitFor();
    await page.getByRole("tab",{name:"Actividad"}).click();
    await page.getByText("Visitas registradas").waitFor();
    await page.getByRole("tab",{name:"Impacto"}).click();
    const downloadPromise=page.waitForEvent("download");
    await page.getByRole("button",{name:"Descargar CSV de impacto"}).click();
    const download=await downloadPromise;
    const csv=fs.readFileSync(await download.path(),"utf8");
    assert.ok(csv.includes("COLEGIO QA "+schools[i].label));
    assert.ok(csv.includes("Cuentas que seleccionaron el centro"));
    for(const other of schools)if(other.id!==schools[i].id)
      assert.ok(!csv.includes("COLEGIO QA "+other.label),
        "export disclosed another school's identity");
    for(let j=0;j<schools.length;j++)if(j!==i){
     for(const secret of [
      "COLEGIO QA ","LIBRO EXCLUSIVO ","QA-CODIGO-","RAZON RESERVADA "
     ])assert.ok(!html.includes(secret+schools[j].label),
       "SCHOOL DATA LEAK: "+schools[i].label+" observed "+schools[j].label);
    }
  }
  for(const actor of [noRole,guest]){
   await actor.page.goto(origin+"/admin/school",{waitUntil:"domcontentloaded"});
   await actor.page.waitForURL(u=>!u.pathname.endsWith("/admin/school"),{timeout:30000});
   assert.equal(await actor.page.locator('[data-testid="school-dashboard"]').count(),0);
  }
  // The real dashboard's report-subscription fetch fails safely in browser.
  // The API response is intercepted locally: NO email or report is sent.
  await sessions[1].page.route("**/api/school/report-subscription",route=>
    route.fulfill({status:503,contentType:"application/json",
      body:JSON.stringify({error:"QA email deshabilitado temporalmente"})}));
  await sessions[1].page.getByRole("button",{name:"Guardar programación"}).click();
  await sessions[1].page.getByRole("status").getByText(
    "QA email deshabilitado temporalmente").waitFor();
  await sessions[1].page.unroute("**/api/school/report-subscription");

  // Database role revocation immediately invalidates SSR server data access
  // without refreshing GoTrue JWT: GAMMA loses access, BETA unaffected.
  sql("delete from public.user_roles where user_id='"+users[2].userId+
      "' and role='school_admin';");
  await sessions[2].page.reload({waitUntil:"domcontentloaded"});
  await sessions[2].page.waitForURL(u=>!u.pathname.endsWith("/admin/school"));
  assert.equal(await sessions[2].page.evaluate(async()=>(
    await fetch("/api/school/share-qr",{cache:"no-store"})).status),403,
    "Revoked admin must not generate QR");
  assert.equal(await sessions[2].page.locator('[data-testid="school-dashboard"]').count(),0);
  await sessions[1].page.reload({waitUntil:"domcontentloaded"});
  await sessions[1].page.getByTestId("school-title").waitFor();
  assert.equal(await sessions[1].page.getByTestId("school-title").innerText(),"COLEGIO QA BETA");
  // Disable ALFA in database: even its still-valid admin role must not
  // permit the panel; this checks the real page's school.is_active guard.
  sql("update public.schools set is_active=false where id='"+schools[0].id+"';");
  await sessions[0].page.reload({waitUntil:"domcontentloaded"});
  await sessions[0].page.waitForURL(u=>!u.pathname.endsWith("/admin/school"));
  assert.equal(await sessions[0].page.evaluate(async()=>(
    await fetch("/api/school/share-qr",{cache:"no-store"})).status),403,
    "Deactivated school must not generate QR");
  assert.equal(await sessions[0].page.locator('[data-testid="school-dashboard"]').count(),0);
  await sessions[1].page.reload({waitUntil:"domcontentloaded"});
  await sessions[1].page.getByTestId("school-title").waitFor();
  assert.equal(await sessions[1].page.getByTestId("school-title").innerText(),"COLEGIO QA BETA");
  assert.equal(await sessions[1].page.evaluate(async()=>(
    await fetch("/api/school/share-qr",{cache:"no-store"})).status),200,
    "Active BETA QR must remain accessible");
  // __logout belongs to the minimal client login page, not the SSR admin
  // page. Navigate to that client page before invoking real Supabase signOut.
  await sessions[1].page.goto(origin,{waitUntil:"domcontentloaded"});
  await sessions[1].page.waitForFunction(()=>typeof window.__logout==="function");
  assert.equal(await sessions[1].page.evaluate(()=>window.__logout()),null);
  await sessions[1].page.goto(origin+"/admin/school",{waitUntil:"domcontentloaded"});
  await sessions[1].page.waitForURL(u=>!u.pathname.endsWith("/admin/school"));
  assert.equal(await sessions[1].page.locator('[data-testid="school-dashboard"]').count(),0);
  console.log("PASS real Next 16 HTTP /admin/school page with real GoTrue sessions and SSR cookies, actual service-role scoped RPC and PostgREST.");
  console.log("3 schools no cross-school name/listing/QR/report leakage; 4th user and guest denied; GAMMA role revoked, ALFA school deactivated, BETA independent, logout denied.");
  console.log("PASS real dashboard/Radix tabs, clipboard code/link, CSV export, real SVG/PNG QR API, revoked/inactive QR 403 and report-subscription 503 UI.");
  console.log("LIMIT: navbar and donation visuals are QA shims; Dashboard component and its UI primitives are REAL, while report API failure is simulated in browser. All data are fake, no remote project.");
  for(const actor of actors)await actor.context.close();
 }catch(err){
  console.error("AMPA SSR QA failed:",err.message);
  console.error("Next sanitized diagnostic:",serverErrors.slice(-2500));
  process.exitCode=1;
 }finally{
  if(browser)await browser.close();
  child.kill("SIGTERM");
  await new Promise(resolve=>{
   if(child.exitCode!==null)return resolve();
   child.once("exit",resolve);
   setTimeout(()=>{if(child.exitCode===null)child.kill("SIGKILL");resolve();},3500).unref();
  });
 }
})().catch(err=>{console.error("AMPA Next startup/fixture QA failed:",err.message);process.exitCode=1;});
