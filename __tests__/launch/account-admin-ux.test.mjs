import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("marketplace sliders use fine-grained values and deferred filtering", () => {
  const source = read("components/marketplace/marketplace-client.tsx");
  assert.match(source, /useDeferredValue/);
  assert.match(source, /step=\{1\} value=\{priceRange\}/);
  assert.match(source, /max=\{DISTANCE_MAX\} step=\{1\}/);
  assert.doesNotMatch(source, /DISTANCE_OPTIONS/);
});

test("listing detail keeps price in the summary instead of duplicating it in the description card", () => {
  const source = read("app/marketplace/listing/[id]/page.tsx");
  assert.match(source, /<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumen<\/p>/);
  assert.doesNotMatch(source, /bg-slate-950 px-5 py-4 text-white/);
});

test("account exposes password security settings", () => {
  const account = read("app/account/page.tsx");
  const security = read("app/account/security/page.tsx");
  const form = read("components/account/change-password-form.tsx");
  assert.match(account, /\/account\/security/);
  assert.match(security, /ChangePasswordForm/);
  assert.match(form, /auth\.updateUser\(\{ password \}\)/);
});

test("superadmin exposes complete centres and users directories", () => {
  const dashboard = read("app/admin/super/page.tsx");
  const users = read("app/admin/super/users/page.tsx");
  const schools = read("app/admin/super/schools/page.tsx");
  assert.match(dashboard, /Todos los centros/);
  assert.match(dashboard, /Todos los usuarios/);
  assert.match(users, /Fecha de creación/);
  assert.match(users, /auth\.admin\.listUsers/);
  assert.match(schools, /Listado completo de centros activos/);
});

test("footer explains the two different school actions", () => {
  const footer = read("components/footer.tsx");
  assert.match(footer, /Vincular mi centro/);
  assert.match(footer, /Solicitar alta de un centro/);
});
