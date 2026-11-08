#!/usr/bin/env node
"use strict";
// Compiles and executes the REAL Next route with a synthetic Supabase adapter.
// This is an HTTP-handler integration test (not live Supabase/Auth or browser E2E).
const assert = require("node:assert/strict");
const path = require("node:path");
const root = process.cwd();
const { build } = require(path.join(process.env.PILOT_QA_MODULES || "/tmp/wetudy-private-chat-qa/node_modules","esbuild"));

const BUYER = "11111111-1111-4111-8111-111111111111";
const SELLER = "22222222-2222-4222-8222-222222222222";
const STRANGER = "33333333-3333-4333-8333-333333333333";
const CONVERSATION = "44444444-4444-4444-8444-444444444444";
const MESSAGE = "55555555-5555-4555-8555-555555555555";
const FILE_PATH = CONVERSATION + "/" + BUYER + "/test.pdf";

const state = {actor:null, buyer:BUYER, seller:SELLER, filePath:FILE_PATH};
let storageDownloads = 0;
const isParticipant=()=>state.actor!==null && [state.buyer,state.seller].includes(state.actor);
function fakeQuery(table) {
  const filters = {};
  const builder = {
    select(){return builder;},
    eq(key,value){filters[key]=value;return builder;},
    async maybeSingle() {
      if(!isParticipant())return {data:null,error:null};
      if(table==="messages" && filters.id===MESSAGE) {
        return {data:{id:MESSAGE,conversation_id:CONVERSATION,attachment_path:state.filePath,attachment_type:"application/pdf"},error:null};
      }
      if(table==="conversations" && filters.id===CONVERSATION) {
        return {data:{id:CONVERSATION,buyer_id:state.buyer,seller_id:state.seller},error:null};
      }
      return {data:null,error:null};
    }
  };
  return builder;
}
globalThis.__qaCreateClient = async () => ({
  auth:{getUser:async()=>({data:{user: state.actor? {id:state.actor} : null},error:null})},
  from:fakeQuery,
  storage:{from:(bucket)=>({
    download:async(path)=>{
      storageDownloads++;
      if(bucket!=="chat-attachments" || path!==FILE_PATH || !isParticipant())return {data:null,error:{message:"forbidden"}};
      return {data:new Blob(["SYNTHETIC-PRIVATE-ATTACHMENT"],{type:"application/pdf"}),error:null};
    }
  })}
});

(async()=>{
  const result=await build({
    entryPoints:["app/api/messages/attachment/route.ts"],absWorkingDir:root,
    bundle:true,write:false,platform:"node",format:"cjs",target:"node22",
    plugins:[{
      name:"synthetic-dependencies",
      setup(build){
        build.onResolve({filter:/^next\/server$/},()=>({path:"next/server",namespace:"qa"}));
        build.onResolve({filter:/^@\/lib\/supabase\/server$/},()=>({path:"supabase",namespace:"qa"}));
        build.onResolve({filter:/^@\/lib\/messages\/private-attachment-guards\.mjs$/},
          ()=>({path:path.join(root,"lib/messages/private-attachment-guards.mjs")}));
        build.onLoad({filter:/.*/,namespace:"qa"},({path})=>({
          loader:"js",
          contents:path==="supabase"
            ? 'export async function createClient(){return globalThis.__qaCreateClient();}'
            : 'export const NextResponse={json:(data,options={})=>new Response(JSON.stringify(data),{status:options.status||200,headers:{"Content-Type":"application/json",...(options.headers||{})}})};'
        }));
      }
    }]
  });
  const Module=require("node:module");
  const moduleObject=new Module(path.join(root,"__qa_private_chat_route.cjs"),module);
  moduleObject.filename=path.join(root,"__qa_private_chat_route.cjs");
  moduleObject.paths=module.paths;
  moduleObject._compile(result.outputFiles[0].text,moduleObject.filename);
  const {GET}=moduleObject.exports;

  async function check(actor,id,expected) {
    state.actor=actor;
    const url="http://127.0.0.1:3000/api/messages/attachment?messageId="+encodeURIComponent(id);
    const response=await GET(new Request(url));
    assert.equal(response.status,expected,actor || "guest");
    assert.equal(response.headers.get("cache-control"),"private, no-store, max-age=0");
    if(expected===200){
      assert.equal(response.headers.get("content-type"),"application/octet-stream");
      assert.match(response.headers.get("content-disposition")||"",/^attachment;/);
      assert.equal(await response.text(),"SYNTHETIC-PRIVATE-ATTACHMENT");
    }else{
      assert.doesNotMatch(await response.text(),/SYNTHETIC-PRIVATE-ATTACHMENT/);
    }
  }
  await check(null,MESSAGE,401);
  await check(BUYER,"bad-id",400);
  await check(BUYER,MESSAGE,200);
  await check(SELLER,MESSAGE,200);
  await check(STRANGER,MESSAGE,404);
  const previousDownloads=storageDownloads;
  assert.equal(previousDownloads,2,"stranger must be rejected before Storage");
  state.buyer=null; // emulate immediate removal of a user's participation
  await check(BUYER,MESSAGE,404);
  await check(SELLER,MESSAGE,200);
  state.filePath=CONVERSATION+"/"+STRANGER+"/../malicious.pdf";
  await check(SELLER,MESSAGE,404);
  assert.equal(storageDownloads,3,"invalid path must be denied before Storage");
  console.log("PASS actual Next attachment route: guest 401, invalid 400, both participants 200, stranger/revoked/path 404.");
  console.log("LIMIT: Supabase Auth and Storage are synthetic adapters; no production traffic or real signed URL used.");
})().catch(error=>{console.error(error);process.exitCode=1;});
