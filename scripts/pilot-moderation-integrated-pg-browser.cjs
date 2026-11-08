#!/usr/bin/env node
"use strict";
// Executes ACTUAL moderation React controls + ACTUAL Next POST route + ACTUAL
// PR #267 PostgreSQL function against disposable localhost PG17.
// Auth identity is emulated by a local cookie; never call this production E2E.
const assert=require("node:assert/strict");
const path=require("node:path");
const http=require("node:http");
const {AsyncLocalStorage}=require("node:async_hooks");
const Module=require("node:module");
const ROOT=process.cwd();
const MODULES=process.env.PILOT_UI_MODULES||"/tmp/wetudy-moderation-integrated/node_modules";
const {build}=require(path.join(MODULES,"esbuild"));
const {chromium}=require(path.join(MODULES,"playwright"));
const {Pool}=require(path.join(MODULES,"pg"));
const url=new URL(process.env.DATABASE_URL||"");
if(!["localhost","127.0.0.1","[::1]"].includes(url.hostname)) throw Error("Refusing nonlocal database");
const db=new Pool({connectionString:process.env.DATABASE_URL,max:5});
const identity=new AsyncLocalStorage();
const SUPER="00000000-0000-4000-8000-000000000102";
const SCHOOL="00000000-0000-4000-8000-000000000101";
const REPORT="00000000-0000-4000-8000-000000000401";

async function realReactComponentBundle(){
  const entry=[
    'import React from "react";',
    'import { createRoot } from "react-dom/client";',
    'import { ReportStatusControls } from "./components/admin/report-status-controls.tsx";',
    'createRoot(document.getElementById("app")).render(React.createElement(ReportStatusControls,{reportId:"'+REPORT+'",initialStatus:"open"}));'
  ].join("\n");
  const result=await build({
    stdin:{contents:entry,resolveDir:ROOT,sourcefile:"moderation-integration-entry.tsx",loader:"tsx"},
    bundle:true,write:false,format:"iife",platform:"browser",target:"es2020",
    nodePaths:[MODULES],
    plugins:[{
      name:"only-test-UI-primitives",
      setup(b){
        b.onResolve({filter:/^@\/components\/ui\/(?:button|textarea)$/},arg=>({path:arg.path,namespace:"qa-ui"}));
        b.onLoad({filter:/.*/,namespace:"qa-ui"},arg=>({
          resolveDir:ROOT,loader:"tsx",
          contents:arg.path.endsWith("/button")
          ? 'import React from "react";export const Button=({children,...props})=>React.createElement("button",props,children);'
          : 'import React from "react";export const Textarea=(props)=>React.createElement("textarea",props);'
        }));
      }
    }]
  });
  return result.outputFiles[0].text;
}

async function actualNextModerationHandler(){
  const bundle=await build({
    entryPoints:["app/api/admin/reports/status/route.ts"],absWorkingDir:ROOT,
    bundle:true,write:false,format:"cjs",platform:"node",target:"node24",
    plugins:[{
      name:"controlled-session-and-pg-adapter",
      setup(b){
        b.onResolve({filter:/^(?:next\/server|@\/lib\/supabase\/(?:server|admin))$/},
          arg=>({path:arg.path,namespace:"qa-adapter"}));
        b.onLoad({filter:/.*/,namespace:"qa-adapter"},arg=>{
          const content=arg.path==="next/server"
            ? 'export const NextResponse={json:(p,o={})=>Response.json(p,{status:o.status||200})};'
            : arg.path.endsWith("/server")
              ? 'export async function createClient(){return globalThis.__qaSessionClient();}'
              : 'export function createAdminClient(){return globalThis.__qaAdminClient();}';
          return {contents:content,loader:"js"};
        });
      }
    }]
  });
  const m=new Module(path.join(ROOT,"__moderation_real_route.cjs"),module);
  m.filename=path.join(ROOT,"__moderation_real_route.cjs");
  m.paths=module.paths;
  m._compile(bundle.outputFiles[0].text,m.filename);
  return m.exports.POST;
}

globalThis.__qaSessionClient=()=>({
  auth:{getUser:async()=>{
    const actor=identity.getStore()?.actor||null;
    return {data:{user:actor?{id:actor}:null}};
  }},
  from(table){
    assert.equal(table,"user_roles","only current real role query allowed");
    const filter={};
    const q={
      select(){return q;},
      eq(key,value){filter[key]=value;return q;},
      async limit(n){
        assert.equal(n,1);
        const rows=await db.query("select role from public.user_roles where user_id=$1 and role=$2 limit 1",
          [filter.user_id,filter.role]);
        return {data:rows.rows,error:null};
      }
    };
    return q;
  }
});
globalThis.__qaAdminClient=()=>({
  async rpc(name,args){
    assert.equal(name,"server_update_report_status");
    try{
      const r=await db.query(
        "select (public.server_update_report_status($1::uuid,$2::uuid,$3::text,$4::text)).*",
        [args.p_actor_id,args.p_report_id,args.p_status,args.p_resolution_note]
      );
      return {data:r.rows[0],error:null};
    }catch(e){return {data:null,error:{message:e.message}};}
  }
});

async function snapshot(){
  const [report,notice,events,agreement]=await Promise.all([
    db.query("select status,resolution_note,resolved_by,resolved_at from public.reports where id=$1",[REPORT]),
    db.query("select count(*)::int n from public.notifications"),
    db.query("select count(*)::int n from public.agreement_events"),
    db.query("select status from public.agreements")
  ]);
  return {report:report.rows[0],notices:notice.rows[0].n,events:events.rows[0].n,agreement:agreement.rows[0].status};
}

(async()=>{
 const html=await realReactComponentBundle();
 const handler=await actualNextModerationHandler();
 const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==="GET"&&req.url==="/"){
      res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
      return res.end('<!doctype html><html lang="es"><meta charset="utf-8"><body><main id="app"></main><script>'+html+'</script></body></html>');
    }
    if(req.method!=="POST"||req.url!=="/api/admin/reports/status"){res.writeHead(404);return res.end();}
    const cookie=(req.headers.cookie||"").match(/(?:^|;\s*)qa-user=(\d{8}-[\da-f-]+)(?:;|$)/);
    const actor=cookie&&[SUPER,SCHOOL].includes(cookie[1])?cookie[1]:null;
    let body="";
    for await(const chunk of req)body+=chunk;
    const result=await identity.run({actor},()=>handler(new Request(
      "http://127.0.0.1/api/admin/reports/status",
      {method:"POST",headers:{"Content-Type":"application/json"},body}
    )));
    const text=await result.text();
    res.writeHead(result.status,{"Content-Type":"application/json","Cache-Control":"no-store"});
    res.end(text);
  }catch(e){console.error(e);res.writeHead(500);res.end("test adapter failure");}
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true});
 try {
  const anon=await browser.newContext();
  const noSession=await anon.request.post(origin+"/api/admin/reports/status",{
    data:{reportId:REPORT,status:"resolved"}
  });
  assert.equal(noSession.status(),401);
  await anon.close();

  const ampa=await browser.newContext();
  await ampa.addCookies([{name:"qa-user",value:SCHOOL,url:origin}]);
  const schoolAttempt=await ampa.request.post(origin+"/api/admin/reports/status",{
    data:{reportId:REPORT,status:"resolved"}
  });
  assert.equal(schoolAttempt.status(),403,"real DB roles reject school_admin");
  await ampa.close();

  const context=await browser.newContext();
  await context.addCookies([{name:"qa-user",value:SUPER,url:origin}]);
  const page=await context.newPage();
  await page.route("**/*",r=>new URL(r.request().url()).origin===origin ? r.continue() : r.abort());
  await page.goto(origin,{waitUntil:"load"});
  await page.getByRole("button",{name:"Resuelta"}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll("button")].some(b=>b.textContent==="Resuelta"&&b.disabled));
  let v=await snapshot();
  assert.equal(v.report.status,"resolved");assert.equal(v.notices,1);assert.equal(v.events,1);
  assert.equal(v.agreement,"confirmed");

  const resolvedBy=v.report.resolved_by,at=v.report.resolved_at;
  await page.getByLabel("Respuesta al usuario").fill("Edición QA de respuesta");
  // Wait for the HTTP response, not for the button label to disappear:
  // during loading the button changes its label to "Guardando...".
  const saveResponse=page.waitForResponse(r=>
    r.url().endsWith("/api/admin/reports/status") &&
    r.request().method()==="POST" &&
    r.request().postDataJSON()?.resolutionNote==="Edición QA de respuesta"
  );
  await page.getByRole("button",{name:"Guardar respuesta"}).click();
  assert.equal((await saveResponse).status(),200);
  v=await snapshot();
  assert.equal(v.report.resolution_note,"Edición QA de respuesta");
  assert.equal(v.notices,1);assert.equal(v.events,1);
  assert.equal(v.report.resolved_by,resolvedBy);
  assert.equal(v.report.resolved_at.getTime(),at.getTime());

  // Two duplicate real POSTs racing on one row lock must not notify twice.
  const requests=[0,1].map(()=>context.request.post(origin+"/api/admin/reports/status",{
    data:{reportId:REPORT,status:"resolved",resolutionNote:"Edición QA de respuesta"}
  }));
  const results=await Promise.all(requests);
  assert.deepEqual(results.map(r=>r.status()),[200,200]);
  v=await snapshot();assert.equal(v.notices,1);assert.equal(v.events,1);

  await page.getByRole("button",{name:"En revisión"}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll("button")].some(b=>b.textContent==="En revisión"&&b.disabled));
  v=await snapshot();assert.equal(v.report.status,"reviewing");
  assert.equal(v.notices,1);assert.equal(v.events,2);assert.equal(v.agreement,"disputed");
  await page.getByRole("button",{name:"Resuelta"}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll("button")].some(b=>b.textContent==="Resuelta"&&b.disabled));
  v=await snapshot();assert.equal(v.report.status,"resolved");
  assert.equal(v.notices,2);assert.equal(v.events,3);assert.equal(v.agreement,"confirmed");

  // Actually revoke the super_admin DB role while browser session remains.
  await db.query("delete from public.user_roles where user_id=$1 and role='super_admin'",[SUPER]);
  await page.getByRole("button",{name:"Descartada"}).click();
  await page.getByText("No autorizado.").waitFor();
  v=await snapshot();assert.equal(v.report.status,"resolved");
  assert.equal(v.notices,2);assert.equal(v.events,3);
  console.log("PASS real React UI -> real Next POST -> real PR #267 PG17: guest 401, AMPA 403, resolution, note, concurrent retries, reopen, rerresolve, revoked superadmin 403.");
  console.log("LIMIT: auth identity is a disposable localhost cookie adapter; Supabase Auth and full page login are not used.");
  await context.close();
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error("Integrated moderation QA failed",e);process.exitCode=1;}).finally(()=>db.end());
