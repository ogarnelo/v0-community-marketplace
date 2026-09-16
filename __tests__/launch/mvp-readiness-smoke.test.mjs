import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const script = fs.readFileSync("scripts/mvp-readiness.mjs", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const about = fs.readFileSync("app/about/page.tsx", "utf8");

test("MVP readiness command points to the public smoke script", () => {
  assert.equal(pkg.scripts["mvp:ready"], "node scripts/mvp-readiness.mjs https://www.wetudy.com");
  assert.match(script, /publicRoutes/);
  for (const route of ["/marketplace", "/auth", "/help", "/privacy", "/terms", "/about"]) {
    assert.match(script, new RegExp(route.replace("/", "\\/")));
  }
});

test("readiness enforces launch positioning on public pages", () => {
  assert.match(script, /La entrega y el pago se acuerdan directamente entre las partes\./);
  assert.match(script, /fuera de Wetudy\|fuera de la plataforma\|miles de familias/i);
  assert.doesNotMatch(about, /miles de familias|fuera de Wetudy|fuera de la plataforma/i);
  assert.match(about, /La entrega y el pago se acuerdan directamente entre las partes\./);
});
