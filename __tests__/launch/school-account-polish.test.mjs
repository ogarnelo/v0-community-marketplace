import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("school invitation passwords are masked by default with explicit visibility controls", () => {
  const form = read("components/auth/complete-school-invite-form.tsx");

  assert.match(form, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(form, /type=\{showRepeatPassword \? "text" : "password"\}/);
  assert.match(form, /Mostrar contraseña/);
  assert.match(form, /Ocultar contraseña/);
  assert.match(form, /EyeOff/);
});

test("school admins see their own centre code instead of centre-linking controls", () => {
  const page = read("app/account/page.tsx");
  const form = read("components/account/account-profile-form.tsx");

  assert.match(page, /role === "school_admin"/);
  assert.match(page, /managedSchoolAccessCode/);
  assert.match(page, /from\("school_access_codes"\)/);

  assert.match(form, /isSchoolAdmin \?/);
  assert.match(form, /Tu centro en Wetudy/);
  assert.match(form, /Código de tu centro/);
  assert.match(form, /Comparte el código con familias y usuarios/);
  assert.match(form, /Copiar código/);
  assert.match(form, /Compartir código/);
  assert.match(form, /isSchoolAdmin\s*\?\s*managedSchoolId\.trim\(\)/);
});

test("impact PDF opens separately and adds charts only when data exists", () => {
  const dashboard = read("components/admin/school-admin-dashboard.tsx");
  const route = read("app/api/school/impact-report/route.ts");
  const report = read("lib/reports/school-impact-report.ts");

  assert.match(dashboard, /target="_blank"/);
  assert.match(dashboard, /noopener noreferrer/);
  assert.match(route, /inline; filename/);
  assert.match(report, /const hasChartData/);
  assert.match(report, /Gráficos de impacto/);
  assert.match(report, /Acuerdos confirmados/);
  assert.match(report, /Actividad y alcance/);
  assert.match(report, /drawHorizontalBars/);
  assert.match(report, /if \(hasChartData\)/);
});
