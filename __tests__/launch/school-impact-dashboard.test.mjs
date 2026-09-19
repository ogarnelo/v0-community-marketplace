import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("school dashboard exposes measurable and reportable sustainability impact", () => {
  const page = read("app/admin/school/page.tsx");
  const dashboard = read("components/admin/school-admin-dashboard.tsx");

  assert.match(page, /from\("agreements"\)/);
  assert.match(page, /agreement_type, status, amount, confirmed_at, created_at/);
  assert.match(page, /agreements=\{safeAgreements\}/);
  assert.match(page, /estimated_retail_price/);
  assert.match(page, /isbn/);

  assert.match(dashboard, /Informe de impacto del centro/);
  assert.match(dashboard, /CO₂e potencialmente evitado/);
  assert.match(dashboard, /SCHOOL_BOOK_CO2E_KG = 2\.1/);
  assert.match(dashboard, /carbonfootprintitaly\.it/);
  assert.match(dashboard, /ghgprotocol\.org\/estimating-and-reporting-avoided-emissions/);
  assert.match(dashboard, /emisión potencialmente evitada/);
  assert.match(dashboard, /No se resta de la huella de carbono propia/);
  assert.match(dashboard, /Descargar CSV de impacto/);
  assert.match(dashboard, /Imprimir \/ guardar PDF/);
  assert.match(dashboard, /Miembros vinculados al centro/);
  assert.match(dashboard, /Valor de ventas acordadas/);
  assert.match(dashboard, /grid h-auto w-full grid-cols-2/);
});

test("school dashboard only estimates CO2e for identifiable books", () => {
  const dashboard = read("components/admin/school-admin-dashboard.tsx");

  assert.match(dashboard, /if \(listing\.isbn\?\.trim\(\)\) return true/);
  assert.match(dashboard, /unquantifiedItems/);
  assert.match(dashboard, /otros materiales se muestran como reutilizados/i);
});
