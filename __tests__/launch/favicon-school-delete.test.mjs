import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync("app/layout.tsx", "utf8");
const manifest = readFileSync("app/manifest.ts", "utf8");
const actions = readFileSync("components/admin/school-management-actions.tsx", "utf8");
const route = readFileSync("app/api/admin/delete-school/route.ts", "utf8");

test("favicon URLs stay stable so search engines can refresh the Wetudy icon", () => {
  assert.match(layout, /\/favicon\.ico/);
  assert.match(layout, /\/icon\.svg/);
  assert.match(layout, /\/apple-icon\.png/);
  assert.match(manifest, /wetudy-icon-192\.png/);
  assert.match(manifest, /wetudy-icon-512\.png/);
  assert.doesNotMatch(layout, /\?v=/);
  assert.doesNotMatch(manifest, /\?v=/);
});

test("super admin school actions expose a destructive delete action", () => {
  assert.match(actions, /Eliminar centro/);
  assert.match(actions, /Trash2/);
  assert.match(actions, /\/api\/admin\/delete-school/);
  assert.match(actions, /Desactiva primero el centro antes de eliminarlo/);
});

test("school deletion is guarded against active or referenced schools", () => {
  assert.match(route, /school\.is_active !== false/);
  assert.match(route, /from\("profiles"\)/);
  assert.match(route, /from\("listings"\)/);
  assert.match(route, /from\("school_admins"\)/);
  assert.match(route, /from\("user_roles"\)/);
  assert.match(route, /Object\.values\(blockers\)\.some/);
  assert.match(route, /from\("schools"\)[\s\S]*\.delete\(\)/);
});
