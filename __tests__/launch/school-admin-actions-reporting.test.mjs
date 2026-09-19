import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("superadmin can manage approved centres from mobile overview and full list", () => {
  const dashboard = read("components/admin/super-admin-dashboard.tsx");
  const listPage = read("app/admin/super/schools/page.tsx");
  const actions = read("components/admin/school-management-actions.tsx");
  const toggleRoute = read("app/api/admin/toggle-school-active/route.ts");

  assert.match(dashboard, /SchoolManagementActions/);
  assert.match(dashboard, /Gestionar centro/);
  assert.match(listPage, /SchoolManagementActions/);
  assert.match(listPage, /grid gap-4 lg:grid-cols-2/);
  assert.match(actions, /Reenviar acceso/);
  assert.match(actions, /Desactivar centro/);
  assert.match(actions, /Reactivar centro/);
  assert.match(actions, /w-full sm:w-auto/);
  assert.match(toggleRoute, /eq\("role", "super_admin"\)/);
  assert.match(toggleRoute, /from\("schools"\)/);
  assert.match(toggleRoute, /from\("school_access_codes"\)/);
  assert.match(toggleRoute, /school_impact_report_subscriptions/);
});

test("school impact dashboard supports direct PDF export and monthly email scheduling", () => {
  const dashboard = read("components/admin/school-admin-dashboard.tsx");
  const pdfRoute = read("app/api/school/impact-report/route.ts");
  const reportLib = read("lib/reports/school-impact-report.ts");
  const subscriptionRoute = read("app/api/school/report-subscription/route.ts");
  const cronRoute = read("app/api/cron/school-impact-reports/route.ts");
  const email = read("lib/emails/school-impact-report-email.ts");
  const brand = read("lib/emails/brand.ts");
  const vercel = read("vercel.json");

  assert.match(dashboard, /Exportar informe a PDF/);
  assert.match(dashboard, /Informe mensual automático/);
  assert.match(dashboard, /Guardar programación/);
  assert.match(dashboard, /api\/school\/report-subscription/);
  assert.match(dashboard, /api\/school\/impact-report\?range=/);

  assert.match(pdfRoute, /Content-Type": "application\/pdf"/);
  assert.match(pdfRoute, /renderSchoolImpactPdf/);
  assert.match(reportLib, /SCHOOL_BOOK_CO2E_KG = 2\.1/);
  assert.match(reportLib, /monthlyImpact/);
  assert.match(reportLib, /buildVisualImpactPage/);
  assert.match(reportLib, /Composición de la reutilización/);
  assert.match(reportLib, /Evolución mensual de reutilización/);
  assert.match(reportLib, /if \(report\.reusedItems <= 0\) return null/);
  assert.match(reportLib, /monthly\.length >= 2/);
  assert.match(reportLib, /%PDF-1\.4/);
  assert.match(subscriptionRoute, /dayOfMonth/);
  assert.match(subscriptionRoute, /school_admin/);
  assert.match(cronRoute, /process\.env\.CRON_SECRET/);
  assert.match(cronRoute, /previousCalendarMonth/);
  assert.match(email, /application\/pdf/);
  assert.match(brand, /attachments\?/);
  assert.match(vercel, /school-impact-reports/);
  assert.match(vercel, /0 6 \* \* \*/);
});

test("monthly subscriptions are service-only and idempotent by school and user", () => {
  const migration = read("supabase/migrations/20260919072000_school_impact_report_subscriptions.sql");

  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all.*authenticated/is);
  assert.match(migration, /grant select, insert, update, delete.*service_role/is);
  assert.match(migration, /unique \(school_id, user_id\)/);
  assert.match(migration, /day_of_month between 1 and 28/);
  assert.match(migration, /last_sent_month/);
});
