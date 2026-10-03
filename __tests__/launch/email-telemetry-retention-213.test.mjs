import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const retention = readFileSync(
  "lib/admin/email-telemetry-retention.ts",
  "utf8"
);
const cron = readFileSync("app/api/cron/email-health/route.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("email telemetry retention keeps 90 days by default and never goes below 30", () => {
  assert.match(retention, /EMAIL_TELEMETRY_RETENTION_DAYS = 90/);
  assert.match(retention, /retentionDays < 30/);
});

test("retention only removes processed Resend webhook events", () => {
  assert.match(retention, /from\("resend_webhook_events"\)/);
  assert.match(retention, /not\("processed_at", "is", null\)/);
  assert.match(retention, /lt\("received_at", cutoff\)/);
  assert.match(retention, /\.delete\(\)/);

  assert.doesNotMatch(retention, /transactional_email_deliveries/);
  assert.doesNotMatch(retention, /transactional_email_recipient_health/);
  assert.doesNotMatch(retention, /transactional_email_health_daily_snapshots/);
  assert.doesNotMatch(retention, /transactional_email_health_alert_states/);
  assert.doesNotMatch(retention, /notifications/);
});

test("retention is bounded in small batches", () => {
  assert.match(retention, /DELETE_BATCH_SIZE = 250/);
  assert.match(retention, /MAX_BATCHES_PER_RUN = 20/);
  assert.match(retention, /limit\(DELETE_BATCH_SIZE\)/);
  assert.match(retention, /batchLimitReached/);
});

test("daily email-health cron runs retention after monitoring and isolates cleanup failures", () => {
  assert.ok(
    cron.indexOf("refreshEmailHealthMonitoring") <
      cron.indexOf("pruneEmailTelemetry(admin)")
  );
  assert.match(cron, /try \{[\s\S]*pruneEmailTelemetry\(admin\)[\s\S]*catch \(retentionError\)/);
  assert.match(cron, /telemetryRetention/);
  assert.match(cron, /ok: true/);
});

test("email telemetry retention stays in critical prebuild contracts", () => {
  assert.equal(
    pkg.scripts["test:email-telemetry-retention"],
    "node --test __tests__/launch/email-telemetry-retention-213.test.mjs"
  );
  assert.match(
    pkg.scripts["test:critical-contracts"],
    /test:email-telemetry-retention/
  );
});
