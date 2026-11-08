#!/usr/bin/env node
"use strict";
// Real Next.js GET route -> real local GoTrue/Auth, PostgREST RLS and Storage API.
// Session injection replaces only Next SSR cookie plumbing, NOT the actual client.
// Never connect to a hosted Supabase project; no production objects are accessed.
const assert=require("node:assert/strict");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const Module=require("node:module");
const root=process.cwd();
const modules=process.env.PILOT_QA_MODULES||"/tmp/wetudy-chat-local-qa/node_modules";
const {build}=require(path.join(modules,"esbuild"));
const {createClient}=require(path.join(modules,"@supabase/supabase-js"));
const localUrl=process.env.LOCAL_SUPABASE_URL||"";
const localKey=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const db=process.env.LOCAL_DB_URL||"";
function isLocal(host){return ["localhost","127.0.0.1","[::1]","::1"].includes(host);}
if(!localUrl||!localKey||!db||!isLocal(new URL(localUrl).hostname)||!isLocal(new URL(db).hostname))
  throw Error("Refusing nonlocal Auth/Storage/DB URL");
const conv="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const msg="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const marker="SYNTHETIC-WETUDY-PDF-QA";
let activeClient=null;
const create=()=>createClient(localUrl,localKey,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const uuid=id=>{assert.match(id,/^[a-f0-9]{8}-[a-f0-9-]{27}$/i);return id;};
function sql(q){execFileSync("psql",["-X","-v","ON_ERROR_STOP=1",db,"-c",q],{stdio:"pipe",timeout:15000});}
async function signup(label){
 const client=create();
 const email="qa-route-"+label+"@example.invalid";
 const password="Route-Local-QA-"+label+"-Test2026!A";
 const {error:signError}=await client.auth.signUp({email,password});
 assert.ifError(signError);
 const {data:login,error}=await client.auth.signInWithPassword({email,password});
 assert.ifError(error);
 assert.ok(login.user?.id,"real GoTrue session required");
 return {client,id:uuid(login.user.id)};
}
async function compileRoute(){
 const bundle=await build({
  entryPoints:["app/api/messages/attachment/route.ts"],absWorkingDir:root,
  bundle:true,write:false,platform:"node",format:"cjs",target:"node24",
  plugins:[{name:"stub-next-only",setup(b){
    b.onResolve({filter:/^next\/server$/},()=>({path:"next/server",namespace:"qa"}));
    b.onResolve({filter:/^@\/lib\/supabase\/server$/},()=>({path:"ssr",namespace:"qa"}));
    b.onResolve({filter:/^@\/lib\/messages\/private-attachment-guards\.mjs$/},
      ()=>({path:path.join(root,"lib/messages/private-attachment-guards.mjs")}));
    b.onLoad({filter:/.*/,namespace:"qa"},args=>({
       loader:"js",
       contents:args.path==="ssr"
         ? "export async function createClient(){return globalThis.__qaActualLocalClient();}"
         : 'export const NextResponse={json:(x,o={})=>Response.json(x,{status:o.status||200,headers:o.headers||{}})};'
    }));
  }}]
 });
 const m=new Module(path.join(root,"__qa_local_attachment.cjs"),module);
 m.filename=path.join(root,"__qa_local_attachment.cjs");
 m.paths=module.paths;
 m._compile(bundle.outputFiles[0].text,m.filename);
 return m.exports.GET;
}
function makeRequest(){return new Request("http://127.0.0.1:3000/api/messages/attachment?messageId="+msg);}
async function requestAs(handler,client,expectStatus){
 activeClient=client;
 const response=await handler(makeRequest());
 assert.equal(response.status,expectStatus,"Unexpected private attachment GET result");
 assert.equal(response.headers.get("cache-control"),"private, no-store, max-age=0");
 assert.equal(response.headers.get("x-content-type-options"),"nosniff");
 if(expectStatus===200){
  assert.equal(response.headers.get("content-type"),"application/octet-stream");
  assert.match(response.headers.get("content-disposition")||"",/^attachment;/);
  assert.equal(await response.text(),marker);
 }else assert.doesNotMatch(await response.text(),new RegExp(marker));
}
(async()=>{
 globalThis.__qaActualLocalClient=()=>activeClient;
 const handler=await compileRoute();
 const a=await signup("buyer");
 const b=await signup("seller");
 const c=await signup("stranger");
 const filePath=conv+"/"+a.id+"/private.pdf";
 sql("insert into public.conversations(id,buyer_id,seller_id) values ('"+conv+"','"+a.id+"','"+b.id+"')");
 const up=await a.client.storage.from("chat-attachments")
     .upload(filePath,new Blob([marker],{type:"application/pdf"}),{contentType:"application/pdf",upsert:false});
 assert.ifError(up.error);
 sql("insert into public.messages(id,conversation_id,attachment_path,attachment_type) "+
    "values ('"+msg+"','"+conv+"','"+filePath+"','application/pdf')");
 await requestAs(handler,create(),401);
 await requestAs(handler,a.client,200);
 await requestAs(handler,b.client,200);
 await requestAs(handler,c.client,404);
 sql("update public.conversations set buyer_id='"+c.id+"' where id='"+conv+"'");
 await requestAs(handler,a.client,404);
 await requestAs(handler,b.client,200);
 await requestAs(handler,c.client,200);
 activeClient=b.client;
 const malformed=await handler(new Request("http://127.0.0.1/api/messages/attachment?messageId=not-a-uuid"));
 assert.equal(malformed.status,400);
 sql("update public.messages set attachment_path='"+conv+"/"+c.id+"/../unsafe.pdf' where id='"+msg+"'");
 await requestAs(handler,b.client,404);
 console.log("PASS actual Next private GET -> real local Supabase Auth JWT, PostgREST RLS and Storage API: 401 anonymous, 200 both participants, 404 stranger/revoked/bad path.");
 console.log("LIMIT: SSR session/cookies provided by test adapter; complete Next browser E2E not performed. No hosted Supabase.");
})().catch(e=>{console.error("Local real-service private route QA failed:",e.message);process.exitCode=1;});
