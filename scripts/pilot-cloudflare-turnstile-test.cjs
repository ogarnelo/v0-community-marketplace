#!/usr/bin/env node
"use strict";
/**
 * Live Cloudflare Siteverify CONTRACT using its publicly documented DUMMY keys.
 * No real users, keys, hosted secrets, or production traffic.
 * Never substitute these test credentials in Wetudy production.
 */
const assert=require("node:assert/strict");
const ENDPOINT="https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DUMMY="XXXX.DUMMY.TOKEN.XXXX";
const cases=[
  {name:"official dummy success",secret:"1x0000000000000000000000000000000AA",success:true},
  {name:"official dummy failure",secret:"2x0000000000000000000000000000000AA",success:false},
  {name:"official duplicate-token failure",secret:"3x0000000000000000000000000000000AA",success:false,
   errorCode:"timeout-or-duplicate"}
];
async function verify(test){
  const response=await fetch(ENDPOINT,{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({secret:test.secret,response:DUMMY}),
    signal:AbortSignal.timeout(15000)
  });
  assert.equal(response.status,200,"Unexpected Cloudflare Siteverify status");
  const payload=await response.json();
  assert.equal(payload.success,test.success,"Turnstile dummy contract mismatch for "+test.name);
  if(test.errorCode)assert.ok(Array.isArray(payload["error-codes"])&&
    payload["error-codes"].includes(test.errorCode),"Missing expected failure code");
  console.log("PASS "+test.name+": provider validates the published dummy token as expected.");
}
(async()=>{for(const test of cases)await verify(test);
  console.log("LIMIT: dummy Cloudflare keys ONLY; no production domain, real client widget or hosted GoTrue captcha verified.");
})().catch(e=>{console.error("FAIL official Cloudflare dummy Siteverify contract:",e.message);
  process.exitCode=1;});
