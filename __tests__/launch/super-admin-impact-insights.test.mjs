import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Super Admin exposes global sustainability and demand dashboards", () => {
  const page = read("app/admin/super/page.tsx");
  assert.match(page, /\/admin\/super\/sustainability/);
  assert.match(page, /Impacto y sostenibilidad/);
  assert.match(page, /\/admin\/super\/demand/);
  assert.match(page, /Insights y demanda/);
});

test("global impact dashboard uses aggregate measured data and explicit methodology", () => {
  const page = read("app/admin/super/sustainability/page.tsx");
  const report = read("lib/reports/super-admin-report.ts");

  assert.match(page, /Artículos reutilizados confirmados/);
  assert.match(page, /CO₂e potencialmente evitado/);
  assert.match(page, /El panel es agregado/);
  assert.match(report, /\.eq\("status", "confirmed"\)/);
  assert.match(report, /SCHOOL_BOOK_CO2E_KG/);
  assert.match(report, /unquantifiedItems/);
  assert.doesNotMatch(report, /messages|conversations/);
});

test("Super Admin report exports PDF and CSV behind super-admin authorization", () => {
  const route = read("app/api/admin/super/report/route.ts");
  const report = read("lib/reports/super-admin-report.ts");

  assert.match(route, /\.eq\("role", "super_admin"\)/);
  assert.match(route, /Content-Type": "application\/pdf"/);
  assert.match(route, /Content-Type": "text\/csv/);
  assert.match(report, /renderSuperAdminPdf/);
  assert.match(report, /renderSuperAdminCsv/);
  assert.match(report, /topSignals/);
});

test("demand dashboard is integrated into primary Super Admin shell", () => {
  const page = read("app/admin/super/demand/page.tsx");
  assert.match(page, /Volver al Super Admin/);
  assert.doesNotMatch(page, /dashboard MVP/);
  assert.match(page, /getNavbarData/);
  assert.match(page, /Informe PDF/);
  assert.match(page, /Insights y demanda/);
});


test("Super Admin can subscribe to aggregate reports every 7, 15 or 30 days", () => {
  const migration = read("supabase/migrations/20260920211000_super_admin_report_subscriptions.sql");
  const route = read("app/api/admin/super/report-subscription/route.ts");
  const cron = read("app/api/cron/super-admin-reports/route.ts");
  const email = read("lib/emails/super-admin-report-email.ts");
  const form = read("components/admin/super-admin-report-subscription-form.tsx");
  const page = read("app/admin/super/sustainability/page.tsx");
  const vercel = read("vercel.json");

  assert.match(migration, /frequency_days in \(7, 15, 30\)/);
  assert.match(migration, /report_format in \('pdf', 'csv', 'both'\)/);
  assert.match(migration, /revoke all .* from anon, authenticated/);
  assert.match(route, /ALLOWED_FREQUENCIES = new Set\(\[7, 15, 30\]\)/);
  assert.match(route, /\.eq\("role", "super_admin"\)/);
  assert.match(cron, /CRON_SECRET/);
  assert.match(cron, /\.lte\("next_send_at", nowIso\)/);
  assert.match(email, /attachments/);
  assert.match(email, /renderSuperAdminPdf/);
  assert.match(email, /renderSuperAdminCsv/);
  assert.match(form, /Cada 7 días/);
  assert.match(form, /Cada 15 días/);
  assert.match(form, /Cada 30 días/);
  assert.match(page, /Informe periódico por email/);
  assert.match(vercel, /\/api\/cron\/super-admin-reports/);
});
