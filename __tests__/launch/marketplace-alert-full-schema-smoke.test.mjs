import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("scripts/pilot-marketplace-alert-full-schema-smoke.sql","utf8");
const workflow=readFileSync(".github/workflows/pilot-marketplace-alert-outbox.yml","utf8");
test("full schema smoke runs read-only and checks all five migration layers",()=>{
  assert.match(sql,/begin transaction read only;/i);
  assert.match(sql,/commit;/i);
  for(const name of ["marketplace_alert_email_intents","marketplace_alert_email_intent_health_v1",
  "marketplace_alert_review_count_v1","marketplace_alert_reconciliation_health_v1",
  "marketplace_alert_email_intents_provider_receipt_uq",
  "marketplace_alert_settle_outbox_v1","marketplace_alert_requeue_progress_v1",
  "marketplace_alert_defer_readiness_v1"]) assert.ok(sql.includes(name),name);
  assert.match(sql,/Expired lease fencing incomplete/);
  assert.match(sql,/Provider message id not uniquely fenced/);
  assert.match(sql,/Unauthorized client can inspect or change alert state/);
});
test("isolated workflow executes smoke after five migrations in temporary postgres",()=>{
  assert.match(workflow,/127\.0\.0\.1/);
  assert.match(workflow,/wetudy_ci/);
  assert.match(workflow,/pilot-marketplace-alert-full-schema-smoke\.sql/);
  const run=workflow.lastIndexOf("psql -X -v ON_ERROR_STOP=1");
  assert.ok(workflow.slice(run).includes("pilot-marketplace-alert-full-schema-smoke.sql"));
});
test("smoke never sends mail, mutates state or reveals recipients",()=>{
  const executable=sql.replace(/^--.*$/gm,"");
  assert.doesNotMatch(executable,/^\s*(update|insert|delete|drop|alter|truncate|create|grant|revoke|call|execute)\b/mi);
  assert.doesNotMatch(executable,/recipient_email|postal_code|school_code|api_key|email_body/i);
});
