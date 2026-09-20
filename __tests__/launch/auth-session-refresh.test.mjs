import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rootProxy = readFileSync("proxy.ts", "utf8");
const sessionProxy = readFileSync("lib/supabase/proxy.ts", "utf8");

test("Next 16 proxy refreshes Supabase auth cookies", () => {
  assert.match(rootProxy, /export async function proxy/);
  assert.match(rootProxy, /updateSession\(request\)/);
  assert.match(rootProxy, /_next\/static/);
  assert.match(rootProxy, /_next\/image/);

  assert.match(sessionProxy, /createServerClient/);
  assert.match(sessionProxy, /request\.cookies\.getAll\(\)/);
  assert.match(sessionProxy, /request\.cookies\.set\(name, value\)/);
  assert.match(sessionProxy, /response\.cookies\.set\(name, value, options\)/);
  assert.match(sessionProxy, /supabase\.auth\.getClaims\(\)/);
  assert.doesNotMatch(sessionProxy, /getSession\(/);
});
