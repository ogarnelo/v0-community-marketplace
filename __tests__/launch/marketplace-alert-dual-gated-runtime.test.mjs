import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {shouldUseAlertIntentDelivery} from "../../lib/marketplace/alert-intent-feature-gate.mjs";

const matcher=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
const bridged=readFileSync("lib/emails/marketplace-alert-intent-gated.ts","utf8");
const template=readFileSync("lib/emails/saved-search-match-email.ts","utf8");
const emailOnce=readFileSync("lib/emails/delivery-idempotency.ts","utf8");
const vercel=JSON.parse(readFileSync("vercel.json","utf8"));

test("second flag is off for all values except exact true and genuine worker",()=>{
  for(const value of [undefined,null,"","TRUE","false","1",true,"true "])
    assert.equal(shouldUseAlertIntentDelivery(true,value),false);
  assert.equal(shouldUseAlertIntentDelivery(false,"true"),false);
  assert.equal(shouldUseAlertIntentDelivery(undefined,"true"),false);
  assert.equal(shouldUseAlertIntentDelivery(true,"true"),true);
});

test("new adapter is only reachable inside live recipient delivery, never discovery or publisher",()=>{
  assert.match(matcher,/const isWorkerDelivery = isOutboxWorker && workerStage === "deliver"/);
  assert.match(matcher,/shouldUseAlertIntentDelivery\(\s*isWorkerDelivery, process\.env\.WETUDY_ALERT_INTENT_DELIVERY_ENABLED/);
  assert.match(matcher,/sendGatedMarketplaceAlertWithIntent\(admin/);
  assert.match(matcher,/: await sendTransactionalEmailOnce\(admin/);
  assert.match(matcher,/request\.headers\.get\("x-wetudy-alert-outbox"\) === "1"/);
  assert.match(matcher,/\.gt\("lease_until", new Date\(\)\.toISOString\(\)\)/);
  assert.equal(vercel.crons.filter(c=>c.path.includes("marketplace-alert-outbox")).length,0);
});

test("existing sender uses same template builder, with identical arguments and idempotency key",()=>{
  assert.match(template,/export function buildSavedSearchMatchEmail/);
  assert.match(template,/return sendBrandedEmail\(buildSavedSearchMatchEmail\(params\)\)/);
  assert.match(template,/subject: `Nuevo anuncio que coincide con tu búsqueda · \$\{params\.listingTitle\}`/);
  assert.match(template,/idempotencyKey: params\.idempotencyKey/);
});

test("new transport checks historical receipt and recipient suppression before provider",()=>{
  const legacy=bridged.indexOf('.from("transactional_email_deliveries")');
  const health=bridged.indexOf('.from("transactional_email_recipient_health")');
  const send=bridged.indexOf("await deliverPreparedMarketplaceAlert");
  assert.ok(legacy>0 && health>legacy && send>health);
  assert.match(bridged,/legacy_receipt_lookup_failed/);
  assert.match(bridged,/recipient_health_lookup_failed/);
  assert.match(bridged,/if \(health\?\.is_suppressed\)/);
  assert.match(bridged,/if \(!apiKey \|\| !from\)/);
  assert.match(bridged,/recipient_email_hash:recipientHash/);
  assert.match(bridged,/onConflict:"event_key",ignoreDuplicates:true/);
});

test("unknown results cannot mark emailed, and errors continue to count as failures",()=>{
  assert.match(bridged,/result\.status!=="accepted" && result\.status!=="already_accepted"/);
  assert.match(bridged,/reason:"requires_reconciliation"/);
  assert.match(bridged,/if \(receiptError\) \{/);
  assert.match(bridged,/return \{sent:false,reason:"requires_reconciliation"\}/);
  assert.match(matcher,/if \(!delivery\.sent\)/);
  assert.match(matcher,/emailFailures\+\+/);
  assert.match(matcher,/if \(progress\.failed\)/);
  assert.match(matcher,/status: 503/);
});

test("new flow preserves legacy duplicate protection for old producer calls",()=>{
  assert.match(emailOnce,/transactional_email_deliveries/);
  assert.match(emailOnce,/health\?\.is_suppressed/);
  assert.match(bridged,/if \(legacy\) return \{sent:true\}/);
  assert.match(bridged,/transactional_email_deliveries/);
  assert.match(matcher,/sendTransactionalEmailOnce\(/);
});
