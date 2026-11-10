import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const matcher=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
const worker=readFileSync("app/api/cron/marketplace-alert-outbox/route.ts","utf8");
const migration=readFileSync("supabase/migrations/20261110215000_marketplace_alert_outbox_review_hold_v1.sql","utf8");
const fixture=readFileSync("scripts/pilot-marketplace-alert-review-hold.sql","utf8");
const workflow=readFileSync(".github/workflows/pilot-marketplace-alert-outbox.yml","utf8");
const vercel=JSON.parse(readFileSync("vercel.json","utf8"));

test("only an ambiguous gated worker match can return review_required",()=>{
  assert.match(matcher,/delivery\.reason === "requires_reconciliation" && isWorkerDelivery/);
  assert.match(matcher,/emailNeedsReview = true/);
  assert.match(matcher,/break;/);
  assert.match(matcher,/if \(emailNeedsReview\) \{/);
  assert.match(matcher,/review_required: true/);
  assert.match(matcher,/reason: "email_outcome_ambiguous"/);
  assert.match(matcher,/status: 409/);
  assert.match(matcher,/shouldUseAlertIntentDelivery/);
});

test("worker distinguishes review_required from any other HTTP 409",()=>{
  assert.match(worker,/response\.status === 409/);
  assert.match(worker,/body\?\.review_required === true/);
  assert.match(worker,/body\?\.reason === "email_outcome_ambiguous"/);
  assert.match(worker,/errorCode = "matcher_http_409"/);
  assert.match(worker,/if \(reviewRequired\) \{/);
  assert.match(worker,/marketplace_alert_hold_for_review_v1/);
  assert.match(worker,/p_lease_token: job\.lease_token/);
  assert.match(worker,/outcome:"review_required"/);
  const review=worker.indexOf("if (reviewRequired)");
  const progress=worker.indexOf("if (partialProgress)");
  assert.ok(review>0 && review<progress);
});

test("review required is not a claimable/retriable outbox state",()=>{
  assert.match(migration,/state in \('pending','processing','completed','failed','review_required'\)/);
  assert.match(migration,/set state='review_required'/);
  assert.match(migration,/q\.lease_token=p_lease_token/);
  assert.match(migration,/q\.lease_until>now\(\)/);
  assert.match(migration,/q\.expires_at>now\(\)/);
  assert.match(migration,/lease_token=null/);
  assert.doesNotMatch(migration,/state='pending'/);
});

test("private aggregate-only health with no recipient identifiers",()=>{
  assert.match(migration,/returns bigint/);
  assert.match(migration,/count\(\*\)::bigint/);
  assert.doesNotMatch(migration.replace(/^--.*$/gm,""),/recipient_email|postal_code|directory_school_code|provider_message_id/i);
  assert.match(migration,/revoke all on function public\.marketplace_alert_review_count_v1\(\)/);
  assert.match(migration,/to service_role/);
});

test("isolated PostgreSQL fixture fences stale workers and permissions",()=>{
  assert.match(workflow,/pilot-marketplace-alert-review-hold\.sql/);
  assert.match(workflow,/127\.0\.0\.1/);
  assert.match(fixture,/Stale token was able to quarantine/);
  assert.match(fixture,/Quarantined listing was requeued/);
  assert.match(fixture,/Review quarantine RPC permissions are unsafe/);
  assert.equal(vercel.crons.filter(c=>c.path.includes("marketplace-alert-outbox")).length,0);
});
