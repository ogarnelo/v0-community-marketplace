import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20261003081154_transactional_email_recipient_health.sql",
  "utf8"
);
const userIndexMigration = readFileSync(
  "supabase/migrations/20261003081645_transactional_email_recipient_health_user_idx.sql",
  "utf8"
);
const delivery = readFileSync("lib/emails/delivery-idempotency.ts", "utf8");
const webhook = readFileSync("lib/emails/resend-webhook.ts", "utf8");
const health = readFileSync("lib/admin/email-health.ts", "utf8");
const page = readFileSync("app/admin/super/email-health/page.tsx", "utf8");
const superPage = readFileSync("app/admin/super/page.tsx", "utf8");
const messageRoute = readFileSync("app/api/messages/send/route.ts", "utf8");
const proposeRoute = readFileSync("app/api/agreements/propose/route.ts", "utf8");
const confirmRoute = readFileSync("app/api/agreements/confirm/route.ts", "utf8");
const matchRoute = readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("recipient suppression state is service-only and keyed by an email hash", () => {
  assert.match(migration, /recipient_email_hash text primary key/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all[^;]*public, anon, authenticated/s);
  assert.match(migration, /to service_role/);
  assert.match(userIndexMigration, /transactional_email_recipient_health_user_id_idx/);
  assert.match(userIndexMigration, /on public\.transactional_email_recipient_health\(user_id\)/);
  assert.doesNotMatch(migration, /recipient_email\s+text/i);
  assert.match(delivery, /createHash\("sha256"\)/);
  assert.match(delivery, /normalizeRecipientEmail/);
});

test("every protected transactional flow passes the actual recipient into the pre-send gate", () => {
  assert.match(messageRoute, /recipientEmail,/);
  assert.match(proposeRoute, /recipientEmail,/);
  assert.match(confirmRoute, /recipientEmail: recipient\.email!/);
  assert.match(matchRoute, /recipientEmail: recipient\.user\.email!/);
});

test("pre-send gate skips active suppressions before calling the provider", () => {
  assert.match(delivery, /transactional_email_recipient_health/);
  assert.match(delivery, /\.select\("is_suppressed,suppression_reason"\)/);
  assert.match(delivery, /reason: "suppressed"/);
  assert.ok(
    delivery.indexOf("health?.is_suppressed") < delivery.indexOf("const providerResult = await params.send()")
  );
});

test("webhook hygiene distinguishes permanent from transient bounces", () => {
  assert.match(webhook, /SOFT_BOUNCE_SUPPRESSION_THRESHOLD = 3/);
  assert.match(webhook, /normalized === "permanent"/);
  assert.match(webhook, /normalized === "transient"/);
  assert.match(webhook, /reason: "hard_bounce"/);
  assert.match(webhook, /softBounceCount >= SOFT_BOUNCE_SUPPRESSION_THRESHOLD/);
  assert.match(webhook, /"soft_bounce_limit"/);
  assert.match(webhook, /reason: "complaint"/);
  assert.match(webhook, /reason: "provider_suppressed"/);
});

test("successful delivery resets transient bounce count without lifting a real suppression", () => {
  assert.match(webhook, /resetTransientBounceCountAfterDelivery/);
  assert.match(webhook, /if \(!current \|\| current\.is_suppressed\) return/);
  assert.match(webhook, /soft_bounce_count: 0/);
});

test("Super Admin exposes aggregate email health without recipient identifiers", () => {
  assert.match(superPage, /\/admin\/super\/email-health/);
  assert.match(page, /Salud de email/);
  assert.match(page, /Destinatarios bloqueados/);
  assert.match(health, /deliveryRate/);
  assert.match(health, /bounceRate/);
  assert.match(health, /complaintRate/);
  assert.match(health, /activeSuppressions/);
  assert.doesNotMatch(page, /recipient_email_hash/);
});

test("email suppression health stays in critical prebuild contracts", () => {
  assert.equal(
    pkg.scripts["test:email-suppression-health"],
    "node --test __tests__/launch/email-suppression-health-210.test.mjs"
  );
  assert.match(pkg.scripts["test:critical-contracts"], /test:email-suppression-health/);
});
