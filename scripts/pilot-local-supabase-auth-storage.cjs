#!/usr/bin/env node
"use strict";
// REAL local Supabase Auth / PostgREST RLS / Storage HTTP services.
// Test-only fixture and disposable identities. NO hosted Supabase project.
const assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
const path=require("node:path");

const root=process.cwd();
const modules=process.env.PILOT_QA_MODULES||"/tmp/wetudy-local-supabase-qa/node_modules";
const {createClient}=require(path.join(modules,"@supabase/supabase-js"));
const url=process.env.LOCAL_SUPABASE_URL||"";
const anon=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const pg=process.env.LOCAL_DB_URL||"";
function isLoopback(host){return ["localhost","127.0.0.1","[::1]","::1"].includes(host);}
if(!url||!pg||!anon || !isLoopback(new URL(url).hostname) || !isLoopback(new URL(pg).hostname)){
  throw Error("Refusing to test against any non-local Supabase endpoint or database");
}
if(!url.startsWith("http://"))throw Error("Local Supabase HTTP required");
const schoolA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const schoolB="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const conv="cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function sql(cmd){
  execFileSync("psql",["-X","-v","ON_ERROR_STOP=1",pg,"-c",cmd],{stdio:"pipe",timeout:15000});
}
function validUuid(id){assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8a-f0-9]{4}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);return id;}
function sessionClient(){
  return createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:{"x-wetudy-qa":"ephemeral-local-only"}}});
}
async function signup(label){
  const client=sessionClient();
  const {data:sign,error:signError}=await client.auth.signUp({
    email:"qa-"+label+"@example.invalid",
    password:"Local-QA-"+label+"-Test-2026!aZ6"
  });
  assert.ifError(signError);
  assert.ok(sign.user?.id,"real local Supabase Auth must return user");
  if(!sign.session){
    const {error:loginError}=await client.auth.signInWithPassword({
      email:"qa-"+label+"@example.invalid",
      password:"Local-QA-"+label+"-Test-2026!aZ6"
    });
    assert.ifError(loginError);
  }
  const {data:who,error:whoError}=await client.auth.getUser();
  assert.ifError(whoError);
  assert.equal(who.user?.id,sign.user.id,"real GoTrue JWT sign-in identity matches");
  return {id:validUuid(sign.user.id),client};
}
async function schoolCodes(actor){
  const {data,error}=await actor.client.from("school_access_codes").select("code").order("code");
  assert.ifError(error);return (data||[]).map(x=>x.code);
}
async function roles(actor){
  const {data,error}=await actor.client.from("user_roles").select("role,school_id");
  assert.ifError(error);return data;
}
async function fetchAttachment(actor,filePath,allowed){
  const {data,error}=await actor.client.storage.from("chat-attachments").download(filePath);
  if(allowed){
    assert.ifError(error);assert.ok(data,"participant must download the private file");
    assert.equal(await data.text(),"synthetic local PDF payload");
  }else{
    assert.ok(error||!data,"third party or revoked participant cannot download private attachment");
  }
}
(async()=>{
  const a=await signup("ampa-alfa");
  const b=await signup("ampa-beta");
  const outsider=await signup("visitor");
  sql("insert into public.user_roles (user_id,role,school_id) values "+
      "('"+a.id+"','school_admin','"+schoolA+"'),"+
      "('"+b.id+"','school_admin','"+schoolB+"')");
  sql("insert into public.conversations(id,buyer_id,seller_id) values ('"+conv+"','"+a.id+"','"+b.id+"')");

  assert.deepEqual(await schoolCodes(a),["QA-ALFA-ONLY"]);
  assert.deepEqual(await schoolCodes(b),["QA-BETA-ONLY"]);
  assert.deepEqual(await schoolCodes(outsider),[]);
  assert.equal((await roles(a)).length,1);
  assert.equal((await roles(b)).length,1);
  assert.deepEqual(await roles(outsider),[]);

  const filePath=conv+"/"+a.id+"/synthetic.pdf";
  const file=new Blob(["synthetic local PDF payload"],{type:"application/pdf"});
  const up=await a.client.storage.from("chat-attachments").upload(filePath,file,{
    contentType:"application/pdf",upsert:false
  });
  assert.ifError(up.error);
  await fetchAttachment(a,filePath,true);
  await fetchAttachment(b,filePath,true);
  await fetchAttachment(outsider,filePath,false);
  const badUpload=await outsider.client.storage.from("chat-attachments")
     .upload(conv+"/"+outsider.id+"/denied.pdf",file,{contentType:"application/pdf"});
  assert.ok(badUpload.error,"stranger must not upload to another conversation");

  // DB-level school revocation MUST take effect while the real Auth token is unchanged.
  sql("delete from public.user_roles where user_id='"+a.id+"' and role='school_admin'");
  assert.deepEqual(await schoolCodes(a),[],"same real JWT immediately loses school access");
  assert.deepEqual(await roles(a),[]);
  assert.deepEqual(await schoolCodes(b),["QA-BETA-ONLY"]);

  // Conversation membership is separate from AMPA role.
  // Remove A from chat in database while retaining A's valid access token.
  sql("update public.conversations set buyer_id='"+outsider.id+"' where id='"+conv+"'");
  await fetchAttachment(a,filePath,false);
  await fetchAttachment(b,filePath,true);
  await fetchAttachment(outsider,filePath,true);

  // Private Storage must not permit anonymous readers, even for a guessed exact path.
  const anonymous=sessionClient();
  await fetchAttachment({client:anonymous},filePath,false);
  console.log("PASS local Supabase Auth + PostgREST RLS + Storage: 3 real JWT sessions, 2 schools, third-party denial, immediate school-role revocation, private attachment revocation.");
  console.log("LIMIT: local Supabase service fixture, NOT the real Next SSR browser or full production schema. No hosted project/network credentials.");
})().catch(e=>{console.error("Local Supabase integration QA failed:",e.message);process.exitCode=1;});
