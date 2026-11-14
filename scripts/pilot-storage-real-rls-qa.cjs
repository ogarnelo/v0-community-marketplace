#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const path=require("node:path");
const crypto=require("node:crypto");
const {createClient}=require(path.join(process.env.PILOT_AMPA_NEXT_MODULES||
 "/tmp/wetudy-ampa-next-local/node_modules","@supabase/supabase-js"));
const endpoint=process.env.LOCAL_SUPABASE_URL||"";
const anonKey=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const serviceKey=process.env.LOCAL_SUPABASE_SERVICE_KEY||"";
const target=endpoint?new URL(endpoint):null;
if(!target||target.protocol!=="http:"||
 !["localhost","127.0.0.1","::1"].includes(target.hostname)||
 !anonKey||!serviceKey)throw Error("Refusing nonlocal Storage integration target");
const client=k=>createClient(endpoint,k,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const bucket="wetudy-pilot-qa-private",pw="QA-Local-Storage-Safe!X39";
async function account(label){
 const c=client(anonKey);
 const email="qa-storage-"+label+"-"+process.pid+"@example.invalid";
 let r=await c.auth.signUp({email,password:pw});assert.ifError(r.error);
 r=await c.auth.signInWithPassword({email,password:pw});
 assert.ifError(r.error);assert.ok(r.data.user?.id);
 return {c,id:r.data.user.id};
}
function sha(bytes){return crypto.createHash("sha256").update(bytes).digest("hex")}
(async()=>{
 const owner=await account("owner"),outsider=await account("outsider");
 const admin=client(serviceKey);
 const objectName="qa/"+owner.id+"/synthetic-file.txt";
 const contents=Buffer.from("WETUDY synthetic Storage RLS fixture, no user content.\n");
 let r=await owner.c.storage.from(bucket).upload(objectName,contents,{
   contentType:"text/plain",upsert:false
 });
 assert.ifError(r.error);
 r=await owner.c.storage.from(bucket).download(objectName);
 assert.ifError(r.error);
 assert.equal(sha(Buffer.from(await r.data.arrayBuffer())),sha(contents),
   "Authenticated owner received different object bytes");
 r=await outsider.c.storage.from(bucket).download(objectName);
 assert.ok(r.error,"Another authenticated user must not download owner object");
 r=await outsider.c.storage.from(bucket).list("qa/"+owner.id);
 assert.ifError(r.error);
 assert.equal(r.data?.length||0,0,"Other account must not list owner objects");
 r=await admin.storage.from(bucket).download(objectName);
 assert.ifError(r.error);
 assert.equal(sha(Buffer.from(await r.data.arrayBuffer())),sha(contents),
   "Storage admin backup bytes must match owner original");
 r=await owner.c.storage.from(bucket).remove([objectName]);
 assert.ifError(r.error);
 r=await admin.storage.from(bucket).list("qa/"+owner.id);
 assert.ifError(r.error);
 assert.equal(r.data?.length||0,0,"Owner delete must remove synthetic object");
 console.log("PASS real local Supabase Storage: private upload/download SHA256, outsider download/list denied, admin recoverable bytes, owner cleanup");
})().catch(e=>{console.error("Local Storage RLS test failed:",e.message);process.exitCode=1});
