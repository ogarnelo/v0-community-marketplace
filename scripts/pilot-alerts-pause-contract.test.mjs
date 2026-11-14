#!/usr/bin/env node
// WETUDY QA-only contract tests for pause-outbox proposal, without DB or providers.
// These tests model verified SQL semantics. They do NOT replace PostgreSQL17 E2E.
import assert from "node:assert/strict";
import test from "node:test";
const claim=(attempts)=>attempts<4?attempts+1:null;
const pause=(attemptsAfterClaim,validLease=true,validExpiry=true)=>
 validLease&&validExpiry?Math.max(0,attemptsAfterClaim-1):null;
const mode=(status,body)=>status===202&&body?.ok===true&&body?.complete===false&&body?.paused===true&&body?.reason==="alerts_disabled"?"pause":
 status>=200&&status<300&&body?.ok===true&&body?.complete===false?"progress":
 status>=200&&status<300&&body?.ok===true&&body?.complete===true?"completed":"failure";
test("pause preserves zero prior failures",()=>assert.equal(pause(claim(0)),0));
test("pause preserves two prior failures",()=>assert.equal(pause(claim(2)),2));
test("pause preserves three prior failures",()=>assert.equal(pause(claim(3)),3));
test("four failed attempts cannot be claimed",()=>assert.equal(claim(4),null));
test("expired lease cannot be paused",()=>assert.equal(pause(claim(1),false),null));
test("expired outbox cannot be paused",()=>assert.equal(pause(claim(1),true,false),null));
test("202 signed pause differs from progress",()=>{assert.equal(mode(202,{ok:true,complete:false,paused:true,reason:"alerts_disabled"}),"pause");assert.equal(mode(202,{ok:true,complete:false}),"progress");});
test("spoofed paused reasons are never privileged",()=>{assert.equal(mode(202,{ok:true,complete:false,paused:true,reason:"other"}),"progress");assert.equal(mode(503,{ok:false}),"failure");});
