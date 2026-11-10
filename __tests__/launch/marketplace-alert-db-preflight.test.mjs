import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("scripts/pilot-marketplace-alert-production-preflight.sql","utf8");
const statements=sql.replace(/^--.*$/gm,"").trim();
const docs=readFileSync("docs/PILOT_ALERT_DB_MIGRATION_PREFLIGHT.md","utf8");
test("production migration preflight runs in read-only transaction and exposes aggregate metrics",()=>{
  assert.match(statements,/^begin transaction read only;/i);
  assert.match(statements,/commit;\s*$/i);
  assert.match(statements,/to_regclass\('public\.marketplace_alert_email_intents'\)/);
  assert.match(statements,/to_regprocedure\('public\.marketplace_alert_hold_for_review_v1\(uuid,uuid\)'\)/);
  assert.match(statements,/count\(\*\) filter \(where state='review_required'\)/);
  assert.match(statements,/relrowsecurity as rls_enabled/);
  assert.match(statements,/is_demo=true/);
  assert.match(statements,/marketplace_alert_reconciliation_health_v1/);
  assert.match(statements,/marketplace_alert_reconcile_accepted_v1/);
  assert.match(statements,/marketplace_alert_email_intents_provider_receipt_uq/);
  assert.match(statements,/pg_get_functiondef/);
  assert.match(statements,/checks_lease_expiry/);
  assert.match(statements,/checks_job_expiry/);
});
test("no DDL, DML, secrets or recipient identifiers in production preflight",()=>{
  assert.doesNotMatch(statements,/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|vacuum|analyze|execute|copy|call|do)\b/i);
  assert.doesNotMatch(statements,/\b(email|recipient_email|postal_code|password|api_key|secret|auth\.users)\b/i);
  assert.doesNotMatch(statements,/pg_read_file|pg_ls_dir|pg_sleep|http_|dblink/i);
});
test("migration plan preserves state evidence, requires advisors and both flags off",()=>{
  assert.match(docs,/auth_leaked_password_protection/);
  assert.match(docs,/saved_searches_directory_school_code_fkey/);
  assert.match(docs,/ambas.*banderas/i);
  assert.match(docs,/PITR/);
  assert.match(docs,/rollback.*NO revierte/i);
});
