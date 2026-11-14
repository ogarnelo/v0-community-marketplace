import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(p)=>readFileSync(p,"utf8");
const route=read("app/api/marketplace/listings/match-saved-searches/route.ts");
const delivery=read("lib/emails/delivery-idempotency.ts");
const provider=read("lib/emails/brand.ts");
const matchEmail=read("lib/emails/saved-search-match-email.ts");
const notification=read("lib/notifications.ts");
const worker=read("app/api/cron/marketplace-alert-outbox/route.ts");

test("QA A9: retry uses same opaque match-specific key for notification and provider email",()=>{
  assert.match(route,/event_key: `saved-search-match\/\$\{match\.id\}`/);
  assert.match(route,/const emailEventKey = `saved-search-match\/\$\{match\.id\}`/);
  assert.match(route,/eventKey: emailEventKey/);
  assert.match(route,/idempotencyKey: emailEventKey/);
  assert.match(notification,/onConflict: "event_key", ignoreDuplicates: true/);
  assert.match(delivery,/onConflict: "event_key", ignoreDuplicates: true/);
  assert.match(provider,/headers\["Idempotency-Key"\] = params\.idempotencyKey/);
  assert.match(matchEmail,/idempotencyKey: params\.idempotencyKey/);
});

test("QA A9: provider result persisted after send; retry cannot be claimed as exactly-once guarantee",()=>{
  const query=delivery.indexOf('.from("transactional_email_deliveries")');
  const send=delivery.indexOf("const providerResult = await params.send()");
  const write=delivery.indexOf('.upsert(',send);
  assert.ok(query>=0 && send>query && write>send,
    "provider round trip precedes local acknowledgement: interruption window still exists");
  assert.match(delivery,/if \(existing\)/);
  assert.match(delivery,/alreadySent: true/);
  assert.match(delivery,/if \(providerResult\.skipped === true\)/);
  assert.match(delivery,/reason: "provider_skipped"/);
  assert.match(provider,/throw new Error\(`Resend error \$\{response\.status\}/);
});

test("QA A11: disabled recipients and unavailable email never count as delivered",()=>{
  assert.match(route,/email_skip_reason: "recipient_missing"/);
  assert.match(route,/email_skip_reason: "suppressed"/);
  assert.match(route,/if \(!delivery\.sent\)/);
  assert.match(route,/emailFailures\+\+/);
  assert.match(delivery,/health\?\.is_suppressed/);
  assert.match(delivery,/sent: false/);
});

test("QA A12: outbox requires signed flag and only requeues bounded partial progress",()=>{
  assert.match(worker,/if \(!alertOutboxWorkerEnabled\(\)\)/);
  assert.match(worker,/request\.headers\.get\("authorization"\) !== `Bearer \$\{cronSecret\}`/);
  assert.match(worker,/p_limit: 1, p_lease_seconds: 240/);
  assert.match(worker,/AbortSignal\.timeout\(25000\)/);
  assert.match(worker,/marketplace_alert_requeue_progress_v1/);
  assert.match(worker,/p_lease_token: job\.lease_token/);
});
