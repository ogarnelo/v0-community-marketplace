import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const migration=readFileSync("supabase/migrations/20261110224500_marketplace_alert_provider_receipt_unique.sql","utf8");
const fixture=readFileSync("scripts/pilot-marketplace-alert-provider-receipt-unique.sql","utf8");
const ci=readFileSync(".github/workflows/pilot-marketplace-alert-outbox.yml","utf8");
test("a provider message ID can confirm only one saved-search event",()=>{
  assert.match(migration,/create unique index if not exists marketplace_alert_email_intents_provider_receipt_uq/);
  assert.match(migration,/on public\.marketplace_alert_email_intents\(provider_message_id\)/);
  assert.match(migration,/where provider_message_id is not null/);
});
test("PostgreSQL synthetic fixture rejects duplicate normal and manual acceptance",()=>{
  assert.match(fixture,/Same provider receipt accepted for second event/);
  assert.match(fixture,/Manual reconciliation reused another event provider receipt/);
  assert.match(fixture,/Rejected manual reconciliation did not preserve quarantine/);
  assert.match(fixture,/Second distinct provider receipt was rejected/);
  assert.match(ci,/pilot-marketplace-alert-provider-receipt-unique\.sql/);
  assert.match(ci,/127\.0\.0\.1/);
});
test("provider-id uniqueness does not grant public access or activate worker",()=>{
  const sql=migration.replace(/^--.*$/gm,"");
  assert.doesNotMatch(sql,/\bgrant\b|\bpolicy\b|\btrigger\b|\bcron\b/i);
  assert.doesNotMatch(sql,/recipient_email|postal_code|school_id/i);
});
