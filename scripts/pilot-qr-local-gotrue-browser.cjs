#!/usr/bin/env node
"use strict";
// Original QR React page + actual @supabase/ssr browser client + localhost
// GoTrue/PostgREST/RLS in one Chromium test. Local auth UI and school API
// are synthetic adapters, NOT the hosted AuthForm/Next API.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const MOD=process.env.PILOT_QA_MODULES||"/tmp/wetudy-local-supabase-qa/node_modules";
const {build}=require(path.join(MOD,"esbuild"));
const {chromium}=require(path.join(MOD,"playwright"));
const ROOT=process.cwd();
const api=process.env.LOCAL_SUPABASE_URL||"";
const anon=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const db=process.env.LOCAL_DB_URL||"";
const loopback=s=>["localhost","127.0.0.1","[::1]","::1"].includes(s);
if(!api.startsWith("http://")||!anon||!db||
 !loopback(new URL(api).hostname)||!loopback(new URL(db).hostname))
 throw Error("Refusing nonlocal Supabase URLs or credentials");
const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const schools={
 [A]:{id:A,name:"COLEGIO QA ALFA",city:"Ciudad QA"},
 [B]:{id:B,name:"COLEGIO QA BETA",city:"Ciudad QA"}
};
const qr="/onboarding/join-school?school="+A+
 "&join=1&utm_source=school&utm_medium=qr&utm_campaign=school_invite";
(async()=>{
 const b=await build({
  entryPoints:["scripts/pilot-qr-local-gotrue-entry.cjs"],absWorkingDir:ROOT,
  platform:"browser",format:"iife",target:"es2020",bundle:true,write:false,
  nodePaths:[MOD],
  define:{
   "process.env.NEXT_PUBLIC_SUPABASE_URL":JSON.stringify(api),
   "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY":JSON.stringify(anon),
   "process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY":JSON.stringify("qa-local-site-key")
  },
  plugins:[{name:"qa-next-shell",setup(t){
   t.onResolve({filter:/^(?:next\/navigation|next\/link|@vercel\/analytics|@\/components\/auth\/turnstile-widget)$/},
     arg=>({namespace:"qa-shell",path:arg.path}));
   t.onLoad({filter:/.*/,namespace:"qa-shell"},arg=>{
    let contents;
    if(arg.path==="next/navigation")
      contents="export function useRouter(){return window.__qa.router;} export function useSearchParams(){return new URLSearchParams(window.location.search);}";
    else if(arg.path==="next/link")
      contents='import React from "react";export default React.forwardRef(function Link(props,ref){const {href,children,...rest}=props;return React.createElement("a",{...rest,href,ref},children);});';
    else if(arg.path==="@/components/auth/turnstile-widget")
      contents='import React from "react";export function TurnstileWidget({onTokenChange}){React.useEffect(()=>onTokenChange("local-qa-turnstile-token"),[onTokenChange]);return React.createElement("span",{"data-testid":"local-turnstile-stub"},"Turnstile solo QA");}';
    else contents="export function track(name,data){window.__qa.actions.tracks.push({name,data})}";
    return {contents,loader:"js",resolveDir:MOD};
   });
   t.onResolve({filter:/^@\//},arg=>{
    const x=path.join(ROOT,arg.path.slice(2));
    return {path:fs.existsSync(x+".tsx")?x+".tsx":fs.existsSync(x+".ts")?x+".ts":x};
   });
  }}]
 });
 const js=b.outputFiles[0].text;
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,"http://127.0.0.1");
  const json=(status,val)=>{res.writeHead(status,{"content-type":"application/json",
    "cache-control":"private, no-store"});res.end(JSON.stringify(val));};
  if(u.pathname==="/api/schools/public"){
   const id=u.searchParams.get("id");
   return json(200,id?{school:schools[id]||null}:{schools:Object.values(schools)});
  }
  if(u.pathname==="/api/analytics/acquisition")return json(200,{ok:true});
  if(u.pathname.startsWith("/api/"))return json(404,{error:"Local QA route not configured"});
  res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
  res.end('<!doctype html><html lang="es"><meta charset="utf-8"><body><main id="root"></main>'+
    '<script>'+js+'</script></body></html>');
 });
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true});
 const allowed=new Set([origin,new URL(api).origin]);
 async function context(){
  const ctx=await browser.newContext(),page=await ctx.newPage();
  page.setDefaultTimeout(24000);
  await page.route("**/*",route=>{
   const o=new URL(route.request().url()).origin;
   return allowed.has(o)?route.continue():route.abort();
  });
  return {ctx,page};
 }
 async function readSchool(page,uid){
  const r=await page.evaluate(async(id)=>{
   const result=await window.__qa.supabase.from("profiles")
     .select("school_id").eq("id",id).maybeSingle();
   return {id:result.data?.school_id||null,error:result.error?.message};
  },uid);
  assert.equal(r.error,undefined);
  return r.id;
 }
 async function identity(page){
  return page.evaluate(async()=>{
   const {data,error}=await window.__qa.supabase.auth.getUser();
   // A guest must NOT have a GoTrue session. getUser() signals this as
   // AuthSessionMissingError; only authenticated sessions require no error.
   if(error && !(error.name==="AuthSessionMissingError" && !data.user))
     throw Error(error.message);
   return data.user?.id||null;
  });
 }
 async function login(page,email,password,mode="login",next=qr,realForm=false){
  await page.goto(origin+(realForm?"/auth-real":"/auth")+"?mode="+mode+"&next="+encodeURIComponent(next),
     {waitUntil:"load"});
  await page.getByLabel(realForm?"Email":"Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  if(realForm){
    await page.getByTestId("local-turnstile-stub").waitFor();
    await page.getByRole("button",{name:"Iniciar sesión",exact:true}).last().click();
  } else {
    await page.getByRole("button",{name:mode==="signup"?"Crear QA":"Entrar QA"}).click();
  }
  await page.waitForURL(u=>u.pathname==="/onboarding/join-school",{timeout:25000});
  const uid=await identity(page);
  assert.match(uid||"",/^[0-9a-f-]{36}$/);
  return uid;
 }
 try{
  // Guest follows an actual QR URL. The real component preserves school and
  // attribution through a signup link, the local AUTH ADAPTER calls GoTrue,
  // and the real page persists profiles/metadata through PostgREST/GoTrue.
  {
   const {page,ctx}=await context();
   await page.goto(origin+qr,{waitUntil:"load"});
   await page.getByText("¿Ya tienes cuenta en Wetudy?").waitFor();
   const signup=await page.getByRole("link",{name:"Crear cuenta"}).getAttribute("href");
   assert.ok(signup?.includes("utm_source=school"));
   assert.ok(new URL(signup,origin).searchParams.get("next")?.includes("school="+A));
   assert.equal(await identity(page),null);
   await page.getByRole("link",{name:"Crear cuenta"}).click();
   await page.waitForURL(u=>u.pathname==="/auth");
   await page.getByLabel("Correo").fill("qa-qr-newfamily@example.invalid");
   await page.getByLabel("Contraseña").fill("Local-QA-qr-newfamily-Test-2026!aZ6");
   await page.getByRole("button",{name:"Crear QA"}).click();
   await page.waitForURL(u=>u.pathname==="/onboarding/join-school");
   await page.waitForFunction(()=>window.__qa?.actions?.navigation?.some(x=>
     x[1]==="/marketplace?joined=1"),null,{timeout:24000});
   const uid=await identity(page);
   assert.equal(await readSchool(page,uid),A);
   const meta=await page.evaluate(async()=>(
    await window.__qa.supabase.auth.getUser()).data.user.user_metadata);
   assert.equal(meta.school_id,A);
   console.log("PASS guest QR -> local real GoTrue signup -> ORIGINAL join UI -> RLS family profile A + auth metadata.");
   await ctx.close();
  }

  // Existing real GoTrue family profile B. QR for school A must NOT switch it
  // until the React user actually confirms a school change.
  let familyId;
  {
   const {page,ctx}=await context();
   familyId=await login(page,"qa-school-family@example.invalid",
      "Local-QA-school-family-Test-2026!aZ6","login",qr,true);
   await page.getByText("Vas a cambiar de centro").waitFor();
   assert.equal(await readSchool(page,familyId),B);
   const roleCount=await page.evaluate(async()=>(
     await window.__qa.supabase.from("user_roles").select("role")).data.length);
   assert.equal(roleCount,0);
   await page.getByRole("button",{name:"Cambiar a COLEGIO QA ALFA"}).click();
   await page.waitForFunction(()=>window.__qa.actions.navigation.some(x=>
     x[1]==="/marketplace?joined=1"));
   assert.equal(await readSchool(page,familyId),A);
   assert.equal((await page.evaluate(()=>window.__qa.signOut())).error,null);
   await login(page,"qa-school-family@example.invalid",
     "Local-QA-school-family-Test-2026!aZ6","login",
     "/onboarding/join-school?school="+A+"&join=1",true);
   assert.equal(await readSchool(page,familyId),A);
   console.log("PASS commercial AuthForm login + real GoTrue -> original QR UI: B preserved until explicit change to A and after logout/relogin.");
   await ctx.close();
  }

  // Original commercial signup enforces verification even when local
  // GoTrue offers an immediate session. This does not deliver email.
  {
   const {page,ctx}=await context();
   const q="/auth-real?mode=signup&next="+encodeURIComponent(qr)+
    "&utm_source=school&utm_medium=qr&utm_campaign=school_invite";
   await page.goto(origin+q,{waitUntil:"load"});
   await page.getByRole("heading",{name:"Crear cuenta"}).waitFor();
   await page.getByLabel("Nombre *").fill("QA");
   await page.getByLabel("Apellidos *").fill("Familia Prueba");
   await page.getByLabel("Email").fill("qa-qr-authform-signup@example.invalid");
   await page.getByLabel("Contraseña").fill("Local-QA-authform-signup-Test-2026!aZ6");
   await page.getByRole("combobox").click();
   await page.getByRole("option",{name:"Familia / tutor"}).click();
   await page.getByLabel("Código postal *").fill("37001");
   await page.getByRole("checkbox").check();
   await page.getByTestId("local-turnstile-stub").waitFor();
   await page.getByRole("button",{name:"Crear cuenta",exact:true}).last().click();
   await page.getByText(
     "Wetudy requiere verificar el email antes de iniciar sesión.",
     {exact:false}).waitFor({timeout:18000});
   assert.equal(await identity(page),null,
    "Commercial signup must sign out when local GoTrue returns an immediate session");
   console.log("PASS real AuthForm signup blocks automatic local session pending email verification.");
   await ctx.close();
  }

  // A real, unrelated GoTrue JWT cannot inspect/mutate the family's row.
  {
   const {page,ctx}=await context();
   await login(page,"qa-visitor@example.invalid",
     "Local-QA-visitor-Test-2026!aZ6","login",
     "/onboarding/join-school");
   const row=await page.evaluate(async(target)=>{
    const found=await window.__qa.supabase.from("profiles")
      .select("id,school_id").eq("id",target);
    const mutated=await window.__qa.supabase.from("profiles")
      .update({school_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"})
      .eq("id",target).select("id");
    return {found:found.data,mutated:mutated.data,
      selectError:found.error?.message,updateError:mutated.error?.message};
   },familyId);
   assert.equal(row.selectError,undefined);
   assert.equal(row.updateError,undefined);
   assert.deepEqual(row.found,[]);
   assert.deepEqual(row.mutated,[]);
   console.log("PASS stranger GoTrue JWT cannot read/change original family's school under local PostgREST RLS.");
   await ctx.close();
  }
  console.log("PASS original commercial AuthForm LOGIN and SIGNUP guard, QR UI and local GoTrue/RLS together in Chromium.");
  console.log("LIMIT: AuthForm real; Turnstile token/navigation QA adapters; confirmation email/callback and public school Next API NOT end-to-end verified.");
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
})().catch(e=>{console.error("Unified QR Auth browser QA failed:",e.message);process.exitCode=1;});
