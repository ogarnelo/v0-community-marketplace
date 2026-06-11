import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("transaction velocity admin page has direct auth guard", () => {
  const file = "app/admin/super/transaction-velocity/page.tsx";
  assert.ok(fs.existsSync(file), "transaction velocity admin page must exist");

  const source = fs.readFileSync(file, "utf8");

  assert.match(source, /auth\.getUser\(\)/, "page must read the authenticated user directly");
  assert.match(source, /canAccessSuperadmin/, "page must verify superadmin access directly");
  assert.match(source, /redirect\(["']\/admin\/login["']\)/, "logged-out users must redirect to admin login");
  assert.match(source, /redirect\(["']\/account["']\)/, "non-superadmins must redirect to account");
});
