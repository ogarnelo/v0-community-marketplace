#!/usr/bin/env node
// WETUDY · Contratos de cola y pausas, completamente offline (no E2E).
// Basado en el worker del commit 41bbd724 y RPCs leídas en Supabase el 14/11/2026.
import assert from "node:assert/strict";
import test from "node:test";

const classify = (status, body) => {
  if (status >= 200 && status < 300) {
    if (body?.ok === true && body?.complete === true) return "settle_success";
    if (body?.ok === true && body?.complete === false) return "requeue_progress";
    return "settle_failure";
  }
  if (status === 409 && body?.review_required === true && body?.reason === "email_outcome_ambiguous") return "hold_review";
  return "settle_failure";
};
const claim = state => ({ ...state, state:"processing", attempts:state.attempts+1, lease_token:"lease-1" });
const requeue = (state, token, now) => state.state === "processing" &&
    state.lease_token === token && state.expires_at > now
  ? { ...state, state:"pending", attempts:0, lease_token:null, next_attempt_at:now+15000 }
  : null;
const settle = (state, token, success, now) => state.state === "processing" &&
    state.lease_token === token
  ? { ...state, state:success ? "completed" :
       state.attempts >= 4 || now >= state.expires_at ? "failed" : "pending",
      lease_token:null }
  : null;
const seed = (attempts=0, expires_at=48*3600*1000) =>
  ({ state:"pending", attempts, expires_at, lease_token:null });

test("202 paused worker is progress, never ACK delivery", () => {
  assert.equal(classify(202, {ok:true,complete:false,paused:true}), "requeue_progress");
  assert.notEqual(classify(202, {ok:true,complete:false,paused:true}), "settle_success");
});
test("the old 503 pause can consume a fourth failed attempt", () => {
  assert.equal(classify(503,{ok:false,complete:false}), "settle_failure");
  assert.equal(settle(claim(seed(3)),"lease-1",false,100).state,"failed");
});
test("requeue releases the fencing token and preserves pending state", () => {
  const next=requeue(claim(seed(3)),"lease-1",100);
  assert.equal(next.state,"pending");
  assert.equal(next.attempts,0);
  assert.equal(next.lease_token,null);
  assert.equal(next.next_attempt_at,15100);
});
test("stale leases cannot requeue or settle", () => {
  const job=claim(seed());
  assert.equal(requeue(job,"stale",100),null);
  assert.equal(settle(job,"stale",true,100),null);
});
test("ambiguous email outcome must go to manual review", () => {
  assert.equal(classify(409,{review_required:true,reason:"email_outcome_ambiguous"}),"hold_review");
  assert.equal(classify(409,{review_required:false,reason:"email_outcome_ambiguous"}),"settle_failure");
});
test("malformed 2xx never acknowledges completion", () => {
  for (const body of [{ok:true},{ok:true,complete:"true"},{complete:true},{ok:false,complete:true},null])
    assert.equal(classify(200,body),"settle_failure");
});
test("requeue respects original expiry", () => {
  assert.equal(requeue(claim(seed(1,100)),"lease-1",101),null);
});
test("WARNING: repeated progress resets retry counter, requires separate review", () => {
  let job=seed(0,Infinity);
  for (let i=0;i<10;i++) {
    job=claim(job);
    job=requeue(job,"lease-1",i*1000);
    assert.equal(job.attempts,0);
  }
  assert.equal(job.state,"pending");
});
