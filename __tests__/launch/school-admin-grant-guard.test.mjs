import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../lib/admin/school-admin-role.ts", import.meta.url), "utf8");

test("school administrator grants reject deactivated schools", () => {
  assert.match(source, /\.select\("id, is_active"\)/);
  assert.match(source, /school\.is_active === false/);
  assert.ok(source.indexOf("school.is_active === false") < source.indexOf('.from("user_roles")'));
});

test("school administrator grants reject a second school role", () => {
  assert.match(source, /\.neq\("school_id", params\.schoolId\)/);
  assert.match(source, /otherRoles\.length > 0/);
  assert.ok(source.indexOf("otherRoles.length > 0") < source.indexOf("if (!existingRole)"));
});
