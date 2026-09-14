import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const marketplaceClient = fs.readFileSync("components/marketplace/marketplace-client.tsx", "utf8");
const agreementPanel = fs.readFileSync("components/agreements/agreement-panel.tsx", "utf8");
const proposeRoute = fs.readFileSync("app/api/agreements/propose/route.ts", "utf8");
const activityPage = fs.readFileSync("app/account/activity/page.tsx", "utf8");
const footer = fs.readFileSync("components/footer.tsx", "utf8");
const landingBenefits = fs.readFileSync("components/landing/benefits-families.tsx", "utf8");

describe("UX hotfix 26", () => {
  it("uses a single community filter and moves distance into filters", () => {
    assert.match(marketplaceClient, /Solo mi comunidad/);
    assert.match(marketplaceClient, /Ubicación y distancia/);
    assert.match(marketplaceClient, /\+200 km/);
    assert.doesNotMatch(marketplaceClient, /Todos los anuncios/);
  });

  it("replaces the sluggish price slider with inputs and presets", () => {
    assert.match(marketplaceClient, /PRICE_PRESETS/);
    assert.match(marketplaceClient, /0-25 €/);
    assert.match(marketplaceClient, /100-200 €/);
    assert.doesNotMatch(marketplaceClient, /<Slider value=\{priceRange\}/);
  });

  it("removes fuera de Wetudy copy from user-facing agreement surfaces", () => {
    const combined = [agreementPanel, proposeRoute, landingBenefits].join("\n");
    assert.doesNotMatch(combined, /fuera de Wetudy/i);
    assert.doesNotMatch(combined, /fuera de la plataforma/i);
    assert.match(agreementPanel, /Confirmar acuerdo entre partes/);
    assert.match(agreementPanel, /La entrega y el pago se acuerdan directamente entre las partes/);
  });

  it("aligns activity and footer with MVP no-checkout positioning", () => {
    assert.match(activityPage, /conversaciones, propuestas, donaciones y acuerdos confirmados/);
    assert.doesNotMatch(activityPage, /Ventas cobradas/);
    assert.doesNotMatch(activityPage, /Envíos de mis compras/);
    assert.match(footer, /Añadir centro/);
    assert.match(footer, /La entrega y el pago se acuerdan directamente entre las partes/);
  });
});
