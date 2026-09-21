import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("privacy policy covers the real MVP data flows without inventing a legal entity", () => {
  const privacy = read("app/privacy/page.tsx");

  assert.match(privacy, /hola@wetudy\.com/);
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /Vercel/);
  assert.match(privacy, /Resend/);
  assert.match(privacy, /Cloudflare Turnstile/);
  assert.match(privacy, /Transferencias internacionales/);
  assert.match(privacy, /Menores de edad/);
  assert.match(privacy, /Agencia Española de Protección de Datos/);
  assert.doesNotMatch(privacy, /Wetudy SL/);
});

test("terms describe the current direct-agreement MVP and moderation duties", () => {
  const terms = read("app/terms/page.tsx");

  assert.match(terms, /La entrega y el pago se acuerdan directamente entre las partes/);
  assert.match(terms, /no procesa actualmente el pago/);
  assert.match(terms, /notificación de contenido presuntamente ilícito/);
  assert.match(terms, /comunicará los motivos/);
  assert.doesNotMatch(terms, /fuera de Wetudy/i);
  assert.doesNotMatch(terms, /Wetudy SL/);
});

test("signup accepts terms while privacy remains informational", () => {
  const auth = read("components/auth/auth-form.tsx");

  assert.match(auth, /acceptedTerms/);
  assert.match(auth, /studentAgeConfirmed/);
  assert.match(auth, /14 años o más/);
  assert.match(auth, /Acepto los/);
  assert.match(auth, /confirmo que he leído la/);
  assert.match(auth, /\/terms/);
  assert.match(auth, /\/privacy/);
});

test("illegal-content notices are public, noindex and server-gated", () => {
  const page = read("app/legal/notificar-contenido/page.tsx");
  const form = read("components/legal/illegal-content-notice-form.tsx");
  const route = read("app/api/legal/content-notices/route.ts");
  const migration = read("supabase/migrations/20260921214500_legal_notice_support_fields.sql");
  const footer = read("components/footer.tsx");
  const listingReport = read("components/marketplace/report-listing-button.tsx");

  assert.match(page, /index: false/);
  assert.match(form, /goodFaith/);
  assert.match(form, /identityOmitted/);
  assert.match(route, /normalizeWetudyContentUrl/);
  assert.match(route, /sendIllegalContentNoticeReceiptEmail/);
  assert.match(route, /kind: "illegal_content_notice"/);
  assert.match(migration, /identity_omitted/);
  assert.match(migration, /alter column name drop not null/);
  assert.match(footer, /\/legal\/notificar-contenido/);
  assert.match(listingReport, /notificación legal sin iniciar sesión/);
});

test("legal audit keeps unresolved identity and moderation workflow explicit", () => {
  const audit = read("docs/LEGAL_REVIEW_20260921.md");

  assert.match(audit, /Identidad legal del prestador y responsable — PENDIENTE/);
  assert.match(audit, /PROCEDIMIENTO OPERATIVO PENDIENTE DE AUTOMATIZAR/);
  assert.match(audit, /Leaked Password Protection permanece pendiente/);
});
