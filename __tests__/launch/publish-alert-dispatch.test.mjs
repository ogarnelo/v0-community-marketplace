import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dispatchPublishedListingAlerts } from "../../lib/marketplace/publish-alert-dispatch.mjs";

const form = readFileSync("components/marketplace/new-listing-form.tsx", "utf8");
const matcher = readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts", "utf8");
const email = readFileSync("lib/emails/delivery-idempotency.ts", "utf8");
const brand = readFileSync("lib/emails/brand.ts", "utf8");

const noop = async () => {};

test("successful notification processing requires one attempt", async () => {
  let calls = 0;
  const result = await dispatchPublishedListingAlerts(async () => {
    calls++;
    return { ok: true, status: 200 };
  }, noop);
  assert.deepEqual(result, { ok: true, attempts: 1 });
  assert.equal(calls, 1);
});

test("a 500 response is detected and retried once before success", async () => {
  let calls = 0, pauses = 0;
  const result = await dispatchPublishedListingAlerts(async () => {
    calls++;
    return calls === 1 ? { ok: false, status: 500 } : { ok: true, status: 200 };
  }, async (ms) => { assert.equal(ms, 400); pauses++; });
  assert.deepEqual(result, { ok: true, attempts: 2 });
  assert.equal(calls, 2);
  assert.equal(pauses, 1);
});

test("a transient broken connection is retried once", async () => {
  let calls = 0;
  const result = await dispatchPublishedListingAlerts(async () => {
    calls++;
    if (calls === 1) throw new Error("Temporary network failure");
    return { ok: true, status: 200 };
  }, noop);
  assert.deepEqual(result, { ok: true, attempts: 2 });
  assert.equal(calls, 2);
});

test("permanent authorization or rate limiting failures are never retried", async () => {
  for (const status of [400, 401, 403, 404, 422, 429]) {
    let calls = 0;
    const result = await dispatchPublishedListingAlerts(async () => {
      calls++;
      return { ok: false, status };
    }, noop);
    assert.deepEqual(result, { ok: false, attempts: 1, reason: "http_" + status });
    assert.equal(calls, 1);
  }
});

test("two server failures stop after a bounded retry, without an unhandled rejection", async () => {
  let calls = 0;
  const result = await dispatchPublishedListingAlerts(async () => {
    calls++;
    return { ok: false, status: 503 };
  }, noop);
  assert.deepEqual(result, { ok: false, attempts: 2, reason: "http_503" });
  assert.equal(calls, 2);
});

test("two network failures are reported after two attempts", async () => {
  let calls = 0;
  const result = await dispatchPublishedListingAlerts(async () => {
    calls++;
    throw new Error("offline");
  }, noop);
  assert.deepEqual(result, { ok: false, attempts: 2, reason: "network_error" });
  assert.equal(calls, 2);
});

test("malformed server response does not cause unbounded retry", async () => {
  let calls = 0;
  const result = await dispatchPublishedListingAlerts(async () => {
    calls++;
    return { ok: false };
  }, noop);
  assert.deepEqual(result, { ok: false, attempts: 1, reason: "invalid_response" });
  assert.equal(calls, 1);
});

test("listing is committed first; alerts run separately and use fetch keepalive", () => {
  const insertIndex = form.indexOf('from("listings").insert(payload)');
  const alertIndex = form.indexOf("void dispatchPublishedListingAlerts(");
  const navigationIndex = form.indexOf("router.push(`/marketplace/listing/${listingId}?published=1`);");
  assert.ok(insertIndex !== -1 && alertIndex > insertIndex);
  assert.ok(navigationIndex > alertIndex);
  assert.match(form, /keepalive: true,[\s\S]*?body: JSON\.stringify\(\{ listingId, opportunityKey: activationOpportunityKey \}\)/);
  assert.doesNotMatch(form, /await fetch\("\/api\/marketplace\/listings\/match-saved-searches"/);
  assert.match(form, /if \(!result\.ok\)/);
  assert.match(form, /\.catch\(\(error\) => \{/);
});

test("server authorization, unique matches and provider idempotency remain enforced", () => {
  assert.match(matcher, /listing\.seller_id !== user\.id/);
  assert.match(matcher, /onConflict: "saved_search_id,listing_id", ignoreDuplicates: true/);
  assert.match(matcher, /createNotificationOnce\(/);
  assert.match(matcher, /sendTransactionalEmailOnce\(/);
  assert.match(email, /onConflict: "event_key", ignoreDuplicates: true/);
  assert.match(brand, /headers\["Idempotency-Key"\]/);
});
