import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath = "app/admin/super/mvp/page.tsx";

test("MVP admin dashboard route exists", () => {
  assert.ok(fs.existsSync(pagePath), "admin MVP dashboard page should exist");
});

test("MVP admin dashboard tracks the launch funnel", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /Dashboard MVP/, "dashboard should have MVP-focused title");
  assert.match(source, /Embudo MVP/, "dashboard should include funnel section");
  assert.match(source, /Anuncios → contacto/, "dashboard should track listing-to-contact conversion");
  assert.match(source, /Contactos → acuerdo/, "dashboard should track contact-to-agreement conversion");
  assert.match(source, /Acuerdos → confirmados/, "dashboard should track agreement confirmation");
});

test("MVP admin dashboard includes operational attention signals", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /Reportes abiertos/, "dashboard should surface open reports");
  assert.match(source, /Acuerdos disputados/, "dashboard should surface disputes");
  assert.match(source, /Anuncios sin foto/, "dashboard should surface listings without photos");
  assert.match(source, /Usuarios orgánicos/, "dashboard should highlight organic users");
  assert.match(source, /Actividad reciente/, "dashboard should include recent activity timeline");
});
