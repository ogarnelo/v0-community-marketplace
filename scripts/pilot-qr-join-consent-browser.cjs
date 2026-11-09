#!/usr/bin/env node
"use strict";
// Compiles actual QR onboarding React page; every identity/school is fictional.
// Auth and school API are in-memory controlled here; local GoTrue/RLS suite
// separately validates persistence/security with real Supabase services.
const assert=require("node:assert/strict");
const http=require("node:http"),path=require("node:path"),fs=require("node:fs");
const ROOT=process.cwd(),MOD=process.env.PILOT_UI_MODULES||"/tmp/wetudy-moderation-integrated/node_modules";
const {build}=require(path.join(MOD,"esbuild"));
const {chromium}=require(path.join(MOD,"playwright"));
const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID="55555555-5555-4555-8555-555555555555";
const SCHOOLS={[A]:{id:A,name:"COLEGIO QA ALFA",city:"Ciudad QA"},
 [B]:{id:B,name:"COLEGIO QA BETA",city:"Ciudad QA"}};
function bootstrap(query){
 const linked=query.get("profile")==="beta"?B:null;
 const logged=query.get("auth")==="1";
 return [
  "const QA_A="+JSON.stringify(A)+";",
  "const QA_B="+JSON.stringify(B)+";",
  "const QA_USER="+JSON.stringify(ID)+";",
  "const QA_SCHOOLS="+JSON.stringify(SCHOOLS)+";",
  "let schoolId="+JSON.stringify(linked)+";",
  "let auth="+JSON.stringify(logged)+";",
  "const actions={upserts:[],updates:[],metadata:[],analytics:[],navigation:[],refresh:0,tracks:[]};",
  "const profile={id:QA_USER,get school_id(){return schoolId}};",
  "const client={",
  "auth:{getUser:async()=>({data:{user:auth?{id:QA_USER}:null}}),",
  "updateUser:async(payload)=>{actions.metadata.push(payload);return {error:null}}},",
  "from:(table)=>{if(table!=='profiles')throw Error('Unexpected table '+table);return {",
  "select:()=>({eq:()=>({maybeSingle:async()=>({data:schoolId?{school_id:schoolId}:null,error:null})})}),",
  "upsert:async(row)=>{schoolId=row.school_id;actions.upserts.push(row);return {error:null}},",
  "update:(row)=>({eq:async()=>{schoolId=row.school_id;actions.updates.push(row);return {error:null}}})",
  "}}};",
  "const router={push:(x)=>actions.navigation.push(['push',x]),",
  "replace:(x)=>actions.navigation.push(['replace',x]),",
  "refresh:()=>{actions.refresh++}};",
  "window.__qa={client,router,actions,profile,get schoolId(){return schoolId}};"
 ].join("\n");
}
(async()=>{
 const bundle=await build({
  entryPoints:["scripts/pilot-qr-join-consent-entry.cjs"],
  absWorkingDir:ROOT,platform:"browser",format:"iife",target:"es2020",
  bundle:true,write:false,nodePaths:[MOD],
  plugins:[{name:"qr-onboarding-local-adapters",setup(b){
   const named=new Set(["next/navigation","next/link","@vercel/analytics","@/lib/supabase/client"]);
   b.onResolve({filter:/^(?:next\/navigation|next\/link|@vercel\/analytics|@\/lib\/supabase\/client)$/},
     arg=>({namespace:"qa-mock",path:arg.path}));
   b.onLoad({filter:/.*/,namespace:"qa-mock"},arg=>{
    let contents;
    if(arg.path==="next/navigation")contents="export function useRouter(){return window.__qa.router;}";
    else if(arg.path==="next/link")
      contents='import React from "react"; export default function Link(props){return React.createElement("a",props,props.children)}';
    else if(arg.path==="@vercel/analytics")
      contents="export function track(name,data){window.__qa.actions.tracks.push({name,data})}";
    else contents="export function createClient(){return window.__qa.client;}";
    return {loader:"js",contents};
   });
   b.onResolve({filter:/^@\//},arg=>{
    const root=path.join(ROOT,arg.path.slice(2));
    return {path:fs.existsSync(root+".tsx")?root+".tsx":root+".ts"};
   });
  }}]
 });
 const js=bundle.outputFiles[0].text;
 const server=http.createServer((req,res)=>{
   const url=new URL(req.url,"http://127.0.0.1");
   if(url.pathname==="/api/schools/public"){
     const id=url.searchParams.get("id");
     const inactive=url.searchParams.get("inactive")==="1";
     const scenarioInactive=url.searchParams.get("id")===A && req.headers["x-qa-inactive"]==="1";
     const fail=req.headers["x-qa-error"]==="1";
     res.writeHead(fail?500:200,{"content-type":"application/json","cache-control":"private, no-store"});
     return res.end(JSON.stringify(fail?{error:"QA school lookup failed"}:
       id?{school:scenarioInactive?null:SCHOOLS[id]||null}:
       {schools:Object.values(SCHOOLS)}));
   }
   if(url.pathname==="/api/analytics/acquisition"){
     res.writeHead(200,{"content-type":"application/json"});
     return res.end('{"ok":true}');
   }
   // No external requests, no actual emails.
   const q=url.searchParams;
   const pre=bootstrap(q);
   res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
   return res.end("<!doctype html><html lang='es'><meta charset='utf-8'><body>"+
      "<main id='root'></main><script>"+pre+"</script><script>"+js+"</script></body></html>");
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true});
 async function scenario(name,url,execute,flags={}){
   const ctx=await browser.newContext();
   const page=await ctx.newPage();
   page.setDefaultTimeout(17000);
   await page.route("**/*",route=>{
     const req=route.request(),target=new URL(req.url());
     if(target.origin!==origin)return route.abort();
     if(req.resourceType()==="document")return route.continue();
     const headers={...req.headers(),
       ...(flags.inactive?{"x-qa-inactive":"1"}:{}),
       ...(flags.fail?{"x-qa-error":"1"}:{})};
     return route.continue({headers});
   });
   try{
     await page.goto(origin+url,{waitUntil:"load"});
     await page.getByText("Preparando el centro...").waitFor({state:"hidden"});
     await execute(page);
     console.log("PASS QR onboarding scenario: "+name);
   }finally{await ctx.close();}
 }
 try{
   // Existing account with another school MUST NOT be switched automatically.
   await scenario("linked B stays B until explicit confirmation",
      "/onboarding/join-school?auth=1&profile=beta&school="+A+"&join=1",
      async page=>{
        await page.getByText("Vas a cambiar de centro").waitFor();
        await page.getByRole("button",{name:"Cambiar a COLEGIO QA ALFA"}).waitFor();
        let qa=await page.evaluate(()=>({school:window.__qa.schoolId,acts:window.__qa.actions}));
        assert.equal(qa.school,B);
        assert.equal(qa.acts.upserts.length,0,"Cross-school QR must never silently reassign a linked family");
        assert.equal(qa.acts.navigation.length,0);
        await page.getByRole("button",{name:"Cambiar a COLEGIO QA ALFA"}).click();
        await page.waitForFunction(()=>window.__qa.actions.upserts.length===1);
        qa=await page.evaluate(()=>({school:window.__qa.schoolId,acts:window.__qa.actions}));
        assert.equal(qa.school,A);
        assert.ok(qa.acts.navigation.some(x=>x[1]==="/marketplace?joined=1"));
      });

   // Unlinked family can complete explicit pending-join from the auth flow.
   await scenario("unlinked family completes pending QR join",
      "/onboarding/join-school?auth=1&school="+A+"&join=1",
      async page=>{
        await page.waitForFunction(()=>window.__qa.actions.upserts.length===1);
        const qa=await page.evaluate(()=>({school:window.__qa.schoolId,acts:window.__qa.actions}));
        assert.equal(qa.school,A);
        assert.ok(qa.acts.navigation.some(x=>x[1]==="/marketplace?joined=1"));
      });

   // Guest sees login/signup; campaign tags and school remain in safe NEXT URLs.
   await scenario("guest preserves school and UTM through auth links",
     "/onboarding/join-school?school="+A+"&utm_source=school&utm_medium=qr&utm_campaign=school_invite",
     async page=>{
       await page.getByText("¿Ya tienes cuenta en Wetudy?").waitFor();
       const href=await page.getByRole("link",{name:"Ya tengo cuenta"}).getAttribute("href");
       assert.ok(href.includes("mode=login"));
       assert.ok(href.includes("utm_source=school")&&href.includes("utm_campaign=school_invite"));
       const next=new URL(href,origin).searchParams.get("next");
       assert.ok(next.includes("school="+A)&&next.includes("join=1"));
       const qa=await page.evaluate(()=>window.__qa.actions);
       assert.equal(qa.upserts.length,0);
     });

   // Existing family views its center without shared URL and can remove it.
   await scenario("linked family can unlink voluntarily",
     "/onboarding/join-school?auth=1&profile=beta",
     async page=>{
       await page.getByText("Ya tienes un centro vinculado").waitFor();
       await page.getByRole("button",{name:"Desvincular centro"}).click();
       await page.waitForFunction(()=>window.__qa.actions.updates.length===1);
       const qa=await page.evaluate(()=>({school:window.__qa.schoolId,acts:window.__qa.actions}));
       assert.equal(qa.school,null);
       assert.equal(qa.acts.metadata.length,1);
     });

   // School deactivation must not cause auto-join. The original page uses
   // the public API which no longer caches individual school IDs.
   await scenario("inactive shared school cannot change current family school",
     "/onboarding/join-school?auth=1&profile=beta&school="+A+"&join=1",
     async page=>{
       await page.getByText("Este enlace de centro ya no está disponible.").waitFor();
       const qa=await page.evaluate(()=>({school:window.__qa.schoolId,acts:window.__qa.actions}));
       assert.equal(qa.school,B);
       assert.equal(qa.acts.upserts.length,0);
     },{inactive:true});

   console.log("PASS five scenarios on ORIGINAL QR join React screen with isolated QA Auth and school API; no production users/schools.");
   console.log("LIMIT: Auth and school API are test adapters here; GoTrue/RLS and real Next SSR are validated in separate CI.");
 }finally{
   await browser.close();
   await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error("Original QR onboarding Chromium regression FAILED:",e.stack||e.message);process.exitCode=1;});
