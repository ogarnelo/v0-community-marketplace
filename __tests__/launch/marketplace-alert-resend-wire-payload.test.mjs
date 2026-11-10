import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareResendWirePayload, sendPreparedResendPayload } from "../../lib/marketplace/alert-resend-wire-payload.mjs";
import { hashProviderPayload } from "../../lib/marketplace/alert-email-intent-delivery.mjs";
const fixture={from:"Wetudy <test@example.invalid>",to:"receiver@example.invalid",
 subject:"Nuevo anuncio",html:"<h1>Título inicial</h1>",text:"Título inicial"};
const key="saved-search-match/qa-match";
test("canonical bytes match historical brandedEmail JSON request shape",()=>{
 const body=prepareResendWirePayload(fixture);
 const legacy=JSON.stringify({
   from:fixture.from,to:[fixture.to],subject:fixture.subject,
   html:fixture.html,text:fixture.text,attachments:undefined,
 });
 assert.equal(body,legacy);
 assert.equal(body.includes("attachments"),false);
 assert.match(hashProviderPayload(body),/^[a-f0-9]{64}$/);
});
test("attachments use existing content_type mapping, not contentType",()=>{
 const body=prepareResendWirePayload({...fixture,attachments:[
   {filename:"qa.txt",content:"dGVzdA==",contentType:"text/plain"}]});
 assert.deepEqual(JSON.parse(body).attachments,[{
   filename:"qa.txt",content:"dGVzdA==",content_type:"text/plain"}]);
});
test("mutating listing-derived subject or HTML changes the reserved payload hash",()=>{
 const fixed=prepareResendWirePayload(fixture);
 const changed=prepareResendWirePayload({...fixture,subject:"Nuevo título",html:"<h1>Nuevo título</h1>"});
 assert.notEqual(hashProviderPayload(fixed),hashProviderPayload(changed));
});
test("prepared transport sends exactly reserved bytes and same event key",async()=>{
 const requestBody=prepareResendWirePayload(fixture);
 let networkCalls=0;
 const sent=await sendPreparedResendPayload({
   requestBody,eventKey:key,apiKey:"synthetic-qa-token",
   fetchImpl:async(url,options)=>{
     networkCalls++;
     assert.equal(url,"https://api.resend.com/emails");
     assert.equal(options.body,requestBody);
     assert.equal(options.headers["Idempotency-Key"],key);
     assert.equal(options.method,"POST");
     assert.equal(options.headers.Authorization,"Bearer synthetic-qa-token");
     return {ok:true,json:async()=>({id:"synthetic-receipt"})};
   },
 });
 assert.deepEqual(sent,{id:"synthetic-receipt"});
 assert.equal(networkCalls,1);
});
test("transport rejects failures without logging provider body",async()=>{
 const requestBody=prepareResendWirePayload(fixture);
 await assert.rejects(sendPreparedResendPayload({
   requestBody,eventKey:key,apiKey:"synthetic-token",
   fetchImpl:async()=>({ok:false,status:409,json:async()=>({error:"private"})}),
 }),/resend_delivery_failure/);
 await assert.rejects(sendPreparedResendPayload({
   requestBody,eventKey:key,apiKey:"synthetic-token",
   fetchImpl:async()=>({ok:true,json:async()=>({})}),
 }),/resend_receipt_missing/);
});
test("invalid or incomplete provider request fails before network access",async()=>{
 assert.throws(()=>prepareResendWirePayload({...fixture,to:""}),TypeError);
 assert.throws(()=>prepareResendWirePayload({...fixture,attachments:"bad"}),TypeError);
 let calls=0;
 await assert.rejects(sendPreparedResendPayload({
   requestBody:"",eventKey:key,apiKey:"qa",fetchImpl:async()=>{calls++;return {ok:true};}
 }),TypeError);
 assert.equal(calls,0);
});
test("isolated code does not change live sender; future integration must use one serialized body",()=>{
 const brand=readFileSync("lib/emails/brand.ts","utf8");
 const route=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
 assert.match(brand,/const response = await fetch\(RESEND_API_URL/);
 assert.match(brand,/attachments: params\.attachments\?\.map/);
 assert.doesNotMatch(route,/alert-resend-wire-payload/);
 assert.doesNotMatch(route,/alert-email-intent-delivery/);
});
