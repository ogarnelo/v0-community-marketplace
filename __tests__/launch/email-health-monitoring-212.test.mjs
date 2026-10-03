import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20261003084538_transactional_email_health_monitoring.sql",
  "utf8"
);
const monitoring = readFileSync("lib/admin/email-health-monitoring.ts", "utf8");
const cron = readFileSync("app/api/cron/email-health/route.ts", "utf8");
const webhook = readFileSync("app/api/webhooks/resend/route.ts", "utf8");
const page = readFileSync("app/admin/super/email-health/page.tsx", "utf8");
const notifications = readFileSync("lib/notifications.ts", "utf8");
const navbarBell = readFileSync("components/notifications/navbar-notifications-bell.tsx", "utf8");
const activity = readFileSync("components/notifications/activity-notifications-list.tsx", "utf8");
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("email health snapshots and alert states are durable and service-only", () => {
  assert.match(migration, /transactional_email_health_daily_snapshots/);
  assert.match(migration, /snapshot_date date primary key/);
  assert.match(migration, /transactional_email_health_alert_states/);
  assert.match(migration, /metric in \('bounce_rate','complaint_rate'\)/);
  assert.match(migration, /generation integer not null default 0/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all[^;]*public, anon, authenticated/s);
  assert.match(migration, /to service_role/);
});

test("monitoring notifies only on inactive to active threshold crossings", () => {
  assert.match(monitoring, /nextActive && !wasActive/);
  assert.match(monitoring, /const nextGeneration = generation \+ 1/);
  assert.match(monitoring, /createNotificationOnce/);
  assert.match(monitoring, /email-health-alert\/\$\{params\.metric\}\/\$\{params\.generation\}\/\$\{userId\}/);
  assert.match(monitoring, /kind: "email_health_alert"/);
  assert.match(monitoring, /!nextActive && wasActive/);
  assert.match(monitoring, /type: "recovered"/);
});

test("a daily cron persists snapshots and evaluates recovery", () => {
  assert.match(cron, /process\.env\.CRON_SECRET/);
  assert.match(cron, /refreshEmailHealthMonitoring/);
  const job = vercel.crons.find((item) => item.path === "/api/cron/email-health");
  assert.deepEqual(job, {
    path: "/api/cron/email-health",
    schedule: "0 7 * * *",
  });
});

test("bounce and complaint webhooks trigger immediate crossing evaluation without breaking webhook ACK", () => {
  assert.match(webhook, /event\.type === "email\.bounced"/);
  assert.match(webhook, /event\.type === "email\.complained"/);
  assert.match(webhook, /refreshEmailHealthMonitoring/);
  assert.match(webhook, /catch \(monitoringError\)/);
  assert.match(webhook, /return NextResponse\.json\(\{ ok: true, \.\.\.result \}\)/);
});

test("Super Admin shows persistent alert state and daily history", () => {
  assert.match(page, /loadEmailHealthHistory/);
  assert.match(page, /loadEmailHealthAlertStates/);
  assert.match(page, /Histórico diario/);
  assert.match(page, /Ciclos de alerta/);
  assert.match(page, /Wetudy avisa solo al pasar de normal a superar el umbral/);
});

test("email health notifications route back to the admin dashboard", () => {
  assert.match(notifications, /notification\.kind === "email_health_alert"/);
  assert.match(notifications, /return "\/admin\/super\/email-health"/);
  assert.match(navbarBell, /case "email_health_alert":/);
  assert.match(activity, /case "email_health_alert":/);
});

test("email health monitoring stays in critical prebuild contracts", () => {
  assert.equal(
    pkg.scripts["test:email-health-monitoring"],
    "node --test __tests__/launch/email-health-monitoring-212.test.mjs"
  );
  assert.match(pkg.scripts["test:critical-contracts"], /test:email-health-monitoring/);
});
