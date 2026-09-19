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
  assert.match(hero, /familias y estudiantes de una misma comunidad/);
  assert.match(hero, /grid-cols-\[2\.5rem_1fr\]/);

  assert.match(how, /vincula tu colegio para encontrar material dentro de tu comunidad/);
  assert.match(how, /ponle precio o dónalo\./);
  assert.doesNotMatch(how, /dónalo!/);

  assert.match(families, /hasta un 50%/);
  assert.match(families, /libros de texto de segunda mano pueden encontrarse a mitad de precio/);
  assert.match(families, /Fuente: RTVE, 2026/);
  assert.doesNotMatch(families, /Wallapop/);
  assert.match(families, /priorizar la búsqueda directamente en tu comunidad/);
  assert.match(families, /chat con historial y registro de transacción/);

  assert.match(schools, /Participa en el marketplace/);
  assert.match(schools, /Activa tu comunidad/);
  assert.match(schools, /Actividad de la comunidad/);
  assert.match(schools, /sin acceder a conversaciones ni al detalle de acuerdos/);
  assert.match(schools, /Reportes e impacto/);
  assert.match(schools, /incluyendo datos de CO₂/);
  assert.doesNotMatch(schools, /PDF y CSV|reportes mensuales|CO₂e potencialmente evitado/);

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
  assert.match(help, /¿Qué información ofrece el panel del centro\?/);
  assert.match(help, /No muestra el contenido de conversaciones ni el detalle de acuerdos entre usuarios/);
  assert.match(help, /incluido CO₂ cuando existe una metodología verificable/);
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


test("school centre dashboard only exposes aggregate activity, not a transaction feed", () => {
  const dashboard = read("components/admin/school-admin-dashboard.tsx");
  const impact = read("components/landing/impact-section.tsx");

  assert.doesNotMatch(dashboard, /Últimos acuerdos confirmados/);
  assert.doesNotMatch(dashboard, /Ver anuncio/);
  assert.match(dashboard, /Artículos reutilizados/);
  assert.match(dashboard, /Indicador agregado de acuerdos confirmados/);

  assert.doesNotMatch(impact, /validar con familias reales|antes de añadir pagos|envíos o servicios profesionales/);
  assert.match(impact, /alargar la vida útil del material escolar/);
});
