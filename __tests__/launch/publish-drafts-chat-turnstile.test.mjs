import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const turnstile = read("components/auth/turnstile-widget.tsx");
const form = read("components/marketplace/new-listing-form.tsx");
const accountListings = read("app/account/listings/page.tsx");
const statusActions = read("components/account/listing-status-actions.tsx");
const draftApi = read("app/api/marketplace/listing-draft/route.ts");
const draftMigration = read("supabase/migrations/20260922201000_listing_drafts_v1.sql");
const chatMigration = read("supabase/migrations/20260922200000_fix_conversation_listing_rls_recursion.sql");
const privateChatMigration = read("supabase/migrations/20260922200500_hide_listing_participant_helper.sql");

test("Turnstile stays hidden unless Cloudflare requires interaction", () => {
  assert.match(turnstile, /appearance: "interaction-only"/);
  assert.match(turnstile, /size: "flexible"/);
  assert.doesNotMatch(turnstile, /min-h-\[65px\]/);
});

test("condition selector only renders the short label in the closed field", () => {
  assert.match(form, /selectedConditionOption\?\.label \|\| "Seleccionar estado"/);
  assert.match(form, /selectedConditionOption\.description/);
  assert.doesNotMatch(form, /\[&>span\]:truncate/);
});

test("description quality explains its 40 character threshold", () => {
  assert.match(form, /description\.trim\(\)\.length >= 40/);
  assert.match(form, /“Descripción útil” se completa al llegar a 40 caracteres/);
  assert.match(form, /Math\.min\(description\.trim\(\)\.length, 40\)/);
});

test("listing drafts are persisted privately in the database", () => {
  assert.match(draftMigration, /create table if not exists public\.listing_drafts/);
  assert.match(draftMigration, /enable row level security/);
  assert.match(draftMigration, /listing_drafts_select_own/);
  assert.match(draftMigration, /listing_drafts_insert_own/);
  assert.match(draftMigration, /listing_drafts_update_own/);
  assert.match(draftMigration, /listing_drafts_delete_own/);
  assert.match(draftApi, /admin\.storage\.from\(STORAGE_BUCKET\)\.remove/);
  assert.match(form, /Guardar borrador y salir/);
  assert.match(form, /Descartar y salir/);
  assert.match(form, /Tienes un borrador guardado/);
  assert.match(form, /Recuperar borrador/);
  assert.match(form, /document\.addEventListener\("click", handleInternalNavigation, true\)/);
  assert.match(form, /pendingNavigationHref/);
  assert.match(form, /preservePhotoPaths/);
  assert.match(accountListings, /Continuar borrador/);
});

test("listing/conversation RLS no longer recursively queries conversations through listing policy", () => {
  assert.match(chatMigration, /security definer/);
  assert.match(chatMigration, /is_current_user_listing_participant/);
  assert.match(privateChatMigration, /private\.is_current_user_listing_participant/);
  assert.match(privateChatMigration, /revoke all on function[\s\S]*from anon/);
  assert.match(privateChatMigration, /grant execute on function[\s\S]*to authenticated, service_role/);
  assert.match(privateChatMigration, /or private\.is_current_user_listing_participant\(id\)/);
  assert.match(privateChatMigration, /drop function if exists public\.is_current_user_listing_participant/);
});

test("seller listing actions have a clean visual hierarchy", () => {
  assert.match(accountListings, /grid grid-cols-2 gap-2/);
  assert.match(accountListings, /className="w-full justify-center border-red-200/);
  assert.match(statusActions, /Estado del anuncio/);
  assert.match(statusActions, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
});
