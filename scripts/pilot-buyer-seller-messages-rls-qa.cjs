#!/usr/bin/env node
"use strict";
// Synthetic authenticated buyer/seller/third-party messaging via real
// Supabase CLI GoTrue + PostgREST + RLS, with no hosted accounts or emails.
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");
const modules=process.env.PILOT_AMPA_NEXT_MODULES||
  "/tmp/wetudy-ampa-next-local/node_modules";
const {createClient}=require(path.join(modules,"@supabase/supabase-js"));
const api=process.env.LOCAL_SUPABASE_URL||"";
const anon=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const server=process.env.LOCAL_SUPABASE_SERVICE_KEY||"";
const parsed=api?new URL(api):null;
if(!parsed||parsed.protocol!=="http:"||
 !["localhost","127.0.0.1","::1"].includes(parsed.hostname)||
 !anon||!server)throw Error("Refusing hosted/nonlocal QA service or missing synthetic key");
const client=k=>createClient(api,k,{auth:{persistSession:false,
 autoRefreshToken:false,detectSessionInUrl:false}});
async function account(label){
 const c=client(anon);
 const email="qa-local-chat-"+label+"-"+process.pid+"@example.invalid";
 const password="QA-Local-Chat-Only-2026!x39";
 const a=await c.auth.signUp({email,password});assert.ifError(a.error);
 const b=await c.auth.signInWithPassword({email,password});assert.ifError(b.error);
 assert.ok(b.data?.user?.id,"Expected isolated GoTrue account");
 return {c,id:b.data.user.id};
}
(async()=>{
 const seller=await account("seller");
 const buyer=await account("buyer");
 const outsider=await account("outsider");
 const guest=client(anon);
 const admin=client(server);
 const conversationId=crypto.randomUUID();
 const listingId=crypto.randomUUID();
 const schoolId=crypto.randomUUID();

 let r=await admin.from("qa_pilot_conversations").insert({
  id:conversationId,listing_id:listingId,buyer_id:buyer.id,
  seller_id:seller.id,school_id:schoolId}).select("id").single();
 assert.ifError(r.error);assert.equal(r.data.id,conversationId);

 for(const participant of [buyer,seller]){
  r=await participant.c.from("qa_pilot_conversations")
   .select("id,listing_id").eq("id",conversationId);
  assert.ifError(r.error);assert.equal(r.data.length,1);
 }
 for(const nonmember of [outsider.c,guest]){
  r=await nonmember.from("qa_pilot_conversations")
   .select("id").eq("id",conversationId);
  if(r.error)assert.equal(r.error.code,"42501");
  else assert.equal(r.data.length,0);
 }

 r=await buyer.c.from("qa_pilot_messages")
  .insert({conversation_id:conversationId,sender_id:buyer.id,body:"QA pregunta"})
  .select("id,body").single();
 assert.ifError(r.error);assert.equal(r.data.body,"QA pregunta");
 r=await seller.c.from("qa_pilot_messages")
  .insert({conversation_id:conversationId,sender_id:seller.id,body:"QA respuesta"})
  .select("id,body").single();
 assert.ifError(r.error);assert.equal(r.data.body,"QA respuesta");

 for(const participant of [buyer,seller]){
  r=await participant.c.from("qa_pilot_messages")
   .select("id,body,sender_id").eq("conversation_id",conversationId);
  assert.ifError(r.error);assert.equal(r.data.length,2);
 }
 for(const nonmember of [outsider.c,guest]){
  r=await nonmember.from("qa_pilot_messages")
   .select("id,body").eq("conversation_id",conversationId);
  if(r.error)assert.equal(r.error.code,"42501");
  else assert.equal(r.data.length,0);
 }
 // RLS must reject a third party attempting an INSERT, even though
 // authenticated users have a table-level INSERT grant.
 r=await outsider.c.from("qa_pilot_messages")
  .insert({conversation_id:conversationId,sender_id:outsider.id,body:"QA intrusion"});
 assert.ok(r.error,"Third-party INSERT should fail RLS");
 r=await buyer.c.from("qa_pilot_messages")
  .insert({conversation_id:conversationId,sender_id:seller.id,body:"QA spoof"});
 assert.ok(r.error,"Buyer must not impersonate seller");
 r=await guest.from("qa_pilot_messages")
  .insert({conversation_id:conversationId,sender_id:buyer.id,body:"QA guest"});
 assert.ok(r.error,"Anonymous message INSERT must fail");

 // Server is able to recover records; unprivileged viewers cannot.
 r=await admin.from("qa_pilot_messages")
  .select("id,body").eq("conversation_id",conversationId);
 assert.ifError(r.error);assert.equal(r.data.length,2);
 console.log("PASS local GoTrue/PostgREST chat: buyer+seller two messages, outsider and anon blind/denied, sender spoof rejected");
 console.log("Synthetic qa_pilot_* tables only: NOT production chat flow, notification, agreements or 3-AMPA acceptance.");
})().catch(e=>{console.error("Local buyer-seller RLS QA failed:",e.message);
 process.exitCode=1});
