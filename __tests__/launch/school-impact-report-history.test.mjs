import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("school impact report deliveries are recorded and displayed", () => {
  const migration = read("supabase/migrations/20260919084500_school_impact_report_deliveries.sql");
  const manual = read("app/api/school/send-impact-report/route.ts");
  const cron = read("app/api/cron/school-impact-reports/route.ts");
  const page = read("app/admin/school/page.tsx");
  const dashboard = read("components/admin/school-admin-dashboard.tsx");

  assert.match(migration, /school_impact_report_deliveries/);
  assert.match(migration, /on delete set null/i);
  assert.match(migration, /source in \('manual','cron'\)/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /service_role/i);

  assert.match(manual, /source: "manual"/);
  assert.match(cron, /source: "cron"/);
  assert.match(manual, /provider_message_id/);
  assert.match(cron, /provider_message_id/);

  assert.match(page, /school_impact_report_deliveries/);
  assert.match(page, /reportDeliveries=/);
  assert.match(dashboard, /Historial de informes/);
  assert.match(dashboard, /Próximo envío automático/);
  assert.match(dashboard, /Automático/);
});
