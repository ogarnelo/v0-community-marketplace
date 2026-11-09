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
 for(const name of ["app/auth/callback/route.ts","app/api/account/students/route.ts",
  "app/api/account/students/[id]/route.ts","lib/supabase/server.ts",
  "lib/supabase/client.ts","lib/supabase/admin.ts","lib/auth/safe-next.ts",
  "lib/users/person-name.ts","lib/growth/attribution.ts"])copy(name);
 if(fs.existsSync(path.join(fixture,".next")))fs.rmSync(path.join(fixture,".next"),{recursive:true,force:true});
 write("qa/events.ts","export function deferProductEvent(_name:string,_data:any){/* no network telemetry in local QA */}");
 
 // Test ORIGINAL student service and API against disposable local schema.
 copy("lib/account-students/server.ts");
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
  ' return {data,error:error?.message||null};},',
  ' updateProfile:async(id)=>{const {data,error}=await client.from("profiles")',
  ' .update({postal_code:"99999"}).eq("id",id).select("id");',
  ' return {rows:data?.length||0,error:error?.message||null};},',
  ' insertProfile:async(id)=>{const {data,error}=await client.from("profiles")',
  ' .insert({id,first_name:"Intrusion",last_name:"QA",user_type:"parent",postal_code:"00000"})',
  ' .select("id");return {rows:data?.length||0,error:error?.message||null};},',
  ' students:async(owner)=>{const {data,error}=await client.from("account_students")',
  ' .select("id,owner_user_id,alias,grade_level").eq("owner_user_id",owner);',
  ' return {data,error:error?.message||null};},',
  ' addStudent:async(owner)=>{const {data,error}=await client.from("account_students")',
  ' .insert({owner_user_id:owner,alias:"QA Alumno",grade_level:"4 Primaria"})',
  ' .select("id");return {data,error:error?.message||null};},',
  ' updateStudent:async(id)=>{const {data,error}=await client.from("account_students")',
  ' .update({alias:"Intrusion"}).eq("id",id).select("id");',
  ' return {data,error:error?.message||null};},',
  ' deleteStudent:async(id)=>{const {data,error}=await client.from("account_students")',
  ' .delete().eq("id",id).select("id");return {data,error:error?.message||null};}',
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
  const deniedBefore=await page.evaluate(async()=>{const res=await fetch("/api/account/students");return {status:res.status,body:await res.json()};});
  assert.equal(deniedBefore.status,401,"Unconfirmed visitor must not read students through the original Next API");
  assert.equal(deniedBefore.body.code,"unauthorized");

  const deniedPost=await page.evaluate(async()=>{const res=await fetch("/api/account/students",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({gradeLevel:"3 Primaria",alias:"Intento antes de verificar"})});
    return {status:res.status,body:await res.json()};});
  assert.equal(deniedPost.status,401,"Unconfirmed signup must not create students");
  assert.equal(deniedPost.body.code,"unauthorized");
  assert.equal(sql("select count(*) from public.account_students"),"0",
    "Unconfirmed creation must not write any student rows");
  console.log("PASS original student Next API returns 401 before email confirmation.");
  assert.ok((await ctx.cookies(origin)).some(x=>x.name.includes("code-verifier")),
   "PKCE verifier cookie missing from browser");
  console.log("PASS unconfirmed local GoTrue user denied password login; browser PKCE verifier retained.");
  const link=await mailLink();
  // Capture the original PKCE exchange path ONLY in this local process.
  // Never output, persist or report the one-time token.
  let confirmedCodePath=null;
  page.on("request",request=>{
    const target=new URL(request.url());
    if(target.origin===origin&&target.pathname==="/auth/callback"&&
      target.searchParams.get("code"))confirmedCodePath=target.pathname+target.search;
  });
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
  // A second synthetic family must be invisible and immutable via this user's RLS session.
  const foreignId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  sql("insert into public.profiles(id,first_name,last_name,user_type,postal_code) "+
    "values ('"+foreignId+"','Otra','Familia','parent','28001')");
  const foreignRead=await page.evaluate(id=>window.__qaEmail.profile(id),foreignId);
  assert.equal(foreignRead.error,null);
  assert.equal(foreignRead.data,null,"RLS must hide other families' profiles");
  const foreignWrite=await page.evaluate(id=>window.__qaEmail.updateProfile(id),foreignId);
  assert.equal(foreignWrite.error,null);
  assert.equal(foreignWrite.rows,0,"RLS must prevent updating another family");
  assert.equal(sql("select postal_code from public.profiles where id='"+foreignId+"'"),
    "28001","Other family's profile must remain unchanged");
  console.log("PASS real PostgREST/RLS prevents cross-family profile reads and writes.");
  const foreignInsertId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const foreignInsert=await page.evaluate(id=>window.__qaEmail.insertProfile(id),foreignInsertId);
  assert.equal(foreignInsert.rows,0,"RLS must deny creating a foreign-ID profile");
  assert.ok(foreignInsert.error,"RLS foreign insert must explicitly fail");
  assert.equal(sql("select count(*) from public.profiles where id='"+foreignInsertId+"'"),
    "0","No foreign-ID profile may be inserted");
  const selfWrite=await page.evaluate(id=>window.__qaEmail.updateProfile(id),signed.id);
  assert.equal(selfWrite.error,null,"Owner must retain legitimate update permission");
  assert.equal(selfWrite.rows,1,"Owner must be able to update exactly own profile");
  assert.equal(sql("select postal_code from public.profiles where id='"+signed.id+"'"),
    "99999","Legitimate own-profile update must persist");
  console.log("PASS own-profile update allowed, cross-family SELECT/UPDATE/INSERT denied.");
  // Synthetic students table with real authenticated PostgREST JWT/RLS.
  // Original API route and complete student schema remain untested here.
  const ownStudent=await page.evaluate(id=>window.__qaEmail.addStudent(id),signed.id);
  assert.equal(ownStudent.error,null);
  assert.equal(ownStudent.data?.length,1,"Confirmed parent can add own student");
  const studentId=ownStudent.data[0].id;
  sql("insert into public.account_students(owner_user_id,alias,grade_level) "+
      "values ('"+foreignId+"','Otra alumna','5 Primaria')");
  const foreignStudents=await page.evaluate(id=>window.__qaEmail.students(id),foreignId);
  assert.equal(foreignStudents.error,null);
  assert.equal(foreignStudents.data?.length,0,"Other family's students must remain private");
  const forgedStudent=await page.evaluate(id=>window.__qaEmail.addStudent(id),foreignId);
  assert.equal(forgedStudent.data,null,"Cross-family student INSERT must return no row");
  assert.ok(forgedStudent.error,"Cross-family student INSERT must be rejected by RLS");
  const foreignStudentId=sql("select id from public.account_students where owner_user_id='"+foreignId+"'");
  const unauthorizedUpdate=await page.evaluate(id=>window.__qaEmail.updateStudent(id),foreignStudentId);
  assert.equal(unauthorizedUpdate.error,null);
  assert.equal(unauthorizedUpdate.data?.length,0,"No cross-family student UPDATE");
  const unauthorizedDelete=await page.evaluate(id=>window.__qaEmail.deleteStudent(id),foreignStudentId);
  assert.equal(unauthorizedDelete.error,null);
  assert.equal(unauthorizedDelete.data?.length,0,"No cross-family student DELETE");
  assert.equal(sql("select alias from public.account_students where id='"+foreignStudentId+"'"),
    "Otra alumna","Foreign student must remain unchanged after attempted mutation");
  const ownVisible=await page.evaluate(id=>window.__qaEmail.students(id),signed.id);
  assert.equal(ownVisible.data?.length,1);
  assert.equal(ownVisible.data[0].id,studentId);
  console.log("PASS local student ownership RLS: own INSERT/SELECT, foreign SELECT/INSERT/UPDATE/DELETE denied.");
  // HTTP responses from the ORIGINAL Next route (the student data service
  // is a local RLS-backed adapter, not the full production implementation).
  const httpBefore=await page.evaluate(async()=>{const res=await fetch("/api/account/students");
    return {status:res.status,body:await res.json()};});
  assert.equal(httpBefore.status,200);
  assert.equal(httpBefore.body.students.length,1);
  assert.equal(httpBefore.body.students[0].id,studentId,
    "Real student service must list only the confirmed owner's student");
  const httpInvalid=await page.evaluate(async()=>{const res=await fetch("/api/account/students",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({gradeLevel:""})});
    return {status:res.status,body:await res.json()};});
  assert.equal(httpInvalid.status,400);
  assert.equal(sql("select count(*) from public.account_students where owner_user_id='"+signed.id+"'"),
    "1","Invalid student POST must not write a new record");
  const malformedJson=await page.evaluate(async()=>{const res=await fetch("/api/account/students",{
    method:"POST",headers:{"Content-Type":"application/json"},body:"{not-json"});
    return {status:res.status,body:await res.json()};});
  assert.equal(malformedJson.status,400,"Malformed student JSON must be rejected");
  assert.equal(sql("select count(*) from public.account_students where owner_user_id='"+signed.id+"'"),
    "1","Malformed POST must not write new student rows");

  const httpCreated=await page.evaluate(async()=>{const res=await fetch("/api/account/students",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({gradeLevel:"3 Primaria",alias:"Alumno desde API"})});
    return {status:res.status,body:await res.json()};});
  assert.equal(httpCreated.status,201);
  assert.equal(httpCreated.body.student.relationship,"guardian");
  assert.equal(httpCreated.body.student.alias,"Alumno desde API");
  assert.equal(sql("select owner_user_id from public.account_students where id='"+
    httpCreated.body.student.id+"'"),signed.id,"Original student service must persist correct owner");
  assert.equal(sql("select count(*) from public.account_students where owner_user_id='"+signed.id+"'"),"2");
  console.log("PASS original Next /api/account/students GET/POST: preconfirmation 401, owner read 200, invalid 400, creation 201.");

  const requestStudent=async(path,method,body)=>{
    return page.evaluate(async args=>{
      const options={method:args.method};
      if(args.body!==undefined){
        options.headers={"Content-Type":"application/json"};
        options.body=JSON.stringify(args.body);
      }
      const response=await fetch(args.path,options);
      return {status:response.status,body:await response.json()};
    },{path,method,body});
  };
  const noSchool=await requestStudent("/api/account/students","POST",
    {gradeLevel:"4 Primaria",schoolId:school});
  assert.equal(noSchool.status,400,"Inactive/nonexistent school must never be linked");
  assert.equal(noSchool.body.code,"school_unavailable");
  const invalidDirectory=await requestStudent("/api/account/students","POST",
    {gradeLevel:"4 Primaria",directorySchoolCode:"NOTVALID"});
  assert.equal(invalidDirectory.status,400);
  const directoryOnly=await requestStudent("/api/account/students","POST",
    {gradeLevel:"5 Primaria",directorySchoolCode:"99990001"});
  assert.equal(directoryOnly.status,201);
  assert.equal(directoryOnly.body.student.directory_school_code,"99990001");
  assert.equal(directoryOnly.body.student.school_id,null);
  assert.equal(sql("select count(*) from public.profiles where id='"+signed.id+
    "' and school_id is not null"),"0",
    "Choosing a directory school must NOT activate community membership");
  const otherStudentPatch=await requestStudent("/api/account/students/"+
    foreignStudentId,"PATCH",{gradeLevel:"6 Primaria"});
  assert.equal(otherStudentPatch.status,404,"Cannot patch another family's student");
  assert.equal(otherStudentPatch.body.code,"student_not_found");
  const otherStudentDelete=await requestStudent("/api/account/students/"+
    foreignStudentId,"DELETE");
  assert.equal(otherStudentDelete.status,404,"Cannot delete another family's student");
  const edited=await requestStudent("/api/account/students/"+
    httpCreated.body.student.id,"PATCH",
    {gradeLevel:"6 Primaria",alias:"Actualizado"});
  assert.equal(edited.status,200);
  assert.equal(edited.body.student.alias,"Actualizado");
  const removed=await requestStudent("/api/account/students/"+
    httpCreated.body.student.id,"DELETE");
  assert.equal(removed.status,200);
  assert.equal(removed.body.student.active,false);
  assert.equal(sql("select active from public.account_students where id='"+
    httpCreated.body.student.id+"'"),"f",
    "Original service must soft-deactivate instead of deleting row");
  const finalList=await requestStudent("/api/account/students","GET");
  assert.equal(finalList.status,200);
  assert.ok(finalList.body.students.every(x=>x.id!==httpCreated.body.student.id),
    "Soft-deactivated student must disappear from active list");
  assert.equal(sql("select alias from public.account_students where id='"+
    foreignStudentId+"'"),"Otra alumna");
  console.log("PASS ORIGINAL Next routes and ORIGINAL student service: POST/GET/PATCH/DELETE, own vs foreign ownership, nonactive schools, directory-only and soft-delete.");



  // Confirm that the authenticated PKCE session survives navigation/reload
  // before the parent proceeds to student onboarding and the school QR flow.
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof window.__qaEmail?.user==="function");
  const refreshed=await page.evaluate(()=>window.__qaEmail.user());
  assert.equal(refreshed.error,null);
  assert.equal(refreshed.id,signed.id,"Confirmed parent session must survive reload");
  assert.equal(refreshed.confirmed,true);
  const afterRefresh=await page.evaluate(id=>window.__qaEmail.profile(id),signed.id);
  assert.equal(afterRefresh.error,null);
  assert.equal(afterRefresh.data.postal_code,"99999",
    "Own RLS profile update must remain available after a full page reload");
  assert.equal(new URL(page.url()).pathname,"/onboarding/students",
    "Reload must preserve student-onboarding destination");
  assert.equal(new URL(page.url()).searchParams.get("next"),qr,
    "Reload must preserve the intended school QR continuation");
  console.log("PASS confirmed parent PKCE session, own-profile RLS and QR continuation survive browser reload.");


  const attribution=sql("select source,medium,campaign from public.growth_acquisition_events where user_id='"+signed.id+"'");
  assert.equal(attribution,"school|qr|school_invite");
  console.log("PASS actual Mailpit email -> local GoTrue verify -> ORIGINAL Next auth callback with PKCE session cookie, RLS profile and attribution.");
  assert.ok(confirmedCodePath&&confirmedCodePath.startsWith("/auth/callback?"),
    "One-time PKCE callback must be observed on local Next");
  // Replaying the SAME exchange code must not grant a second session or
  // re-run profile/attribution side effects.
  await page.goto(origin+confirmedCodePath,{waitUntil:"domcontentloaded"});
  await page.waitForURL(u=>u.pathname==="/auth"&&
    u.searchParams.get("auth_error")==="invalid_link",{timeout:20000});
  assert.equal(sql("select count(*) from public.growth_acquisition_events where user_id='"+
    signed.id+"'"),"1","One-time replay must not duplicate attribution");
  assert.equal(new URL(page.url()).origin,origin,"Spent PKCE code must stay on local origin");
  console.log("PASS replay of spent local PKCE code denied with no duplicate acquisition event.");
  // Missing/forged codes and external destinations must remain safe as well.
  await page.goto(origin+"/auth/callback?next="+
    encodeURIComponent("//external.example/steal"),{waitUntil:"domcontentloaded"});
  await page.waitForURL(u=>u.pathname==="/auth"&&
    u.searchParams.get("auth_error")==="invalid_link",{timeout:20000});
  assert.equal(new URL(page.url()).origin,origin,"Missing code must stay on local origin");
  console.log("PASS missing code cannot redirect to protocol-relative external origin.");
  await page.goto(origin+"/auth/callback?code=invalid-qa-code&next="+
   encodeURIComponent("https://invalid.example/external"),{waitUntil:"domcontentloaded"});
  await page.waitForURL(u=>u.pathname==="/auth"&&
   u.searchParams.get("auth_error")==="invalid_link",{timeout:23000});
  assert.equal(new URL(page.url()).origin,origin,"Invalid code must stay on local origin");
  console.log("PASS original Next callback rejects replayed, missing and invalid codes without offsite redirects.");
  console.log("LIMIT: original student API and persistence run locally; original student form, QR UI, AuthForm, Turnstile and hosted mail are not included.");
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
