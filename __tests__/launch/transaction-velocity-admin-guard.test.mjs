import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("transaction velocity admin route has its own server guard layout", () => {
  const file = "app/admin/super/transaction-velocity/layout.tsx";

  assert.ok(
    fs.existsSync(file),
    "app/admin/super/transaction-velocity/layout.tsx must exist to prevent route-specific public exposure"
  );

  const source = fs.readFileSync(file, "utf8");

  assert.match(source, /auth\.getUser\(\)/, "guard must read the authenticated user");
  assert.match(source, /canAccessSuperadmin/, "guard must verify superadmin access");
  assert.match(source, /redirect\(["']\/admin\/login["']\)/, "logged-out users must redirect to admin login");
  assert.match(source, /redirect\(["']\/account["']\)/, "non-superadmin users must redirect away from admin");
});
