import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260921221916_growth_attribution_v1.sql", "utf8");
const route = readFileSync("app/api/analytics/acquisition/route.ts", "utf8");
const tracker = readFileSync("components/growth/acquisition-landing-tracker.tsx", "utf8");
const auth = readFileSync("components/auth/auth-form.tsx", "utf8");
const callback = readFileSync("app/auth/callback/route.ts", "utf8");
const demand = readFileSync("app/admin/super/demand/page.tsx", "utf8");
const demandHelper = readFileSync("lib/admin/demand-insights.ts", "utf8");
const shareListing = readFileSync("components/marketplace/share-listing-button.tsx", "utf8");
const schoolDashboard = readFileSync("components/admin/school-admin-dashboard.tsx", "utf8");
const agreement = readFileSync("components/agreements/agreement-panel.tsx", "utf8");
const publish = readFileSync("components/marketplace/new-listing-form.tsx", "utf8");
const privacy = readFileSync("app/privacy/page.tsx", "utf8");

test("growth attribution table is server-written and superadmin-readable", () => {
  assert.match(migration, /growth_acquisition_events/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.growth_acquisition_events from anon/);
  assert.match(migration, /revoke all on table public\.growth_acquisition_events from authenticated/);
  assert.match(migration, /grant select on table public\.growth_acquisition_events to authenticated/);
  assert.match(migration, /using \(public\.is_superadmin\(\)\)/);
  assert.match(migration, /growth_acquisition_events_conversion_entity_idx/);
});

test("acquisition captures UTM traffic and links confirmed signups", () => {
  assert.match(tracker, /utm_source|attributionFromSearchParams/);
  assert.match(route, /landing/);
  assert.match(route, /attributed_user/);
  assert.match(auth, /wetudy_acquisition_source/);
  assert.match(callback, /growth_acquisition_events/);
});

test("existing share loops carry attribution", () => {
  assert.match(shareListing, /campaign: "listing_share"/);
  assert.match(schoolDashboard, /campaign: "school_invite"/);
  assert.match(agreement, /campaign="agreement_confirmed"/);
  assert.match(publish, /published=1/);
});

test("super admin turns acquisition and repeated demand into decisions", () => {
  assert.match(demand, /Adquisición y conversión · 90 días/);
  assert.match(demand, /Oportunidades SEO basadas en demanda real/);
  assert.match(demandHelper, /buildSeoDemandOpportunities/);
  assert.match(demandHelper, /insight\.searches >= 2/);
  assert.match(demand, /no generan páginas automáticas/);
});

test("listing publication provides a non-blocking quality checklist", () => {
  assert.match(publish, /Calidad del anuncio/);
  assert.match(publish, /Título descriptivo/);
  assert.match(publish, /Descripción útil/);
  assert.match(publish, /ISBN exacto/);
  assert.match(publish, /no bloquean la publicación/);
});

test("privacy policy covers acquisition attribution without ad tracking", () => {
  assert.match(privacy, /fuente, medio o campaña de/);
  assert.match(privacy, /no almacena la dirección IP/);
  assert.match(privacy, /no utiliza cookies publicitarias/);
});
