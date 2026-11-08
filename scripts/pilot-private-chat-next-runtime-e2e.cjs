#!/usr/bin/env node
"use strict";
// Exercise REAL Next.js 16 dev HTTP runtime using copies of unchanged repo files,
// REAL Supabase SSR/browser clients, real browser cookies, and LOCAL Supabase services.
// Never uses production credentials, domains, or objects.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn,execFileSync}=require("node:child_process");
const {chromium}=require(path.join(process.env.PILOT_QA_MODULES||"/tmp/wetudy-next-qa/node_modules","playwright"));
const {createClient}=require(path.join(process.env.PILOT_QA_MODULES||"/tmp/wetudy-next-qa/node_modules","@supabase/supabase-js"));
const root=process.cwd();
const fixture=process.env.PILOT_NEXT_FIXTURE||"/tmp/wetudy-next-qa";
const api=process.env.LOCAL_SUPABASE_URL||"";
const key=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const db=process.env.LOCAL_DB_URL||"";
const local=h=>["127.0.0.1","localhost","[::1]","::1"].includes(h);
if(!api||!key||!db||!local(new URL(api).hostname)||!local(new URL(db).hostname))
 throw Error("Only loopback Supabase Auth/Storage/DB endpoints permitted");
if(fs.existsSync(path.join(fixture,".next")))fs.rmSync(path.join(fixture,".next"),{recursive:true,force:true});
function copy(relative){
 const dest=path.join(fixture,relative);
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.copyFileSync(path.join(root,relative),dest);
}
for(const file of [
 "app/api/messages/attachment/route.ts",
 "lib/supabase/server.ts","lib/supabase/client.ts",
 "lib/supabase/proxy.ts","lib/messages/private-attachment-guards.mjs",
 "lib/messages/private-attachment-guards.d.mts","proxy.ts"
]) copy(file);
fs.mkdirSync(path.join(fixture,"app"),{recursive:true});
fs.writeFileSync(path.join(fixture,"app/layout.tsx"),
 'import React from "react";export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>;}');
fs.writeFileSync(path.join(fixture,"app/page.tsx"),[
 '"use client";',
 'import {useEffect} from "react";',
 'import {createClient} from "@/lib/supabase/client";',
 'const client=createClient();',
 'export default function Page(){',
 ' useEffect(()=>{',
 '  (window as any).__qaLogin=async(email:string,password:string)=>{',
 '   const {data,error}=await client.auth.signInWithPassword({email,password});',
 '   return {id:data?.user?.id||null,error:error?.message||null};',
 '  };',
 '  (window as any).__qaLogout=async()=>{const {error}=await client.auth.signOut();return error?.message||null;};',
 '  (window as any).__qaDownload=async(id:string)=>{',
 '    const r=await fetch("/api/messages/attachment?messageId="+encodeURIComponent(id),{credentials:"same-origin",cache:"no-store"});',
 '    return {status:r.status,body:await r.text(),cache:r.headers.get("cache-control"),type:r.headers.get("content-type"),disposition:r.headers.get("content-disposition")};',
 '  };',
 ' },[]);',
 ' return <main data-testid="qa-home">Local Next browser QA</main>;',
 '}'
].join("\n"));
fs.writeFileSync(path.join(fixture,"package.json"),JSON.stringify({
 name:"wetudy-local-next-attachment-qa",version:"0.0.0",private:true,
 dependencies:{"next":"16.3.5","react":"19.2.4","react-dom":"19.2.4",
 "@supabase/ssr":"0.6.1","@supabase/supabase-js":"2.58.0"}
},null,2));
fs.writeFileSync(path.join(fixture,"tsconfig.json"),JSON.stringify({
 compilerOptions:{
  target:"ES2020",lib:["dom","dom.iterable","esnext"],allowJs:true,skipLibCheck:true,
  strict:false,noEmit:true,esModuleInterop:true,module:"esnext",moduleResolution:"bundler",
  resolveJsonModule:true,isolatedModules:true,jsx:"preserve",
  paths:{"@/*":["./*"]}},
 include:["**/*.ts","**/*.tsx",".next/types/**/*.ts"],exclude:["node_modules"]
},null,2));

const sql=s=>execFileSync("psql",["-X","-v","ON_ERROR_STOP=1",db,"-c",s],
 {stdio:"pipe",timeout:18000});
const SUPABASE=()=>createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
async function signup(label){
 const client=SUPABASE();
 const email="qa-next-"+label+"@example.invalid";
 const password="Local-Next-"+label+"-E2E-2026!9a";
 const {error:signupError}=await client.auth.signUp({email,password});
 assert.ifError(signupError);
 const {data:login,error}=await client.auth.signInWithPassword({email,password});
 assert.ifError(error);assert.ok(login.user?.id,"Local GoTrue user ID");
 return {client,email,password,id:login.user.id};
}
const conv="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const msg="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const marker="NEXT16-LOCAL-AUTH-PRIVATE-ATTACHMENT";
let next=null;
const nextPort="31377";
async function waitReady(){
 for(let i=0;i<90;i++){
   if(next?.exitCode!==null)throw Error("Next exited before readiness");
   try{
     const response=await fetch("http://127.0.0.1:"+nextPort+"/",{signal:AbortSignal.timeout(1600)});
     if(response.ok && (await response.text()).includes("Local Next browser QA"))return;
   }catch{}
   await new Promise(r=>setTimeout(r,1800));
 }
 throw Error("Local Next runtime did not become ready");
}

(async()=>{
 const [buyer,seller,other]=await Promise.all([signup("buyer"),signup("seller"),signup("third")]);
 const objectPath=conv+"/"+buyer.id+"/test.pdf";
 sql("insert into public.conversations(id,buyer_id,seller_id) values('"+conv+"','"+buyer.id+"','"+seller.id+"')");
 const {error:uploadError}=await buyer.client.storage.from("chat-attachments")
  .upload(objectPath,new Blob([marker],{type:"application/pdf"}),
    {contentType:"application/pdf",upsert:false});
 assert.ifError(uploadError);
 sql("insert into public.messages(id,conversation_id,attachment_path,attachment_type,attachment_name) values ('"+
 msg+"','"+conv+"','"+objectPath+"','application/pdf','Libro español 6º.pdf')");
 const nextBin=path.join(fixture,"node_modules/next/dist/bin/next");
 assert.ok(fs.existsSync(nextBin),"Next 16 dependency installed into ephemeral fixture");
 next=spawn(process.execPath,[nextBin,"dev","--hostname","127.0.0.1","--port",nextPort],
   {cwd:fixture,env:{
    ...process.env,NEXT_TELEMETRY_DISABLED:"1",
    NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_ANON_KEY:key
   },stdio:["ignore","pipe","pipe"]});
 let fatal="";
 for(const stream of [next.stderr,next.stdout])
   stream.on("data",d=>{const t=d.toString();if(/error|fatal|module not found/i.test(t))fatal+=t.slice(-1500);});
 await waitReady();
 const origin="http://127.0.0.1:"+nextPort;
 const browser=await chromium.launch({headless:true});
 try{
   async function actor(identity){
    const ctx=await browser.newContext();
    const page=await ctx.newPage();
    await page.route("**/*",route=>{
      const target=new URL(route.request().url());
      return [origin,new URL(api).origin].includes(target.origin)?route.continue():route.abort();
    });
    await page.goto(origin,{waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>typeof window.__qaLogin==="function");
    if(identity){
      const login=await page.evaluate(([email,password])=>window.__qaLogin(email,password),
        [identity.email,identity.password]);
      assert.equal(login.error,null);
      assert.equal(login.id,identity.id);
      assert.ok((await ctx.cookies(origin)).some(c=>c.name.startsWith("sb-")));
    }
    return {ctx,page};
   }
   async function check(session,expected){
     const r=await session.page.evaluate(id=>window.__qaDownload(id),msg);
     assert.equal(r.status,expected);
     assert.equal(r.cache,"private, no-store, max-age=0");
     if(expected===200){
       assert.equal(r.body,marker);
       assert.equal(r.type,"application/octet-stream");
       assert.match(r.disposition,/filename\*=UTF-8''Libro%20espa%C3%B1ol%206%C2%BA\.pdf/);
     }else assert.doesNotMatch(r.body,/NEXT16-LOCAL-AUTH/);
   }
   const guest=await actor(null);
   const a=await actor(buyer);
   const b=await actor(seller);
   const c=await actor(other);
   await check(guest,401);await check(a,200);await check(b,200);await check(c,404);
   sql("update public.conversations set buyer_id='"+other.id+"' where id='"+conv+"'");
   await check(a,404);await check(b,200);await check(c,200);
   const invalid=await b.page.evaluate(()=>window.__qaDownload("invalid-id"));
   assert.equal(invalid.status,400);
   assert.equal(await a.page.evaluate(()=>window.__qaLogout()),null);
   await check(a,401);
   for(const t of [guest,a,b,c])await t.ctx.close();
   console.log("PASS FULL Next.js 16 dev HTTP runtime, actual /api/messages/attachment route, SSR proxy and cookies, Chromium, GoTrue Auth, RLS and private Storage — all localhost.");
   console.log("Verified guest 401, buyer/seller 200, third/revoked 404, invalid UUID 400, logout 401, filename Unicode.");
   console.log("LIMIT: minimal Next app fixture with exact production route/server/proxy files, not full Wetudy messaging UI or all production database tables.");
 }finally{await browser.close();}
})().catch(error=>{
 console.error("Full Next local attachment E2E failed:",error.message);
 process.exitCode=1;
}).finally(async()=>{
 if(next){
   next.kill("SIGTERM");
   await new Promise(resolve=>{
     if(next.exitCode!==null)return resolve();
     next.once("exit",resolve);
     setTimeout(()=>{if(next.exitCode===null)next.kill("SIGKILL");resolve();},3000).unref();
   });
 }
});
