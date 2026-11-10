import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/migrations/20261110223000_marketplace_alert_reconcile_accepted_v1.sql","utf8");
const fixture=readFileSync("scripts/pilot-marketplace-alert-manual-reconciliation.sql","utf8");
const workflow=readFileSync(".github/workflows/pilot-marketplace-alert-outbox.yml","utf8");
const vercel=JSON.parse(readFileSync("vercel.json","utf8"));
test("only uncertain email intents can be acknowledged after manual verification",()=>{
  assert.match(sql,/i\.state in \('sending','ambiguous'\)/);
  assert.match(sql,/p_evidence_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(sql,/p_source in \('resend_api','resend_dashboard'\)/);
  assert.match(sql,/length\(trim\(p_provider_message_id\)\) between 1 and 200/);
  assert.match(sql,/reconciled_at=now\(\)/);
  assert.doesNotMatch(sql,/state='prepared'/);
});
test("manual reconciliation cannot be called by anon/authenticated",()=>{
  assert.match(sql,/security invoker set search_path = ''/);
  assert.match(sql,/revoke all on function public\.marketplace_alert_reconcile_accepted_v1\(text,text,text,text\)/);
  assert.match(sql,/revoke all on function public\.marketplace_alert_reconciliation_health_v1\(\)/);
  assert.match(sql,/to service_role/);
});
test("no recipient, postcode or school data in reconciliation audit schema",()=>{
  const executable=sql.replace(/^--.*$/gm,"");
  assert.doesNotMatch(executable,/recipient_email|postal_code|school_id|address|html|payload_body/i);
  assert.match(executable,/returns table \(/);
  assert.match(executable,/count\(\*\) filter/);
});
test("isolated SQL validates bad evidence, immutable accepted state and no resend",()=>{
  assert.match(workflow,/pilot-marketplace-alert-manual-reconciliation\.sql/);
  assert.match(workflow,/127\.0\.0\.1/);
  assert.match(fixture,/Unapproved evidence source passed/);
  assert.match(fixture,/Unverifiable digest passed/);
  assert.match(fixture,/Accepted receipt was overwritten/);
  assert.match(fixture,/Manually accepted email was resent/);
  assert.match(fixture,/privilege leak/);
  assert.equal(vercel.crons.filter(c=>c.path.includes("marketplace-alert-outbox")).length,0);
});
