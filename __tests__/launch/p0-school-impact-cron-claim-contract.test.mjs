import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("scripts/p0_school_impact_cron_claim_candidate_review_only.sql","utf8");
test("cron claim candidate cannot run accidentally or grant client access",()=>{
 assert.match(sql,/REVIEW ONLY, NEVER AUTODEPLOY/);
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;/);
 assert.match(sql,/SECURITY INVOKER/g);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE |ALTER DEFAULT PRIVILEGES|SET ROLE authenticated/i);
 assert.doesNotMatch(readFileSync("app/api/cron/school-impact-reports/route.ts","utf8"),/p0_school_impact_claim_candidate/);
});
test("durable unique subscription/period claim has no expiry or automatic retry",()=>{
 assert.match(sql,/UNIQUE\(subscription_id,period_key\)/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/ON CONFLICT\(subscription_id,period_key\) DO NOTHING/);
 assert.match(sql,/status IN \('claimed','accepted','unknown','reconciled'\)/);
 assert.doesNotMatch(sql,/lease_until|expires_at|interval '5 minutes'|DELETE FROM public\.p0_school_impact_dispatch_claims_candidate/i);
 assert.match(sql,/last_sent_month IS DISTINCT FROM p_expected_last_sent/);
 assert.match(sql,/v_subscription.enabled IS DISTINCT FROM TRUE/);
});
test("acknowledgement requires provider identity; only accepted claim can transition",()=>{
 assert.match(sql,/p_provider_message_id IS NULL/);
 assert.match(sql,/status='accepted',provider_message_id=trim\(p_provider_message_id\)/);
 assert.match(sql,/WHERE id=p_claim_id AND status='claimed'/);
 assert.match(sql,/provider_message_id IS NOT NULL/);
});
