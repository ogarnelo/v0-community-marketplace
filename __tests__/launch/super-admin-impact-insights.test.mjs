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
