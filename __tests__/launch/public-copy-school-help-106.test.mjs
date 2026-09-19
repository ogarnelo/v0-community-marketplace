import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("home copy reflects community, schools and current product language", () => {
  const hero = read("components/landing/hero-section.tsx");
  const how = read("components/landing/how-it-works.tsx");
  const families = read("components/landing/benefits-families.tsx");
  const schools = read("components/landing/benefits-schools.tsx");
  const cta = read("components/landing/cta-section.tsx");
  const footer = read("components/footer.tsx");

  assert.match(hero, /Compra, vende y dona material escolar en/);
  assert.match(hero, /text-primary">comunidad/);
  assert.match(hero, /fomentando el ahorro y la sostenibilidad/);

  assert.match(how, /vincula tu colegio para encontrar material dentro de tu comunidad/);
  assert.match(how, /ponle precio o dónalo!/);

  assert.match(families, /ahorro medio del 21%/);
  assert.match(families, /Fuente: OCU, 2026/);
  assert.match(families, /priorizar la búsqueda directamente en tu comunidad/);
  assert.match(families, /chat con historial y registro de transacción/);

  assert.match(schools, /Participa en el marketplace/);
  assert.match(schools, /Activa tu comunidad/);
  assert.match(schools, /Seguimiento de acuerdos/);
  assert.match(schools, /Reportes e impacto/);

  assert.match(cta, /Únete a Wetudy para encontrar y reutilizar material escolar/);
  assert.match(footer, /Compra, vende y dona material escolar en comunidad/);
  assert.match(footer, />\s*2026 Wetudy\s*</);
  assert.doesNotMatch(footer, /La entrega y el pago se acuerdan directamente/);
});

test("about and help avoid launch-only language and explain school capabilities", () => {
  const about = read("app/about/page.tsx");
  const help = read("app/help/page.tsx");

  assert.match(about, /Impacto y aprendizaje de la comunidad/);
  assert.match(about, /Reutilización y sostenibilidad/);
  assert.match(about, /Forma parte del cambio/);
  assert.doesNotMatch(about, /Qué aprendemos durante el MVP/);

  assert.match(help, /Colegios y AMPAs/);
  assert.match(help, /¿Cómo puede un colegio o AMPA crear una cuenta en Wetudy\?/);
  assert.match(help, /¿Qué puede hacer un colegio o AMPA con su cuenta\?/);
  assert.match(help, /programar un informe mensual por email/);
  assert.doesNotMatch(help, /En el MVP Wetudy facilita/);
  assert.doesNotMatch(help, /precio orientativo/i);
});

test("user-facing sale labels say price, not indicative price", () => {
  const mobileActions = read("components/marketplace/mobile-listing-actions.tsx");
  const agreementPanel = read("components/agreements/agreement-panel.tsx");

  assert.match(mobileActions, /"Donación" : "Precio"/);
  assert.doesNotMatch(mobileActions, /Precio orientativo/);
  assert.match(agreementPanel, />Precio: \{formatPrice/);
  assert.doesNotMatch(agreementPanel, /Precio orientativo/);
});

test("mobile layout reduces excessive first-section top spacing", () => {
  const hero = read("components/landing/hero-section.tsx");
  const globals = read("app/globals.css");

  assert.match(hero, /pb-14 pt-8 sm:pt-12/);
  assert.match(globals, /main\s*> :first-child/);
  assert.match(globals, /padding-top: 2rem !important/);
  assert.match(globals, /\[class~='py-16'\]/);
});
