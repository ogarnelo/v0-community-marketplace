import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const routes = [
  "app/api/saved-searches/create/route.ts",
  "app/api/saved-searches/delete/route.ts",
  "app/api/transaction-issues/create/route.ts",
  "app/api/transaction-issues/close/route.ts",
  "app/api/boosts/create-checkout-session/route.ts",
];

test("important API routes exist and export POST", () => {
  for (const route of routes) {
    const path = join(root, route);
    assert.equal(existsSync(path), true, `${route} should exist`);
    const content = readFileSync(path, "utf8");
    assert.match(content, /export\s+async\s+function\s+POST/);
  }
});
