import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20261003073142_transactional_email_notification_idempotency.sql",
  "utf8"
);
const delivery = readFileSync("lib/emails/delivery-idempotency.ts", "utf8");
const notifications = readFileSync("lib/notifications.ts", "utf8");
const matchRoute = readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts", "utf8");
const messageRoute = readFileSync("app/api/messages/send/route.ts", "utf8");
const proposeRoute = readFileSync("app/api/agreements/propose/route.ts", "utf8");
const confirmRoute = readFileSync("app/api/agreements/confirm/route.ts", "utf8");
const cancelRoute = readFileSync("app/api/agreements/cancel/route.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("notification event keys are unique while legacy notifications remain nullable", () => {
  assert.match(migration, /add column if not exists event_key text/);
  assert.match(migration, /create unique index if not exists notifications_event_key_uidx/);
  assert.match(migration, /where event_key is not null/);
  assert.match(notifications, /createNotificationOnce/);
  assert.match(notifications, /onConflict: "event_key"/);
  assert.match(notifications, /ignoreDuplicates: true/);
});

test("transactional email delivery memory is service-only and durable", () => {
  assert.match(migration, /create table if not exists public\.transactional_email_deliveries/);
  assert.match(migration, /event_key text not null unique/);
  assert.match(migration, /revoke all[^;]*anon, authenticated/s);
  assert.match(migration, /to service_role/);
  assert.match(delivery, /transactional_email_deliveries/);
  assert.match(delivery, /\.eq\("event_key", eventKey\)/);
  assert.match(delivery, /alreadySent: true/);
  assert.match(delivery, /provider_message_id/);
});

test("core transactional flows use stable event identities", () => {
  assert.match(matchRoute, /saved-search-match\/\$\{match\.id\}/);
  assert.match(messageRoute, /message-received\/\$\{message\.id\}/);
  assert.match(messageRoute, /first-message\/\$\{message\.id\}/);
  assert.match(proposeRoute, /agreement-proposed\/\$\{agreement\.id\}/);
  assert.match(confirmRoute, /agreement-confirmed\/\$\{agreement\.id\}\/\$\{recipient\.id\}/);
  assert.match(confirmRoute, /agreement-part-confirmed\/\$\{agreement\.id\}\/\$\{user\.id\}/);
  assert.match(cancelRoute, /agreement-cancelled\/\$\{agreement\.id\}/);
});

test("email routes use durable application idempotency in addition to provider keys", () => {
  for (const route of [matchRoute, messageRoute, proposeRoute, confirmRoute]) {
    assert.match(route, /sendTransactionalEmailOnce/);
  }
});

test("email hardening remains in the critical prebuild contract", () => {
  assert.equal(
    pkg.scripts["test:email-hardening"],
    "node --test __tests__/launch/email-hardening-208.test.mjs"
  );
  assert.match(pkg.scripts["test:critical-contracts"], /test:email-hardening/);
});
