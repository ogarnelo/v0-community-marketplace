#!/usr/bin/env node
"use strict";
// Real Supabase localhost Auth + PostgREST RLS + private Storage loss/recovery
// test; all identities and blobs are synthetic. NEVER use hosted Supabase.
// File backup is temporary and removed immediately. The archive captures
// data-only auth.users/auth.identities/public.user_roles/public.conversations;
// object bytes are backed up/re-uploaded via the REAL Storage API.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const {execFileSync}=require("node:child_process");
const mod=process.env.PILOT_QA_MODULES||"/tmp/wetudy-local-supabase-qa/node_modules";
const {createClient}=require(path.join(mod,"@supabase/supabase-js"));
const api=process.env.LOCAL_SUPABASE_URL||"";
const anon=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const service=process.env.LOCAL_SUPABASE_SERVICE_KEY||"";
const db=process.env.LOCAL_DB_URL||"";
const local=h=>["localhost","127.0.0.1","[::1]","::1"].includes(h);
if(!api.startsWith("http://")||!service||!anon||!db||
   !local(new URL(api).hostname)||!local(new URL(db).hostname)){
 throw Error("DISASTER-RECOVERY QA refuses any nonlocal Supabase endpoint or DB");
}
const cli=(cmd,args,encoding)=>execFileSync(cmd,args,{encoding,timeout:60000,
 stdio:["ignore","pipe","pipe"],maxBuffer:12_000_000});
const sql=q=>cli("psql",["-X","-A","-t","-v","ON_ERROR_STOP=1",db,"-c",q],"utf8").trim();
const client=(key)=>createClient(api,key,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const svc=client(service);
const hash=buf=>crypto.createHash("sha256").update(buf).digest("hex");
const folder=fs.mkdtempSync(path.join(os.tmpdir(),"wetudy-local-dr-"));
const backup=path.join(folder,"synthetic-auth-and-public.dump");
(async()=>{
 try{
  // This test MUST be run after the existing local Auth/Storage QA script,
  // in a stack initialized from empty CLI fixture. Validate all identities
  // are synthetic before any destructive action.
  const {data:all,error:listError}=await svc.auth.admin.listUsers({page:1,perPage:100});
  assert.ifError(listError);
  const users=all?.users||[];
  assert.ok(users.length>=4 && users.length<=12,"Unexpected local user count");
  for(const u of users){
   assert.ok(u.email?.endsWith("@example.invalid"),"Refuse non-QA identity");
  }
  const beta=users.find(u=>u.email==="qa-ampa-beta@example.invalid");
  assert.ok(beta,"Expected previously-created synthetic BETA identity");
  const objects=sql("select name from storage.objects where bucket_id='chat-attachments' order by name")
   .split("\n").filter(Boolean);
  assert.ok(objects.length>=1&&objects.length<=6,"Unexpected synthetic Storage inventory");
  for(const name of objects){
   assert.match(name,/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-z0-9_.-]+$/i);
  }
  // Backup bytes with real private Storage service, check their hashes.
  const preserved=[];
  for(const name of objects){
   const {data,error}=await svc.storage.from("chat-attachments").download(name);
   assert.ifError(error);
   const bytes=Buffer.from(await data.arrayBuffer());
   preserved.push({name,bytes,sha:hash(bytes)});
  }

  // Data-only custom archive includes GoTrue hashed credentials/identities
  // and application role/conversation relationships, not service secrets.
  cli("pg_dump",["-Fc","--data-only","--no-owner","--no-acl",
    "--table=auth.users","--table=auth.identities",
    "--table=public.user_roles","--table=public.conversations",
    "--file="+backup,db]);
  fs.chmodSync(backup,0o600);
  const digest=hash(fs.readFileSync(backup));
  assert.ok(fs.statSync(backup).size>1000);

  // Simulated TOTAL local fixture loss: physically delete private blob via
  // Storage API, delete all synthetic GoTrue users, and truncate associations.
  const delObjects=await svc.storage.from("chat-attachments").remove(objects);
  assert.ifError(delObjects.error);
  const remaining=sql("select count(*) from storage.objects where bucket_id='chat-attachments'");
  assert.equal(remaining,"0");
  for(const u of users){
   const {error}=await svc.auth.admin.deleteUser(u.id);
   assert.ifError(error);
  }
  sql("truncate table public.user_roles,public.conversations;");
  assert.equal(sql("select count(*) from auth.users"),"0");
  assert.equal(sql("select count(*) from public.user_roles"),"0");
  // Existing login with known synthetic password MUST now fail.
  const invalid=await client(anon).auth.signInWithPassword({
   email:"qa-ampa-beta@example.invalid",password:"Local-QA-ampa-beta-Test-2026!aZ6"
  });
  assert.ok(invalid.error,"Destruction must invalidate login");

  // Restore the exact archive into the SAME disposable local Supabase stack,
  // where the schema, triggers and server services already exist. PostgreSQL
  // superuser restores Auth and public associations without RLS grants changes.
  cli("pg_restore",["--data-only","--disable-triggers","--no-owner","--no-acl",
    "--exit-on-error","--dbname="+db,backup]);
  assert.equal(hash(fs.readFileSync(backup)),digest);
  assert.equal(sql("select count(*) from auth.users"),String(users.length));
  // Real Storage API writes back both the metadata and physical object bytes.
  for(const entry of preserved){
   const {error}=await svc.storage.from("chat-attachments").upload(
    entry.name,new Blob([entry.bytes],{type:"application/pdf"}),
    {contentType:"application/pdf",upsert:false});
   assert.ifError(error);
  }
  assert.equal(sql("select count(*) from storage.objects where bucket_id='chat-attachments'"),
    String(objects.length));

  const session=client(anon);
  const {data:logged,error:loginError}=await session.auth.signInWithPassword({
   email:"qa-ampa-beta@example.invalid",password:"Local-QA-ampa-beta-Test-2026!aZ6"
  });
  assert.ifError(loginError);
  assert.equal(logged.user?.id,beta.id,"GoTrue identity UUID must survive restore");
  const {data:roleRows,error:roleError}=await session.from("user_roles")
     .select("role,school_id");
  assert.ifError(roleError);
  assert.deepEqual(roleRows?.map(x=>x.role),["school_admin"]);
  const {data:codes,error:codesError}=await session.from("school_access_codes")
    .select("code").order("code");
  assert.ifError(codesError);
  assert.deepEqual(codes.map(x=>x.code),["QA-BETA-ONLY"]);

  // BETA is a participant of the restored conversation. Exact original
  // private attachment bytes must be readable by BETA but not by a stranger.
  const target=preserved[0];
  const {data:blob,error:downloadError}=await session.storage.from("chat-attachments")
     .download(target.name);
  assert.ifError(downloadError);
  assert.equal(hash(Buffer.from(await blob.arrayBuffer())),target.sha);
  const anonymous=await client(anon).storage.from("chat-attachments").download(target.name);
  assert.ok(anonymous.error||!anonymous.data,"Anonymous must still be denied");
  // Verify restored RLS using a third QA actor whose role was revoked.
  const outsider=client(anon);
  const outsideLogin=await outsider.auth.signInWithPassword({
   email:"qa-visitor@example.invalid",
   password:"Local-QA-visitor-Test-2026!aZ6"
  });
  assert.ifError(outsideLogin.error);
  const unauthorized=await outsider.storage.from("chat-attachments").download(target.name);
  assert.ok(unauthorized.error||!unauthorized.data,"Nonparticipant must remain denied");

  console.log("PASS local Supabase Auth+RLS+Storage disaster-recovery rehearsal: GoTrue user IDs, password login, school role/codes, conversation, original object SHA-256 and third-party denial recovered.");
  console.log("DATA: "+users.length+" synthetic users; "+preserved.length+" private synthetic object(s); pg_dump archive checksum preserved.");
  console.log("LIMIT: destructive restore on an ephemeral LOCAL Supabase stack with schema already initialized, NOT a production backup, not migration from scratch, and not whole-app disaster recovery.");
 }finally{
  fs.rmSync(folder,{recursive:true,force:true});
 }
})().catch(e=>{console.error("LOCAL DR QA FAILED:",e.message);process.exitCode=1;});
