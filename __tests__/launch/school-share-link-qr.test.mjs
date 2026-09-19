import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("school admins can share a direct centre link and QR", () => {
  const dashboard = read("components/admin/school-admin-dashboard.tsx");
  const account = read("components/account/account-profile-form.tsx");
  const qrRoute = read("app/api/school/share-qr/route.ts");
  const pkg = read("package.json");

  assert.match(dashboard, /Enlace directo recomendado/);
  assert.match(dashboard, /Compartir centro/);
  assert.match(dashboard, /QR del centro/);
  assert.match(dashboard, /\/api\/school\/share-qr/);

  assert.match(account, /Copiar enlace/);
  assert.match(account, /Compartir centro/);
  assert.match(account, /centro ya seleccionado/);

  assert.match(qrRoute, /QRCode\.toString/);
  assert.match(qrRoute, /school_admin/);
  assert.match(qrRoute, /onboarding\/join-school/);
  assert.match(qrRoute, /image\/svg\+xml/);
  assert.match(pkg, /"qrcode": "\^1\.5\.4"/);
});

test("shared centre links preselect an active school and preserve it through signup", () => {
  const joinPage = read("app/onboarding/join-school/page.tsx");
  const publicSchoolsRoute = read("app/api/schools/public/route.ts");

  assert.match(joinPage, /params\.get\("school"\)/);
  assert.match(joinPage, /\/api\/schools\/public\?id=/);
  assert.doesNotMatch(joinPage, /\.from\("schools"\)/);
  assert.match(joinPage, /Preparando el centro/);
  assert.match(joinPage, /auth\?mode=signup&next=/);
  assert.match(joinPage, /resolveSchoolFromId/);

  assert.match(publicSchoolsRoute, /createAdminClient/);
  assert.match(publicSchoolsRoute, /eq\("is_active", true\)/);
  assert.match(publicSchoolsRoute, /select\("id, name, city"\)/);
  assert.doesNotMatch(publicSchoolsRoute, /school_access_codes/);
});

test("school search can link users without requiring a code", () => {
  const joinPage = read("app/onboarding/join-school/page.tsx");

  assert.match(joinPage, /tócalo para vincular tu cuenta/);
  assert.match(joinPage, /setFound\(school\)/);
  assert.doesNotMatch(joinPage, /Debes validar primero un código de acceso activo/);
});
