import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/webhooks/resend/route.ts", "utf8");
const helper = readFileSync("lib/emails/resend-webhook.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261003075312_resend_webhook_observability.sql",
  "utf8"
);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("Resend webhook verifies the raw request before parsing JSON", () => {
  assert.match(route, /const rawBody = await request\.text\(\)/);
  assert.match(route, /verifyResendWebhookSignature\([\s\S]*rawBody/);
  assert.match(route, /JSON\.parse\(rawBody\)/);
  assert.ok(
    route.indexOf("verifyResendWebhookSignature") < route.indexOf("JSON.parse(rawBody)")
  );
});

test("signature verification covers replay protection and constant-time comparison", () => {
  assert.match(helper, /SIGNATURE_TOLERANCE_SECONDS = 5 \* 60/);
  assert.match(helper, /svix-id/);
  assert.match(helper, /svix-timestamp/);
  assert.match(helper, /svix-signature/);
  assert.match(helper, /createHmac\("sha256"/);
  assert.match(helper, /timingSafeEqual/);
  assert.match(helper, /\$\{messageId\}\.\$\{timestamp\}\.\$\{params\.rawBody\}/);
});

test("webhook processing is idempotent and stores no raw email payload", () => {
  assert.match(helper, /resend_webhook_events/);
  assert.match(helper, /\.eq\("event_id", params\.eventId\)/);
  assert.match(helper, /processed_at/);
  assert.match(helper, /onConflict: "event_id"/);
  assert.doesNotMatch(migration, /raw_payload|recipient_email|subject text/i);
});

test("delivery telemetry tracks delivery and failure outcomes", () => {
  for (const eventType of [
    "email.sent",
    "email.delivered",
    "email.delivery_delayed",
    "email.bounced",
    "email.complained",
    "email.failed",
    "email.suppressed",
  ]) {
    assert.match(helper, new RegExp(eventType.replace(".", "\\.")));
  }

  for (const column of [
    "delivery_status",
    "delivered_at",
    "delivery_delayed_at",
    "bounced_at",
    "complained_at",
    "failed_at",
    "suppressed_at",
  ]) {
    assert.match(migration, new RegExp(column));
  }
});

test("webhook secrets and events remain service-only", () => {
  assert.match(migration, /create table if not exists public\.resend_webhook_secrets/);
  assert.match(migration, /create table if not exists public\.resend_webhook_events/);
  assert.match(migration, /revoke all[^;]*public, anon, authenticated/s);
  assert.match(migration, /grant select on table public\.resend_webhook_secrets to service_role/);
  assert.match(migration, /resend_webhook_events_service_role/);
  assert.match(helper, /\.eq\("is_active", true\)/);
});

test("Resend webhook contract runs in the critical prebuild suite", () => {
  assert.equal(
    pkg.scripts["test:resend-webhooks"],
    "node --test __tests__/launch/resend-webhooks-209.test.mjs"
  );
  assert.match(pkg.scripts["test:critical-contracts"], /test:resend-webhooks/);
});
