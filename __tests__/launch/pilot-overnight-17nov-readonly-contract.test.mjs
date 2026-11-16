import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const yml=readFileSync(".github/workflows/pilot-overnight-17nov-readonly.yml","utf8");
test("schedules exactly the three overnight UTC slots for 17 November only",()=>{
 assert.match(yml,/cron: "20 0,2,4 17 11 \*"/);
 assert.match(yml,/2026-11-17/);
 assert.match(yml,/date -u \+%F/);
 assert.match(yml,/date_gate\.outputs\.active == 'true'/);
});
test("manual dispatch available but no long-running recurring agent implied",()=>{
 assert.match(yml,/workflow_dispatch:/);
 assert.match(yml,/timeout-minutes: 5/);
 assert.doesNotMatch(yml,/FREQ=HOURLY|while true|sleep 3600/);
});
test("GitHub task has only read-only permission and no sensitive secrets",()=>{
 assert.match(yml,/permissions:\s*\n\s*contents: read/);
 assert.match(yml,/persist-credentials: false/);
 assert.doesNotMatch(yml,/secrets\.|SUPABASE_|VERCEL_TOKEN|GH_TOKEN|STRIPE_|resend/);
 assert.doesNotMatch(yml,/contents: write|issues: write|pull-requests: write/);
});
test("does not deploy, migrate or modify data",()=>{
 assert.match(yml,/node --test __tests__\/launch\/pilot-donation-rls-review-contract\.test\.mjs/);
 assert.match(yml,/node scripts\/pilot-guest-http-smoke\.mjs https:\/\/www\.wetudy\.com/);
 assert.doesNotMatch(yml,/npm install|npm ci|vercel deploy|supabase db|psql|curl -X POST|git push/);
});
test("summary preserves failure statuses and warns about untested launch gates",()=>{
 assert.match(yml,/rls_result=\$\?/);
 assert.match(yml,/guest_result=\$\?/);
 assert.match(yml,/GITHUB_STEP_SUMMARY/);
 assert.match(yml,/test "\$rls_result" -eq 0 && test "\$guest_result" -eq 0/);
 assert.match(yml,/Piloto general NO-GO/);
});
