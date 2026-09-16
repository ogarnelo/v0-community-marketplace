import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const script = fs.readFileSync("scripts/mvp-readiness.mjs", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

test("MVP readiness command points to the public smoke script", () => {
  assert.equal(pkg.scripts["mvp:ready"], "node scripts/mvp-readiness.mjs https://www.wetudy.com");
  assert.match(script, /publicRoutes/);
  for (const route of ["/marketplace", "/auth", "/help", "/privacy", "/terms"]) {
    assert.match(script, new RegExp(route.replace("/", "\\/")));
  }
});

test("readiness enforces launch positioning on the home page", () => {
  assert.match(script, /La entrega y el pago se acuerdan directamente entre las partes\./);
  assert.match(script, /fuera de Wetudy\|fuera de la plataforma\|miles de familias/i);
});
