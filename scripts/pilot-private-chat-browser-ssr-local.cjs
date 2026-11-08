#!/usr/bin/env node
"use strict";
// Chromium -> REAL Wetudy createBrowserClient cookies -> REAL Wetudy createServerClient
// -> REAL Next private-attachment GET -> LOCAL Supabase GoTrue, PostgREST & Storage.
// Only Next request/response integration is adapted to a tiny localhost HTTP harness.
// The identities/files never exist outside this disposable local Supabase stack.
const assert=require("node:assert/strict");
const path=require("node:path");
const http=require("node:http");
const Module=require("node:module");
const {AsyncLocalStorage}=require("node:async_hooks");
const {execFileSync}=require("node:child_process");
const root=process.cwd();
const mods=process.env.PILOT_QA_MODULES||"/tmp/wetudy-ssr-browser-qa/node_modules";
const {build}=require(path.join(mods,"esbuild"));
const {chromium}=require(path.join(mods,"playwright"));
const {createClient}=require(path.join(mods,"@supabase/supabase-js"));

const api=process.env.LOCAL_SUPABASE_URL||"";
const anonKey=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const db=process.env.LOCAL_DB_URL||"";
const isLocal=h=>["127.0.0.1","localhost","[::1]","::1"].includes(h);
if(!api||!anonKey||!db||!isLocal(new URL(api).hostname)||!isLocal(new URL(db).hostname))
  throw Error("Refusing any hosted Auth/DB/Storage endpoint");
process.env.NEXT_PUBLIC_SUPABASE_URL=api;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=anonKey;
const messageId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const conversationId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fileText="LOCAL-SSR-COOKIE-BROWSER-ATTACHMENT";
const cookieContext=new AsyncLocalStorage();

const sql=(s)=>execFileSync("psql",["-X","-v","ON_ERROR_STOP=1",db,"-c",s],{stdio:"pipe",timeout:18000});
const serverFixture=()=>createClient(api,anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
async function makeIdentity(label){
  const client=serverFixture();
  const email="browser-ssr-"+label+"@example.invalid";
  const password="BrowserSSR-"+label+"-2026-Test!8Y";
  const {error:signError}=await client.auth.signUp({email,password});
  assert.ifError(signError);
  const {data:login,error:loginError}=await client.auth.signInWithPassword({email,password});
  assert.ifError(loginError);
  assert.ok(login.user?.id,"real local GoTrue identity expected");
  return {id:login.user.id,email,password,client};
}

function parseCookieHeader(raw){
  return (raw||"").split(";").map(item=>item.trim()).filter(Boolean).map(item=>{
    const idx=item.indexOf("=");
    if(idx<0)return null;
    const name=item.slice(0,idx);
    let value=item.slice(idx+1);
    try{value=decodeURIComponent(value);}catch{}
    return {name,value};
  }).filter(Boolean);
}
globalThis.__qaRealCookieStore=async()=>({
  getAll(){return cookieContext.getStore()?.cookieList||[];},
  set(name,value,options={}){
    const ctx=cookieContext.getStore();
    if(!ctx)throw Error("Missing per-request cookie context");
    ctx.setCookies.push({name,value,options});
  }
});
async function bundleRealRoute(){
  const compiled=await build({
    entryPoints:["app/api/messages/attachment/route.ts"],absWorkingDir:root,
    bundle:true,write:false,platform:"node",format:"cjs",target:"node24",
    nodePaths:[mods],
    plugins:[{name:"next-request-adapter-only",setup(b){
      b.onResolve({filter:/^@\/lib\/supabase\/server$/},()=>({
        path:path.join(root,"lib/supabase/server.ts")
      }));
      b.onResolve({filter:/^@\/lib\/messages\/private-attachment-guards\.mjs$/},()=>({
        path:path.join(root,"lib/messages/private-attachment-guards.mjs")
      }));
      b.onResolve({filter:/^next\/headers$/},()=>({path:"next-headers",namespace:"qa-next"}));
      b.onResolve({filter:/^next\/server$/},()=>({path:"next-server",namespace:"qa-next"}));
      b.onLoad({filter:/.*/,namespace:"qa-next"},arg=>({
        loader:"js",
        contents:arg.path==="next-headers"
          ? "export async function cookies(){return globalThis.__qaRealCookieStore();}"
          : 'export const NextResponse={json:(body,opts={})=>Response.json(body,{status:opts.status||200,headers:opts.headers||{}})};'
      }));
    }}]
  });
  const m=new Module(path.join(root,"__qa_real_server_cookies.cjs"),module);
  m.filename=path.join(root,"__qa_real_server_cookies.cjs");
  m.paths=[mods,...module.paths];
  m._compile(compiled.outputFiles[0].text,m.filename);
  return m.exports.GET;
}

async function bundleRealBrowser(){
  const entry=[
    'import {createClient} from "./lib/supabase/client.ts";',
    'const client=createClient();',
    'window.__qaLogin=async(email,password)=>{const {data,error}=await client.auth.signInWithPassword({email,password});return {id:data?.user?.id||null,error:error?.message||null};};',
    'window.__qaLogout=async()=>{const {error}=await client.auth.signOut();return error?.message||null;};',
    'window.__qaDownload=async(id)=>{const r=await fetch("/api/messages/attachment?messageId="+encodeURIComponent(id),{credentials:"same-origin",cache:"no-store"});return {status:r.status,contentType:r.headers.get("content-type"),disposition:r.headers.get("content-disposition"),cache:r.headers.get("cache-control"),body:await r.text()};};'
  ].join("\n");
  const result=await build({
    stdin:{contents:entry,resolveDir:root,sourcefile:"qa-browser-client.ts",loader:"ts"},
    bundle:true,write:false,platform:"browser",format:"iife",target:"es2020",
    nodePaths:[mods],
    define:{
      "process.env.NEXT_PUBLIC_SUPABASE_URL":JSON.stringify(api),
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY":JSON.stringify(anonKey)
    }
  });
  return result.outputFiles[0].text;
}

(async()=>{
  const [buyer,seller,outsider]=await Promise.all([
    makeIdentity("buyer"),makeIdentity("seller"),makeIdentity("stranger")
  ]);
  const pathToFile=conversationId+"/"+buyer.id+"/qa.pdf";
  sql("insert into public.conversations(id,buyer_id,seller_id) values ('"+
    conversationId+"','"+buyer.id+"','"+seller.id+"')");
  const up=await buyer.client.storage.from("chat-attachments")
    .upload(pathToFile,new Blob([fileText],{type:"application/pdf"}),
      {contentType:"application/pdf",upsert:false});
  assert.ifError(up.error);
  sql("insert into public.messages(id,conversation_id,attachment_path,attachment_type,attachment_name) values ('"+
    messageId+"','"+conversationId+"','"+pathToFile+"','application/pdf','Material 6º.pdf')");
  const [GET,script]=await Promise.all([bundleRealRoute(),bundleRealBrowser()]);
  const server=http.createServer(async(req,res)=>{
    if(req.method==="GET" && req.url==="/"){
      res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
      return res.end("<!doctype html><html><meta charset='utf-8'><body>QA local browser<script>"+script+"</script></body></html>");
    }
    if(req.method!=="GET" || !(req.url||"").startsWith("/api/messages/attachment?")){
      res.writeHead(404);return res.end();
    }
    const ctx={cookieList:parseCookieHeader(req.headers.cookie),setCookies:[]};
    try{
      const response=await cookieContext.run(ctx,()=>GET(
        new Request("http://127.0.0.1"+req.url)
      ));
      res.statusCode=response.status;
      for(const [key,value] of response.headers.entries()) res.setHeader(key,value);
      if(ctx.setCookies.length){
        res.setHeader("Set-Cookie",ctx.setCookies.map(c=>encodeURIComponent(c.name)+
          "="+encodeURIComponent(c.value)+"; Path=/; SameSite=Lax"));
      }
      res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){console.error("Real server route failed",error);res.writeHead(500);res.end();}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const origin="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    async function browserActor(identity){
      const context=await browser.newContext();
      const page=await context.newPage();
      await page.route("**/*",route=>{
        const target=new URL(route.request().url());
        const allowed=target.origin===origin || target.origin===new URL(api).origin;
        return allowed?route.continue():route.abort();
      });
      await page.goto(origin,{waitUntil:"load"});
      if(identity){
        const login=await page.evaluate(([email,password])=>window.__qaLogin(email,password),
          [identity.email,identity.password]);
        assert.equal(login.error,null,"real browser signInWithPassword failed");
        assert.equal(login.id,identity.id);
        const cookies=await context.cookies(origin);
        assert.ok(cookies.some(c=>c.name.startsWith("sb-") && c.value),
          "Real browser Supabase SSR auth cookie not created");
      }
      return {context,page};
    }
    async function check(actor,expected){
      const result=await actor.page.evaluate(id=>window.__qaDownload(id),messageId);
      assert.equal(result.status,expected);
      assert.equal(result.cache,"private, no-store, max-age=0");
      if(expected===200){
        assert.equal(result.contentType,"application/octet-stream");
        assert.match(result.disposition,/filename\*=UTF-8''Material%206%C2%BA\.pdf/);
        assert.equal(result.body,fileText);
      }else assert.doesNotMatch(result.body,/LOCAL-SSR-COOKIE-BROWSER-ATTACHMENT/);
    }
    const guest=await browserActor(null);
    await check(guest,401);
    const a=await browserActor(buyer);
    const b=await browserActor(seller);
    const c=await browserActor(outsider);
    await check(a,200);await check(b,200);await check(c,404);

    sql("update public.conversations set buyer_id='"+outsider.id+"' where id='"+conversationId+"'");
    await check(a,404);await check(b,200);await check(c,200);

    const invalid=await b.page.evaluate(()=>window.__qaDownload("not-an-id"));
    assert.equal(invalid.status,400);
    sql("update public.messages set attachment_path='"+
      conversationId+"/"+outsider.id+"/../unsafe.pdf' where id='"+messageId+"'");
    await check(b,404);
    assert.equal(await a.page.evaluate(()=>window.__qaLogout()),null);
    await check(a,401);
    for(const actor of [guest,a,b,c])await actor.context.close();
    console.log("PASS Chromium REAL browser Supabase cookie -> REAL lib/supabase/server.ts createServerClient -> REAL Next private GET -> LOCAL GoTrue/RLS/Storage.");
    console.log("Cases: guest 401; buyer/seller 200; outsider and revoked 404; invalid UUID 400; unsafe path 404; sign-out 401.");
    console.log("LIMIT: localhost Node HTTP request adapter replaces Next HTTP runtime; actual SSR and browser client functions, cookies, and backend services are real, not full Next deployment.");
  }finally{
    await browser.close();
    await new Promise(r=>server.close(r));
  }
})().catch(err=>{console.error("Browser SSR real-cookie integration failed:",err);process.exitCode=1;});
