import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const panel = read("components/agreements/agreement-panel.tsx");
const detail = read("app/messages/[id]/page.tsx");
const state = read("components/messages/conversation-listing-state.tsx");
const eventEmails = read("lib/emails/mvp-event-emails.ts");
const transactionalEmails = read("lib/emails/transactional.ts");
const guard = read("components/auth/session-inactivity-guard.tsx");
const origin = read("lib/auth/public-origin.ts");
const messages = read("app/messages/page.tsx");
const account = read("app/account/page.tsx");
const listings = read("app/account/listings/page.tsx");
const activity = read("app/account/activity/page.tsx");
const favorites = read("app/favorites/page.tsx");

test("agreement UX reads like a simple marketplace proposal", () => {
  assert.match(panel, /Has pedido esta donación/);
  assert.match(panel, /quiere quedarse con este artículo/);
  assert.match(panel, /Aceptar donación/);
  assert.match(panel, /Aceptar oferta/);
  assert.match(panel, /Proponer otro precio/);
  assert.match(panel, /Retirar oferta/);
  assert.match(panel, /Rechazar/);
  assert.doesNotMatch(panel, /Comprador confirmado/);
  assert.doesNotMatch(panel, /Vendedor pendiente/);
  assert.doesNotMatch(panel, /Confirmar mi parte/);
});

test("negotiating never disables messaging or duplicates reserved status", () => {
  assert.match(detail, /Boolean\(latestAgreement\)/);
  assert.match(detail, /hideStatusBanner=\{Boolean\(latestAgreement\)\}/);
  assert.match(state, /hideStatusBanner/);
});

test("agreement emails deep-link to the exact chat", () => {
  assert.match(eventEmails, /\/messages\/\$\{encodeURIComponent\(params\.conversationId\)\}#agreement-panel/);
  assert.match(eventEmails, /button\("Abrir chat", url\)/);
  assert.match(eventEmails, /button\("Volver al chat", url\)/);
  assert.match(eventEmails, /Solicitud de donación/);
  assert.match(eventEmails, /Nueva oferta/);
  assert.doesNotMatch(eventEmails, /http:\/\/localhost:3000/);
  assert.doesNotMatch(transactionalEmails, /http:\/\/localhost:3000/);
});

test("valid page loads refresh activity instead of signing out from stale local storage", () => {
  assert.match(guard, /lastWriteAt = Date\.now\(\)/);
  assert.match(guard, /localStorage\.setItem\(activityKey, String\(lastWriteAt\)\)/);
  assert.doesNotMatch(guard, /const stored = window\.localStorage\.getItem\(activityKey\)/);
});

test("browser auth callbacks remain on the current host", () => {
  assert.match(origin, /return window\.location\.origin/);
});

test("protected destinations survive a required login", () => {
  assert.match(messages, /\/auth\?next=\/messages/);
  assert.match(detail, /\/auth\?next=\/messages\//);
  assert.match(account, /\/auth\?next=\/account/);
  assert.match(listings, /\/auth\?next=\/account\/listings/);
  assert.match(activity, /\/auth\?next=\/account\/activity/);
  assert.match(favorites, /\/auth\?next=\/favorites/);
});
