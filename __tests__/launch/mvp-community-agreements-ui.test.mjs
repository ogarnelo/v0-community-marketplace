import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const exists = (path) => fs.existsSync(path);

test("agreement API routes exist", () => {
  for (const route of ["propose", "confirm", "cancel", "dispute", "review"]) {
    assert.ok(exists(`app/api/agreements/${route}/route.ts`), `${route} agreement API route should exist`);
  }
});

test("listing detail is centered on contact, not checkout", () => {
  const page = read("app/marketplace/listing/[id]/page.tsx");
  assert.match(page, /ContactSellerButton/, "listing detail should use ContactSellerButton");
  assert.doesNotMatch(page, /Comprar ahora<|Compra protegida en Wetudy/, "listing detail should not promote checkout in MVP");
  assert.match(page, /Acuerdo local con historial/, "listing detail should explain local agreements");
});

test("chat includes agreement panel", () => {
  const page = read("app/messages/[id]/page.tsx");
  assert.match(page, /AgreementPanel/, "message detail should render agreement panel");
  assert.match(page, /agreement_reviews/, "message detail should load agreement reviews");
});
