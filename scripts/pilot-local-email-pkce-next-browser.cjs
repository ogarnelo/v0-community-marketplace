#!/usr/bin/env node
"use strict";
// Original Next.js callback + real localhost GoTrue/PKCE + Mailpit.
// Credentials, email and database are disposable and synthetic, NEVER hosted.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {spawn,execFileSync}=require("node:child_process");
const mods=process.env.PILOT_EMAIL_MODULES||"/tmp/wetudy-email-next-local/node_modules";
const fixture=process.env.PILOT_EMAIL_FIXTURE||"/tmp/wetudy-email-next-local";
const root=process.cwd(),port=31421,origin="http://localhost:"+port;
const api=process.env.LOCAL_SUPABASE_URL||"";
const anon=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const service=process.env.LOCAL_SUPABASE_SERVICE_KEY||"";
const db=process.env.LOCAL_DB_URL||"";
const mail=process.env.LOCAL_MAILPIT_URL||"http://127.0.0.1:54324";
const email="qa-email-pkce-family@example.invalid";
const password="Local-QA-EmailConfirm-2026!X3a";
const school="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const {chromium}=require(path.join(mods,"playwright"));
const {build}=require(path.join(mods,"esbuild"));
const local=host=>["localhost","127.0.0.1","[::1]","::1"].includes(host);
for(const url of [api,db,mail,origin])
 if(!url||!local(new URL(url).hostname))throw Error("Refusing nonlocal email QA URL");
assert.ok(api.startsWith("http://")&&mail.startsWith("http://")&&anon.length>10&&service.length>10);
function sql(q){
 return execFileSync("psql",["-X","-A","-t","-v","ON_ERROR_STOP=1",db,"-c",q],
  {encoding:"utf8",timeout:22000,stdio:["ignore","pipe","pipe"]}).trim();
}
function write(name,body){
 const dest=path.join(fixture,name);
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.writeFileSync(dest,body);
}
function copy(name){
 const dest=path.join(fixture,name);
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.copyFileSync(path.join(root,name),dest);
}
async function setup(){
 for(const name of ["app/auth/callback/route.ts","lib/supabase/server.ts",
  "lib/supabase/client.ts","lib/supabase/admin.ts","lib/auth/safe-next.ts",
  "lib/users/person-name.ts","lib/growth/attribution.ts"])copy(name);
 if(fs.existsSync(path.join(fixture,".next")))fs.rmSync(path.join(fixture,".next"),{recursive:true,force:true});
 write("qa/events.ts","export function deferProductEvent(_name:string,_data:any){/* no network telemetry in local QA */}");
 write("app/layout.tsx",'import React from "react";export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}<script src="/qa-email-client.js" defer /></body></html>;}');
 write("app/page.tsx",'export default function Page(){return <main>LOCAL EMAIL CONFIRMATION QA</main>;}');
 write("app/auth/page.tsx",'export default function Auth(){return <main>LOCAL INVALID AUTH LINK</main>;}');
 write("app/onboarding/students/page.tsx",'export default function Students(){return <main>LOCAL STUDENT ONBOARDING</main>;}');
 write("app/onboarding/join-school/page.tsx",'export default function Join(){return <main>LOCAL QR DESTINATION</main>;}');
 write("tsconfig.json",JSON.stringify({compilerOptions:{
  target:"ES2020",lib:["dom","dom.iterable","esnext"],strict:false,
  allowJs:true,skipLibCheck:true,noEmit:true,esModuleInterop:true,
  module:"esnext",moduleResolution:"bundler",resolveJsonModule:true,
  isolatedModules:true,jsx:"preserve",baseUrl:".",paths:{
   "@/lib/analytics/product-events.server":["./qa/events.ts"],"@/*":["./*"]
  }},include:["**/*.ts","**/*.tsx",".next/types/**/*.ts"],exclude:["node_modules"]},null,2));
 write("package.json",JSON.stringify({name:"wetudy-local-email-confirm-qa",private:true,
  version:"0.0.0",dependencies:{next:"16.3.5",react:"19.2.4","react-dom":"19.2.4",
  "@supabase/ssr":"0.6.1","@supabase/supabase-js":"2.58.0"}},null,2));
 const src=[
  'import {createClient} from "./lib/supabase/client.ts";',
  'const client=createClient();',
  'window.__qaEmail={',
  ' signup:async(p)=>{const {data,error}=await client.auth.signUp(p);',
  ' return {id:data.user?.id||null,session:!!data.session,error:error?.message||null};},',
  ' user:async()=>{const {data,error}=await client.auth.getUser();',
  ' return {id:data.user?.id||null,confirmed:!!data.user?.email_confirmed_at,error:error?.message||null};},',
  ' login:async(email,password)=>{const {data,error}=await client.auth.signInWithPassword({email,password});',
  ' return {id:data.user?.id||null,error:error?.message||null};},',
  ' profile:async(id)=>{const {data,error}=await client.from("profiles")',
  ' .select("id,first_name,last_name,user_type,postal_code").eq("id",id).maybeSingle();',
  ' return {data,error:error?.message||null};}',
  '};'
 ].join("\n");
 write("qa-email-entry.js",src);
 const bundle=await build({entryPoints:[path.join(fixture,"qa-email-entry.js")],
  bundle:true,write:false,platform:"browser",format:"iife",target:"es2020",
  nodePaths:[mods],define:{
   "process.env.NEXT_PUBLIC_SUPABASE_URL":JSON.stringify(api),
   "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY":JSON.stringify(anon)
  }});
 write("public/qa-email-client.js",bundle.outputFiles[0].text);
}
async function waitReady(child){
 for(let i=0;i<110;i++){
  if(child.exitCode!==null)throw Error("Next exited");
  try{
   const r=await fetch(origin,{signal:AbortSignal.timeout(1700)});
   if(r.ok&&(await r.text()).includes("LOCAL EMAIL CONFIRMATION QA"))return;
  }catch{}
  await new Promise(r=>setTimeout(r,1300));
 }
 throw Error("Next local route timed out");
}
async function mailLink(){
 for(let tries=0;tries<65;tries++){
  try{
   const res=await fetch(mail+"/api/v1/messages",{signal:AbortSignal.timeout(1500)});
   if(res.ok){
    const summary=await res.json();
    const found=(summary.messages||[]).find(x=>
     JSON.stringify(x.To||x.to||[]).includes(email));
    if(found){
     const id=encodeURIComponent(found.ID||found.id);
     const r=await fetch(mail+"/api/v1/message/"+id);
     const data=await r.json();
     const html=await fetch(mail+"/view/"+id+".html").then(r=>r.ok?r.text():"");
     const body=[data.HTML,data.Text,data.html,data.text,html]
      .filter(Boolean).join("\n").replaceAll("&amp;","&").replaceAll("&#38;","&");
     const links=body.match(/https?:\/\/[^\s"'<>]+/g)||[];
     for(let link of links){
      link=link.replace(/[),.;]+$/,"");
      try{
       const u=new URL(link);
       if(local(u.hostname)&&u.port==="54321"&&u.pathname.includes("/auth/v1/verify"))
        return u.toString();
      }catch{}
     }
     throw Error("Mailpit captured local email but no safe GoTrue verification URL found, content length="+body.length);
    }
   }
  }catch(error){if(tries>=58)throw error;}
  await new Promise(r=>setTimeout(r,650));
 }
 throw Error("Mailpit confirmation message missing");
}
(async()=>{
 await setup();
 const bin=path.join(mods,"next/dist/bin/next");
 assert.ok(fs.existsSync(bin));
 const child=spawn(process.execPath,[bin,"dev","--hostname","127.0.0.1",
  "--port",String(port)],{cwd:fixture,env:{...process.env,
   NEXT_TELEMETRY_DISABLED:"1",NEXT_PUBLIC_SUPABASE_URL:api,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service
  },stdio:["ignore","pipe","pipe"]});
 let diagnostics="";
 for(const stream of [child.stdout,child.stderr])stream.on("data",data=>{
  let s=data.toString().replaceAll(anon,"[local-anon]").replaceAll(service,"[local-service]");
  if(/error|fatal|fail/i.test(s))diagnostics=(diagnostics+s).slice(-5000);
 });
 let browser;
 try{
  await waitReady(child);
  browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext(),page=await ctx.newPage();
  page.setDefaultTimeout(25000);
  const allow=new Set([origin,new URL(api).origin]);
  await page.route("**/*",route=>allow.has(new URL(route.request().url()).origin)
    ?route.continue():route.abort());
  await page.goto(origin,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof window.__qaEmail?.signup==="function");
  const qr="/onboarding/join-school?school="+school+"&join=1";
  const next="/onboarding/students?next="+encodeURIComponent(qr);
  const callback=origin+"/auth/callback?next="+encodeURIComponent(next);
  const signed=await page.evaluate(async p=>window.__qaEmail.signup(p),{
   email,password,options:{emailRedirectTo:callback,data:{
    first_name:"QA",last_name:"Confirmación",full_name:"QA Confirmación",
    user_type:"parent",postal_code:"37001",
    wetudy_email_confirmation_required:true,
    wetudy_acquisition_source:"school",wetudy_acquisition_medium:"qr",
    wetudy_acquisition_campaign:"school_invite",
    wetudy_acquisition_landing_path:"/auth"
   }}
  });
  assert.equal(signed.error,null);
  assert.match(signed.id||"",/^[0-9a-f-]{36}$/i);
  assert.equal(signed.session,false,"Must not issue unconfirmed signup session");
  const login=await page.evaluate(p=>window.__qaEmail.login(p.email,p.password),
   {email,password});
  assert.ok(login.error && !login.id,"Login forbidden before email verification");
  assert.ok((await ctx.cookies(origin)).some(x=>x.name.includes("code-verifier")),
   "PKCE verifier cookie missing from browser");
  console.log("PASS unconfirmed local GoTrue user denied password login; browser PKCE verifier retained.");
  const link=await mailLink();
  const landing=await page.goto(link,{waitUntil:"domcontentloaded",timeout:90000});
  const reached=new URL(page.url());
  console.log("Local Mailpit confirmation destination:",JSON.stringify({
    origin:reached.origin,pathname:reached.pathname,
    queryKeys:Array.from(reached.searchParams.keys()),httpStatus:landing?.status()||null
  }));
  await page.waitForURL(u=>u.origin===origin&&u.pathname==="/onboarding/students",
   {timeout:13000});
  assert.equal(new URL(page.url()).searchParams.get("next"),qr);
  await page.waitForFunction(()=>typeof window.__qaEmail?.user==="function");
  const user=await page.evaluate(()=>window.__qaEmail.user());
  assert.equal(user.id,signed.id);
  assert.equal(user.confirmed,true);
  const profile=await page.evaluate(id=>window.__qaEmail.profile(id),signed.id);
  assert.equal(profile.error,null);
  assert.deepEqual(profile.data,{
   id:signed.id,first_name:"QA",last_name:"Confirmación",
   user_type:"parent",postal_code:"37001"
  });
  const attribution=sql("select source,medium,campaign from public.growth_acquisition_events where user_id='"+signed.id+"'");
  assert.equal(attribution,"school|qr|school_invite");
  console.log("PASS actual Mailpit email -> local GoTrue verify -> ORIGINAL Next auth callback with PKCE session cookie, RLS profile and attribution.");
  await page.goto(origin+"/auth/callback?code=invalid-qa-code&next="+
   encodeURIComponent("https://invalid.example/external"),{waitUntil:"domcontentloaded"});
  await page.waitForURL(u=>u.pathname==="/auth"&&
   u.searchParams.get("auth_error")==="invalid_link",{timeout:23000});
  console.log("PASS original Next callback rejects invalid code and prevents external redirect.");
  console.log("LIMIT: original AuthForm is covered separately; Turnstile external, email provider hosted and full student onboarding are NOT part of this local rehearsal.");
  await ctx.close();
 }catch(error){
  console.error("EMAIL/PKCE NEXT CALLBACK QA FAILED:",error.stack||error.message);
  console.error("Next sanitized diagnostics:",diagnostics.slice(-3000));
  process.exitCode=1;
 }finally{
  if(browser)await browser.close();
  child.kill("SIGTERM");
  await new Promise(done=>{
    if(child.exitCode!==null)return done();
    child.once("exit",done);
    setTimeout(()=>{if(child.exitCode===null)child.kill("SIGKILL");done();},3400).unref();
  });
 }
})().catch(error=>{console.error("Email QA startup failed:",error.message);process.exitCode=1;});
