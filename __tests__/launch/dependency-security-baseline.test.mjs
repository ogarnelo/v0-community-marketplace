import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));

test("Next.js stays on the audited security baseline", () => {
  assert.equal(pkg.dependencies.next, "16.3.5");
  assert.equal(pkg.optionalDependencies["@next/swc-linux-x64-gnu"], "16.3.5");
  assert.equal(pkg.optionalDependencies["@next/swc-linux-x64-musl"], "16.3.5");
});

test("production install does not keep the temporary audit diagnostic", () => {
  assert.equal(vercel.installCommand, "npm install --legacy-peer-deps");
  assert.doesNotMatch(vercel.installCommand, /npm audit/);
});
