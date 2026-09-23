import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync("app/layout.tsx", "utf8");
const manifest = readFileSync("app/manifest.ts", "utf8");
const actions = readFileSync("components/admin/school-management-actions.tsx", "utf8");
const route = readFileSync("app/api/admin/delete-school/route.ts", "utf8");

test("favicon URLs are cache-busted so browsers request the current Wetudy icon", () => {
  assert.match(layout, /\/favicon\.ico\?v=20260923-2/);
  assert.match(layout, /\/icon\.svg\?v=20260923-2/);
  assert.match(layout, /\/apple-icon\.png\?v=20260923-2/);
  assert.match(manifest, /wetudy-icon-192\.png\?v=20260923-2/);
  assert.match(manifest, /wetudy-icon-512\.png\?v=20260923-2/);
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
