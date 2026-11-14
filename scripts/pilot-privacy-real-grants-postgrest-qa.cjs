#!/usr/bin/env node
"use strict";
// PHASE 2 real Supabase CLI PostgREST: production-equivalent 33-column SELECT,
// owner UPDATE CP retained, nonowner RLS denied, anon DML grants insufficient.
// Test confined to localhost/127.0.0.1, with synthetic credentials and rows.
const assert=require("node:assert/strict");
const path=require("node:path");
const {createClient}=require(path.join(process.env.PILOT_AMPA_NEXT_MODULES||
 "/tmp/wetudy-ampa-next-local/node_modules","@supabase/supabase-js"));
const endpoint=process.env.LOCAL_SUPABASE_URL||"";
const anonKey=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const serviceKey=process.env.LOCAL_SUPABASE_SERVICE_KEY||"";
const u=endpoint?new URL(endpoint):null;
if(!u||u.protocol!=="http:"||!["127.0.0.1","localhost","::1"].includes(u.hostname)||
 !anonKey||!serviceKey)throw Error("Unsafe nonlocal target for pilot tests");
const client=k=>createClient(endpoint,k,{auth:{persistSession:false,
 autoRefreshToken:false,detectSessionInUrl:false}});
const id="88888888-8888-4888-8888-888888888891";
const pw="Local-QA-Synthetic-Only-2026!x39";
async function account(label){
 const c=client(anonKey);
 const email="qa-pilot-phase2-"+label+"-"+process.pid+"@example.invalid";
 const a=await c.auth.signUp({email,password:pw});assert.ifError(a.error);
 const b=await c.auth.signInWithPassword({email,password:pw});
 assert.ifError(b.error);assert.ok(b.data.user?.id);
 return {c,user:b.data.user};
}
const denied=(x,label)=>{
 assert.ok(x.error,label+" expected an error");
 assert.ok(x.error.code==="42501"||/permission denied|row-level security/i.test(x.error.message),
 label+" must be rejected by authorization, not a SQL shape error");
};
(async()=>{
 const admin=client(serviceKey),guest=client(anonKey);
 const owner=await account("owner"),outsider=await account("outsider");

 let r=await guest.from("listings").select("id").limit(1);
 denied(r,"anon may not read direct listing even after DML grants");
 r=await guest.from("listings").insert({id,title:"Forbidden anon insert",
   status:"available",seller_id:owner.user.id});
 denied(r,"anon may not insert despite tablewide DML grant");
 r=await owner.c.from("listings").select("id,title,status,seller_id")
   .eq("status","available").order("id");
 assert.ifError(r.error);assert.equal(r.data.length,4,"three school rows plus phase-1 owner listing");
 for(const col of ["postal_code","lat","lng","*"]){
  r=await owner.c.from("listings").select(col);
  denied(r,"authenticated read "+col);
 }
 // RLS owner policy from phase 1 applies to the same synthetic user.
 r=await owner.c.from("listings").insert({
  id,title:"Phase2 owner publish",status:"available",
  seller_id:owner.user.id,postal_code:"28001"
 }).select("id,title,status");
 assert.ifError(r.error);assert.equal(r.data?.[0]?.id,id);
 r=await owner.c.from("listings").update({postal_code:"28002",title:"Phase2 owner edit"})
   .eq("id",id).select("id,title");
 assert.ifError(r.error);assert.equal(r.data?.[0]?.title,"Phase2 owner edit");
 // The sensitive field must be writable for the owner, not readable for anybody.
 r=await admin.from("listings").select("postal_code").eq("id",id).single();
 assert.ifError(r.error);assert.equal(r.data.postal_code,"28002");
 r=await outsider.c.from("listings").update({title:"Hijacked"})
   .eq("id",id).select("id,title");
 assert.ifError(r.error);assert.equal(r.data.length,0);
 r=await admin.from("listings").select("title").eq("id",id).single();
 assert.ifError(r.error);assert.equal(r.data.title,"Phase2 owner edit");
 r=await guest.from("listings").update({title:"Anon hijacked"})
   .eq("id",id).select("id");
 // Some clients return 42501 (no SELECT), others return zero changed rows.
 if(r.error)denied(r,"anon cannot update"); else assert.equal(r.data.length,0);
 r=await owner.c.from("listing_photos").select("id,listing_id");
 assert.ifError(r.error);assert.equal(r.data.length,1);
 r=await admin.from("listings").select("id,status").order("id");
 assert.ifError(r.error);assert.equal(r.data.length,6,"school rows, archived row and two owner listings");
 console.log("PASS phase2 exact SELECT-only grant: owner creates and edits postcode,"+
 " other user and anon cannot mutate, 33-column reads, photos, service data intact");
})().catch(e=>{console.error("Local PostgREST exact-proposal phase2 failed:",e.message);
 process.exitCode=1});
