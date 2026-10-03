import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const webhook = readFileSync("lib/emails/resend-webhook.ts", "utf8");
const delivery = readFileSync("lib/emails/delivery-idempotency.ts", "utf8");
const health = readFileSync("lib/admin/email-health.ts", "utf8");
const page = readFileSync("app/admin/super/email-health/page.tsx", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("Resend suppression lifecycle is mirrored using only a normalized email hash", () => {
  assert.match(webhook, /suppression\.added/);
  assert.match(webhook, /suppression\.removed/);
  assert.match(webhook, /hashRecipientEmail\(params\.email\)/);
  assert.match(webhook, /suppressionReasonFromOrigin/);
  assert.match(webhook, /origin === "bounce"/);
  assert.match(webhook, /origin === "complaint"/);
  assert.doesNotMatch(webhook, /recipient_email:\s*params\.email/);
});

test("provider add blocks and provider removal explicitly clears the local gate", () => {
  assert.match(webhook, /is_suppressed: true/);
  assert.match(webhook, /return "suppression_added"/);
  assert.match(webhook, /is_suppressed: false/);
  assert.match(webhook, /suppression_reason: null/);
  assert.match(webhook, /soft_bounce_count: 0/);
  assert.match(webhook, /suppressed_at: null/);
  assert.match(webhook, /return "suppression_removed"/);
  assert.match(delivery, /health\?\.is_suppressed/);
});

test("suppression payload parser tolerates current and nested provider shapes", () => {
  assert.match(webhook, /typeof data\.email === "string"/);
  assert.match(webhook, /typeof suppression\?\.email === "string"/);
  assert.match(webhook, /Array\.isArray\(data\.to\)/);
  assert.match(webhook, /typeof data\.origin === "string"/);
  assert.match(webhook, /typeof suppression\?\.origin === "string"/);
  assert.match(webhook, /typeof data\.source_id === "string"/);
});

test("email health surfaces operational threshold alerts", () => {
  assert.match(health, /BOUNCE_ALERT_THRESHOLD_PERCENT = 2/);
  assert.match(health, /COMPLAINT_ALERT_THRESHOLD_PERCENT = 0\.05/);
  assert.match(health, /bounceRate > BOUNCE_ALERT_THRESHOLD_PERCENT/);
  assert.match(health, /complaintRate > COMPLAINT_ALERT_THRESHOLD_PERCENT/);
  assert.match(health, /severity: "warning"/);
  assert.match(health, /severity: "critical"/);
  assert.match(page, /Alertas operativas/);
  assert.match(page, /Sin alertas de entregabilidad/);
});

test("Super Admin exposes provider removals without recipient identifiers", () => {
  assert.match(health, /providerUnsuppressed/);
  assert.match(health, /last_event_type === "suppression\.removed"/);
  assert.match(page, /Reactivadas por una retirada explícita en Resend/);
  assert.doesNotMatch(page, /recipient_email_hash/);
});

test("suppression sync and alerts stay in the critical prebuild suite", () => {
  assert.equal(
    pkg.scripts["test:email-suppression-sync"],
    "node --test __tests__/launch/email-suppression-sync-alerts-211.test.mjs"
  );
  assert.match(pkg.scripts["test:critical-contracts"], /test:email-suppression-sync/);
});
