#!/usr/bin/env node
"use strict";
// Render the REAL server component app/admin/school/page.tsx and drive it with
// Chromium, against IN-MEMORY synthetic Supabase adapters and fake user sessions.
// No Supabase credentials, no public network, no database or production writes.
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const root = process.cwd();
const modules = process.env.PILOT_UI_MODULES || "/tmp/wetudy-ampa-ui/node_modules";
const {build} = require(path.join(modules,"esbuild"));
const {chromium} = require(path.join(modules,"playwright"));
const React=require(path.join(modules,"react"));
const {renderToStaticMarkup}=require(path.join(modules,"react-dom/server"));

const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const SCHOOL_A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SCHOOL_B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const fixtures=[
 {user:A,school:SCHOOL_A,name:"COLEGIO QA ALFA",listing:"ANUNCIO SOLO ALFA",code:"CODIGO_ALFA_SECRETO"},
 {user:B,school:SCHOOL_B,name:"COLEGIO QA BETA",listing:"ANUNCIO SOLO BETA",code:"CODIGO_BETA_SECRETO"}
];
const byActor={A:fixtures[0],B:fixtures[1]};
const state={actor:"A",revoked:new Set(),queries:[]};

const publicTables={
 schools:fixtures.map(f=>({id:f.school,name:f.name,city:"Ciudad QA",is_active:true})),
 listings:fixtures.map(f=>({id:f.school,title:f.listing,school_id:f.school,created_at:"2026-11-08T12:00:00Z",status:"available",seller_id:f.user})),
 profiles:fixtures.map(f=>({id:f.user,full_name:"Administrador de "+f.name,school_id:f.school})),
 account_students:[],
 school_access_codes:fixtures.map(f=>({school_id:f.school,code:f.code,is_active:true,created_at:"2026-11-08T12:00:00Z"})),
 user_roles:fixtures.map(f=>({user_id:f.user,role:"school_admin",school_id:f.school})),
 donation_requests:[],
 agreements:[],
 reports:fixtures.map(f=>({id:f.school,listing_id:f.school,target_type:"listing",reason:"INCIDENCIA SOLO "+f.name,status:"open",created_at:"2026-11-08T12:00:00Z"})),
 listing_views:[],
 school_impact_report_subscriptions:[],
 school_impact_report_deliveries:[],
};
const scopedTables=new Set(["schools","listings","school_access_codes","user_roles","donation_requests","agreements","school_impact_report_subscriptions","school_impact_report_deliveries"]);
function query(table,scope){
 const filters=[];
 const builder={
   select(){return builder;},
   eq(k,v){filters.push({op:"eq",k,v});return builder;},
   in(k,v){filters.push({op:"in",k,v});return builder;},
   not(){return builder;},
   order(){return builder;},
   limit(){return builder;},
   returns(){return builder;},
   maybeSingle:async()=>{const result=selectRows();return {data:result[0]||null,error:null};},
   then:(resolve,reject)=>Promise.resolve({data:selectRows(),error:null}).then(resolve,reject),
 };
 function selectRows(){
   state.queries.push({actor:state.actor,table,scope,filters:filters.map(x=>({...x}))});
   let rows=(publicTables[table]||[]).slice();
   if(table==="user_roles") rows=rows.filter(x=>!state.revoked.has(x.user_id));
   const actor=byActor[state.actor]||null;
   if(scope==="session"){
     if(table==="profiles")rows=rows.filter(x=>x.id===actor?.user);
     if(table==="user_roles")rows=rows.filter(x=>x.user_id===actor?.user);
   }
   for(const f of filters){
     if(f.op==="eq") rows=rows.filter(row=>row[f.k]===f.v);
     if(f.op==="in") rows=rows.filter(row=>Array.isArray(f.v)&&f.v.includes(row[f.k]));
   }
   return rows;
 }
 return builder;
}
globalThis.__qaAmPaSession = async()=>({
 auth:{getUser:async()=>({data:{user:byActor[state.actor]?{id:byActor[state.actor].user,email:"qa-"+state.actor.toLowerCase()+"@example.invalid"}:null}})},
 from:(table)=>query(table,"session"),
});
globalThis.__qaAmPaAdmin=()=>({from:(table)=>query(table,"privileged")});

async function buildRealPage(){
 const built=await build({
   entryPoints:["app/admin/school/page.tsx"],absWorkingDir:root,write:false,
   bundle:true,platform:"node",format:"cjs",target:"node24",jsx:"automatic",
   nodePaths:[modules],
   plugins:[{
      name:"synthetic-server-imports",
      setup(b){
        const keys={
          "next/navigation":"nav",
          "lucide-react":"icon",
          "@/lib/supabase/server":"session",
          "@/lib/supabase/admin":"admin",
          "@/components/navbar":"navbar",
          "@/components/footer":"footer",
          "@/components/admin/school-admin-dashboard":"dashboard",
          "@/components/admin/donation-requests-panel":"donations"
        };
        b.onResolve({filter:/^(?:next\/navigation|lucide-react|@\/)/},args=>{
           if(!(args.path in keys))throw new Error("Unexpected privileged dependency: "+args.path);
           return {path:keys[args.path],namespace:"qa"};
        });
        b.onLoad({filter:/.*/,namespace:"qa"},args=>{
          let contents;
          switch(args.path){
            case "nav": contents='export const redirect=(url)=>{throw new Error("QA_REDIRECT:"+url)};';break;
            case "icon": contents='import React from "react"; export const Shield=()=>React.createElement("span",null,"Escudo QA");';break;
            case "session": contents="export async function createClient(){return globalThis.__qaAmPaSession();}";break;
            case "admin": contents="export function createAdminClient(){return globalThis.__qaAmPaAdmin();}";break;
            case "navbar": contents='import React from "react"; export const Navbar=()=>React.createElement("nav",null,"WETUDY QA");';break;
            case "footer": contents='import React from "react"; export const Footer=()=>React.createElement("footer",null,"QA");';break;
            case "dashboard": contents='import React from "react"; export default function SchoolAdminDashboard(p){return React.createElement("section",{"data-testid":"school-dashboard"},React.createElement("h2",null,p.school?.name),React.createElement("ul",null,...p.listings.map(l=>React.createElement("li",{key:l.id},l.title))),React.createElement("p",null,"CÓDIGOS: "+p.accessCodes.map(c=>c.code).join(",")),React.createElement("p",null,"INCIDENCIAS: "+p.reports.map(r=>r.reason).join(",")),React.createElement("p",null,"MIEMBROS: "+p.memberCount));}';break;
            case "donations": contents='import React from "react"; export const DonationRequestsPanel=()=>React.createElement("div",null,"Donaciones QA");';break;
            default:throw new Error("No stub for "+args.path);
          }
          return {contents,loader:"tsx",resolveDir:root};
        });
      }
   }]
 });
 const Module=require("node:module");
 const m=new Module(path.join(root,"__wetudy_ampa_page.cjs"),module);
 m.filename=path.join(root,"__wetudy_ampa_page.cjs");
 m.paths=[modules,...module.paths];
 m._compile(built.outputFiles[0].text,m.filename);
 return m.exports.default;
}

(async()=>{
 const SchoolAdminPage=await buildRealPage();
 const server=http.createServer(async(req,res)=>{
   if(req.url!=="/admin/school"){
     res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
     return res.end('<html><body>REDIRIGIDO: acceso no autorizado</body></html>');
   }
   const cookie=req.headers.cookie||"";
   state.actor=(cookie.match(/qa-ampa=(A|B|STRANGER)(?:;|$)/)||[])[1]||"STRANGER";
   try{
     const result=await SchoolAdminPage();
     const rendered=renderToStaticMarkup(result);
     res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
     res.end('<!doctype html><html><body>'+rendered+'</body></html>');
   }catch(error){
     const str=String(error?.message||error);
     if(str.startsWith("QA_REDIRECT:")){
       res.writeHead(302,{Location:str.slice(12),"Cache-Control":"no-store"});
       return res.end();
     }
     console.error(error);res.writeHead(500);res.end("QA server error");
   }
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
   async function visit(actor){
     const ctx=await browser.newContext();
     await ctx.addCookies([{name:"qa-ampa",value:actor,url:origin}]);
     const page=await ctx.newPage();
     await page.route("**/*",r=>new URL(r.request().url()).origin===origin ? r.continue() : r.abort());
     await page.goto(origin+"/admin/school",{waitUntil:"domcontentloaded"});
     const body=await page.locator("body").innerText();
     const url=page.url();
     await ctx.close();
     return {body,url};
   }
   const alfa=await visit("A");
   assert.match(alfa.body,/Panel Admin - COLEGIO QA ALFA/);
   assert.match(alfa.body,/ANUNCIO SOLO ALFA/);
   assert.match(alfa.body,/CODIGO_ALFA_SECRETO/);
   assert.doesNotMatch(alfa.body,/COLEGIO QA BETA|ANUNCIO SOLO BETA|CODIGO_BETA_SECRETO|INCIDENCIA SOLO COLEGIO QA BETA/);
   const beta=await visit("B");
   assert.match(beta.body,/Panel Admin - COLEGIO QA BETA/);
   assert.match(beta.body,/ANUNCIO SOLO BETA/);
   assert.match(beta.body,/CODIGO_BETA_SECRETO/);
   assert.doesNotMatch(beta.body,/COLEGIO QA ALFA|ANUNCIO SOLO ALFA|CODIGO_ALFA_SECRETO|INCIDENCIA SOLO COLEGIO QA ALFA/);
   const stranger=await visit("STRANGER");
   assert.match(stranger.body,/REDIRIGIDO: acceso no autorizado/);
   state.revoked.add(A);
   const revoked=await visit("A");
   assert.match(revoked.body,/REDIRIGIDO: acceso no autorizado/);
   assert.doesNotMatch(revoked.body,/COLEGIO QA ALFA|CODIGO_ALFA_SECRETO/);
   const betaAfter=await visit("B");
   assert.match(betaAfter.body,/Panel Admin - COLEGIO QA BETA/);
   assert.doesNotMatch(betaAfter.body,/COLEGIO QA ALFA/);
   const privilegedReads=state.queries.filter(x=>x.scope==="privileged"&&scopedTables.has(x.table)&&x.table!=="user_roles");
   for(const q of privilegedReads){
     const own=byActor[q.actor]?.school;
     if(!own) continue;
     assert.ok(q.filters.some(f=>f.op==="eq"&&f.k===(q.table==="schools"?"id":"school_id")&&f.v===own),
       "Privileged "+q.table+" query was not constrained to session school for "+q.actor);
   }
   console.log("PASS: real AMPA server page rendered in Chromium with mock sessions A/B, cross-school separation, stranger denied, A revoked while B remains.");
   console.log("LIMIT: Supabase/Auth are simulated and child dashboard uses a rendering stub; real database-backed browser E2E is still pending.");
 }finally{
   await browser.close();
   await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error("AMPA browser test failure:",error);process.exitCode=1;});
