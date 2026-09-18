import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const exists = (path) => fs.existsSync(path);

test("agreement API routes exist", () => {
  for (const route of ["propose", "confirm", "cancel", "dispute", "review"]) {
    assert.ok(exists(`app/api/agreements/${route}/route.ts`), `${route} agreement API route should exist`);
  }
});

test("listing detail is centered on contact, not checkout", () => {
  const page = read("app/marketplace/listing/[id]/page.tsx");
  assert.match(page, /ContactSellerButton/, "listing detail should use ContactSellerButton");
  assert.doesNotMatch(page, /Comprar ahora<|Compra protegida en Wetudy/, "listing detail should not promote checkout in MVP");
  assert.match(page, /Acuerdo local con historial/, "listing detail should explain local agreements");
});

test("chat includes agreement panel", () => {
  const page = read("app/messages/[id]/page.tsx");
  assert.match(page, /AgreementPanel/, "message detail should render agreement panel");
  assert.match(page, /agreement_reviews/, "message detail should load agreement reviews");
});


test("agreement mutations use atomic service-role RPCs", () => {
  const migration = read("supabase/migrations/20260918202500_harden_agreement_integrity.sql");
  const propose = read("app/api/agreements/propose/route.ts");
  const confirm = read("app/api/agreements/confirm/route.ts");
  const cancel = read("app/api/agreements/cancel/route.ts");
  const dispute = read("app/api/agreements/dispute/route.ts");

  assert.match(migration, /server_propose_agreement/);
  assert.match(migration, /server_confirm_agreement/);
  assert.match(migration, /server_cancel_agreement/);
  assert.match(migration, /server_dispute_agreement/);
  assert.match(migration, /grant execute[\s\S]*service_role/);
  assert.match(migration, /revoke insert, update, delete[\s\S]*public\.agreements/);

  assert.match(propose, /admin\.rpc\("server_propose_agreement"/);
  assert.match(confirm, /admin\.rpc\("server_confirm_agreement"/);
  assert.match(cancel, /admin\.rpc\("server_cancel_agreement"/);
  assert.match(dispute, /admin\.rpc\("server_dispute_agreement"/);
});

test("agreement incidents are valid reports and only confirmed agreements can open them", () => {
  const migration = read("supabase/migrations/20260918202500_harden_agreement_integrity.sql");
  const panel = read("components/agreements/agreement-panel.tsx");
  const dashboard = read("components/admin/super-admin-dashboard.tsx");

  assert.match(migration, /target_type in \('listing', 'conversation', 'agreement'\)/);
  assert.match(migration, /agreement_id uuid references public\.agreements/);
  assert.match(migration, /Only confirmed agreements can open an agreement incident/);
  assert.match(migration, /agreement_type = 'donation' then 'archived'/);
  assert.match(panel, /agreement\?\.status === "confirmed"/);
  assert.match(dashboard, /Incidencia del acuerdo/);
});

test("conversation report RLS requires real participation", () => {
  const migration = read("supabase/migrations/20260918202500_harden_agreement_integrity.sql");

  assert.match(migration, /target_type = 'conversation'/);
  assert.match(migration, /c\.buyer_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /c\.seller_id = \(select auth\.uid\(\)\)/);
});
