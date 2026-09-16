import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

test("landing copy does not claim fake launch metrics or closed-only school scope", () => {
  const hero = read("components/landing/hero-section.tsx");
  const families = read("components/landing/benefits-families.tsx");
  const impact = read("components/landing/impact-section.tsx");
  const howItWorks = read("components/landing/how-it-works.tsx");
  const cta = read("components/landing/cta-section.tsx");

  for (const source of [hero, families, impact, howItWorks, cta]) {
    assert.doesNotMatch(source, /120 centros/i);
    assert.doesNotMatch(source, /2\.500\+|2500\+/i);
    assert.doesNotMatch(source, /1\.200\+|1200\+/i);
    assert.doesNotMatch(source, /45\.000/i);
    assert.doesNotMatch(source, /miles de familias/i);
    assert.doesNotMatch(source, /Solo interact/u);
    assert.doesNotMatch(source, /fuera de Wetudy|fuera de la plataforma/i);
  }

  assert.match(hero, /La entrega y el pago se acuerdan directamente entre las partes\./);
  assert.match(howItWorks, /La entrega y el pago se acuerdan directamente entre las partes\./);
  assert.match(families, /colegio o tu zona/i);
});

test("professional seller signup and publishing are disabled for MVP", () => {
  const auth = read("components/auth/auth-form.tsx");
  const newListing = read("app/marketplace/new/page.tsx");

  assert.doesNotMatch(auth, /<SelectItem value="business">/);
  assert.match(auth, /vendedor profesional no están activas|vendedor profesional no esta activas|profesional.*MVP/i);
  assert.match(newListing, /typedProfile\?\.user_type === "business"/);
  assert.match(newListing, /vendedores profesionales aún no están activos/i);
});
