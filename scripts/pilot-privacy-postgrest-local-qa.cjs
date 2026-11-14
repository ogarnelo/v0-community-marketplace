#!/usr/bin/env node
"use strict";
// Authenticated and anonymous HTTP PostgREST verification against disposable
// Supabase CLI localhost. Never use a hosted URL or print JWTs/API keys.
const assert = require("node:assert/strict");
const path=require("node:path");
const mods=process.env.PILOT_AMPA_NEXT_MODULES||"/tmp/wetudy-ampa-next-local/node_modules";
const {createClient}=require(path.join(mods,"@supabase/supabase-js"));
const api=process.env.LOCAL_SUPABASE_URL||"";
const anon=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const service=process.env.LOCAL_SUPABASE_SERVICE_KEY||"";
const u=api?new URL(api):null;
if(!u||u.protocol!=="http:"||!["localhost","127.0.0.1","::1"].includes(u.hostname)||
   !anon||!service) throw Error("Refusing nonlocal or missing Supabase QA credentials");
const client=(key)=>createClient(api,key,{auth:{
 persistSession:false,autoRefreshToken:false,detectSessionInUrl:false
}});
async function ready(){
 const c=client(service);
 for(let i=0;i<24;i++){
  const {error}=await c.from("listings").select("id").limit(1);
  if(!error)return;
  await new Promise(r=>setTimeout(r,250));
 }
 throw Error("Local PostgREST schema not available");
}
function denied(error,label){
 assert.ok(error,label+": expected PostgREST refusal");
 assert.ok(error.code==="42501"||/permission denied/i.test(error.message),
  label+": must fail because of privileges, not unrelated schema/auth error");
}
(async()=>{
 await ready();
 const guest=client(anon),admin=client(service),user=client(anon);
 const email="qa-privacy-postgrest-"+process.pid+"@example.invalid";
 const password="QA-PostgREST-2026-Test!X39";
 const {error:signUpError}=await user.auth.signUp({email,password});
 assert.ifError(signUpError);
 const {data:login,error:signInError}=await user.auth.signInWithPassword({email,password});
 assert.ifError(signInError);
 assert.ok(login.session?.access_token);

 let r=await guest.from("listings").select("id").limit(1);
 denied(r.error,"anonymous direct listing SELECT");
 r=await guest.from("listing_photos").select("id,listing_id");
 denied(r.error,"anonymous photos require revoked listings SELECT through RLS");
 r=await user.from("listings").select("id,title,status").order("id");
 assert.ifError(r.error);
 assert.equal(r.data.length,3,"only three available synthetic listings");
 assert.ok(r.data.every(x=>x.status==="available"));

 for(const cols of ["postal_code","lat","lng","*"]){
  r=await user.from("listings").select(cols);
  denied(r.error,"authenticated sensitive columns: "+cols);
 }
 r=await user.from("listing_photos").select("id,listing_id");
 assert.ifError(r.error);
 assert.equal(r.data.length,1,"authenticated column-scoped listing ID enables photo RLS");

 r=await admin.from("listings").select("id,status,postal_code,lat,lng").order("id");
 assert.ifError(r.error);
 assert.equal(r.data.length,4,"service_role sees three available and one archived QA row");
 assert.ok(r.data.some(x=>x.status==="archived"));
 assert.ok(r.data.every(x=>x.postal_code));
 r=await admin.from("listing_photos").select("id,listing_id");
 assert.ifError(r.error);
 assert.equal(r.data.length,1);

 // Actual authenticated owner INSERT/UPDATE after SELECT is column-restricted.
 const ownId="88888888-8888-4888-8888-888888888881";
 r=await user.from("listings").insert({
   id:ownId,title:"Synthetic owned listing",status:"available",seller_id:login.user.id
 }).select("id,title,status");
 assert.ifError(r.error);
 assert.equal(r.data?.[0]?.id,ownId);
 r=await user.from("listings").update({title:"Synthetic listing edited"})
   .eq("id",ownId).eq("seller_id",login.user.id).select("id,title");
 assert.ifError(r.error);
 assert.equal(r.data?.[0]?.title,"Synthetic listing edited");
 r=await user.from("listings").update({postal_code:"28099"}).eq("id",ownId);
 denied(r.error,"authenticated cannot rewrite CP via a restricted update grant");

 // Even with a valid account, a non-owner cannot edit another user's listing.
 const outsider=client(anon);
 const otherEmail="qa-postgrest-outsider-"+process.pid+"@example.invalid";
 const {error:otherSignUp}=await outsider.auth.signUp({
   email:otherEmail,password:"QA-PostgREST-2026-Safe!X39"
 });
 assert.ifError(otherSignUp);
 const {error:otherLogin}=await outsider.auth.signInWithPassword({
   email:otherEmail,password:"QA-PostgREST-2026-Safe!X39"
 });
 assert.ifError(otherLogin);
 r=await outsider.from("listings").update({title:"Unauthorized overwrite"})
   .eq("id",ownId).select("id,title");
 assert.ifError(r.error);
 assert.equal(r.data?.length||0,0,"RLS must block non-owner updates");
 r=await admin.from("listings").select("id,title").eq("id",ownId).single();
 assert.ifError(r.error);
 assert.equal(r.data.title,"Synthetic listing edited");
 console.log("PASS local PostgREST owner INSERT/UPDATE, non-owner denied and location UPDATE denied.");

 console.log("PASS real local PostgREST: anon listings/photos denied; authenticated 3 available rows, 1 photo, exact location and wildcard denied; server 4 baseline rows.");

 console.log("Synthetic identities and photos only; hosted Supabase not contacted. Production privileges untouched.");
})().catch(e=>{console.error("Local PostgREST privacy test failed:",e.message);process.exitCode=1});
