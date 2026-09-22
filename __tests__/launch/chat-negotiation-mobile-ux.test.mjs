import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const navbar = read("components/navbar.tsx");
const bell = read("components/notifications/navbar-notifications-bell.tsx");
const messagesIndex = read("app/messages/page.tsx");
const messagesDetail = read("app/messages/[id]/page.tsx");
const sidebar = read("components/messages/conversations-sidebar.tsx");
const agreementPanel = read("components/agreements/agreement-panel.tsx");
const proposeRoute = read("app/api/agreements/propose/route.ts");
const counterRoute = read("app/api/agreements/counter/route.ts");
const confirmRoute = read("app/api/agreements/confirm/route.ts");
const cancelRoute = read("app/api/agreements/cancel/route.ts");
const migration = read("supabase/migrations/20260922213000_chat_agreement_realtime_negotiation.sql");
const simpleCopyMigration = read("supabase/migrations/20260922220000_simplify_public_agreement_chat_copy.sql");
const listingState = read("components/messages/conversation-listing-state.tsx");
const publishForm = read("components/marketplace/new-listing-form.tsx");

test("mobile navbar exposes a realtime notification bell and only one close control", () => {
  assert.match(navbar, /NavbarNotificationsBell/);
  assert.match(navbar, /open \? "invisible pointer-events-none" : ""/);
  assert.match(navbar, /onClick=\{\(\) => setOpen\(true\)\}/);
  assert.doesNotMatch(bell, /matchMedia\("\(max-width: 767px\)"\)/);
  assert.match(bell, /case "agreement_proposed"/);
  assert.match(bell, /case "agreement_confirmed"/);
});

test("mobile chat list prioritizes identity and message preview", () => {
  assert.match(messagesIndex, /hidden min-h-\[70vh\][\s\S]*lg:flex/);
  assert.match(sidebar, /line-clamp-2 text-sm leading-5/);
  assert.match(sidebar, /HideConversationButton[\s\S]*iconOnly/);
  assert.match(sidebar, /conversation\.listingTitle/);
  assert.match(sidebar, /conversation\.latestMessageBody/);
});

test("chat header actions remain compact and offer entry points to the agreement panel", () => {
  assert.match(messagesDetail, /href="#agreement-panel"/);
  assert.match(messagesDetail, /Hacer oferta|Oferta/);
  assert.match(messagesDetail, /ReportConversationButton[^>]*iconOnly/);
  assert.match(messagesDetail, /HideConversationButton[\s\S]*iconOnly/);
  assert.match(messagesDetail, /aria-label="Ver perfil"/);
});

test("direct agreement negotiation supports price proposals, counteroffers and realtime refresh", () => {
  assert.match(migration, /alter publication supabase_realtime add table public\.agreements/);
  assert.match(migration, /alter publication supabase_realtime add table public\.notifications/);
  assert.match(migration, /p_amount numeric default null/);
  assert.match(migration, /server_counter_agreement/);
  assert.match(agreementPanel, /table: "agreements"/);
  assert.match(agreementPanel, /\/api\/agreements\/counter/);
  assert.match(agreementPanel, /Aceptar donación/);
  assert.match(agreementPanel, /Proponer otro precio/);
  assert.match(agreementPanel, /agreement\.status === "cancelled"/);
  assert.match(agreementPanel, /Has pedido esta donación/);
  assert.match(agreementPanel, /Aceptar oferta/);
  assert.match(agreementPanel, /Rechazar/);
  assert.doesNotMatch(agreementPanel, /Comprador confirmado/);
  assert.doesNotMatch(agreementPanel, /Vendedor pendiente/);
  assert.doesNotMatch(agreementPanel, /Confirmar mi parte/);
  assert.match(simpleCopyMigration, /Me interesa esta donación\. ¿Te parece bien que me la quede\?/);
  assert.match(simpleCopyMigration, /Te ofrezco/);
  assert.doesNotMatch(simpleCopyMigration, /Falta la confirmación de la otra parte/);
});

test("agreement lifecycle creates in-app notifications for the other participant", () => {
  for (const route of [proposeRoute, counterRoute, confirmRoute, cancelRoute]) {
    assert.match(route, /createNotification/);
    assert.match(route, /\/messages\/\$\{agreement\.conversation_id\}/);
  }
});

test("draft navigation and recovery are explicit and description quality uses 40 chars", () => {
  assert.match(publishForm, /handleInternalNavigation/);
  assert.match(publishForm, /pendingNavigationHref/);
  assert.match(publishForm, /Guardar borrador y salir/);
  assert.match(publishForm, /Descartar y salir/);
  assert.match(publishForm, /Tienes un borrador guardado/);
  assert.match(publishForm, /Recuperar borrador/);
  assert.match(publishForm, /description\.trim\(\)\.length >= 40/);
  assert.match(publishForm, /40 caracteres/);
});


test("an active agreement never disables its own chat", () => {
  assert.match(messagesDetail, /Boolean\(latestAgreement\)/);
  assert.match(messagesDetail, /hideStatusBanner=\{Boolean\(latestAgreement\)\}/);
  assert.match(listingState, /hideStatusBanner/);
});
