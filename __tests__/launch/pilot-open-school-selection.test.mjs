import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("school linking remains optional and open to authenticated families in pilot", () => {
  const join = read("app/onboarding/join-school/page.tsx");
  const publicSchools = read("app/api/schools/public/route.ts");
  const qr = read("app/api/school/share-qr/route.ts");
  assert.match(join, /No tengo código, buscar centro/);
  assert.match(join, /Continuar sin centro por ahora/);
  assert.match(join, /if \(!user\)\s*\{\s*throw new Error\("Debes iniciar sesión para vincular el centro/);
  assert.match(join, /resolveSchoolFromId\(school\.id\)/);
  assert.match(join, /onClick=\{handleJoin\}/);
  assert.match(publicSchools, /\.eq\("is_active", true\)/);
  assert.match(qr, /getAuthPublicOrigin\(\)/);
  assert.match(qr, /onboarding\/join-school/);
  assert.doesNotMatch(join, /Debes validar primero un código de acceso activo/);
});

test("family onboarding and educational context do not claim verified membership", () => {
  const join = read("app/onboarding/join-school/page.tsx");
  const student = read("components/account-students/student-context-fields.tsx");
  assert.match(join, /Esto no verifica que pertenezcas a él/);
  assert.match(join, /no acredita pertenencia al colegio/);
  assert.match(join, /Tu cuenta tiene un centro seleccionado/);
  assert.doesNotMatch(join, /Tu cuenta ya pertenece a un centro/);
  assert.match(student, /no acredita que pertenezcas a él ni concede permisos/);
  assert.match(student, /Un colegio del directorio nacional no activa una comunidad/);
});

test("AMPA dashboard describes QR as an open school selection link", () => {
  const dashboard = read("components/admin/school-admin-dashboard.tsx");
  assert.match(dashboard, /permite seleccionar el centro sin verificar la pertenencia de la familia/);
  assert.match(dashboard, /Compartir QR/);
  assert.match(dashboard, /Descargar QR/);
});
