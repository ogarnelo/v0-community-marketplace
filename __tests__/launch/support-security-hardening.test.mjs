import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("support form uses the authenticated server route instead of direct table inserts", () => {
  const form = read("components/help/help-contact-form.tsx");
  assert.match(form, /fetch\("\/api\/support\/tickets"/);
  assert.doesNotMatch(form, /from\("support_tickets"\)\.insert/);
  assert.match(form, /Inicia sesión para contactar con soporte/);
});

test("support API authenticates, rate limits, and derives identity server-side", () => {
  const route = read("app/api/support/tickets/route.ts");
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /status: 401/);
  assert.match(route, /MAX_TICKETS_PER_HOUR = 3/);
  assert.match(route, /\.eq\("user_id", user\.id\)/);
  assert.match(route, /user\.email/);
  assert.match(route, /createAdminClient\(\)/);
});

test("support migration removes public inserts and notifies super admins", () => {
  const migration = read("supabase/migrations/20260917094000_harden_support_tickets_and_notify_superadmins.sql");
  assert.match(migration, /drop policy if exists support_tickets_insert_public/);
  assert.match(migration, /support_tickets_user_created_at_idx/);
  assert.match(migration, /notify_superadmins_on_support_ticket/);
  assert.match(migration, /support_ticket_created/);
  assert.match(migration, /where ur\.role = 'super_admin'/);
  assert.match(migration, /revoke all on function public\.notify_superadmins_on_support_ticket\(\) from authenticated/);
});

test("super admin navbar receives unread notification state", () => {
  const page = read("app/admin/super/page.tsx");
  assert.match(page, /getNavbarData/);
  assert.match(page, /const navbarData = await getNavbarData\(supabase\)/);
  assert.match(page, /<Navbar \{\.\.\.navbarData\} \/>/);
});
