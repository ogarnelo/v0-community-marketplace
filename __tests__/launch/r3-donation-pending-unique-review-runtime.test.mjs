import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
const servicePath = "lib/services/donations.service.ts";
const serviceSource = readFileSync(servicePath, "utf8");
const candidatePath = "scripts/review_only/r3_donation_pending_unique_candidate.sql";
const candidate = readFileSync(candidatePath, "utf8");
const pgHarness = readFileSync("scripts/qa/r3-donation-pending-unique-pg17.sh", "utf8");
const indexName = "donation_requests_one_pending_per_requester_listing_idx";
const listingId = "11111111-1111-4111-8111-111111111111";
const requesterId = "22222222-2222-4222-8222-222222222222";
const sellerId = "33333333-3333-4333-8333-333333333333";

function serviceFixture({ insertError = null, existing = null } = {}) {
  const calls = [];
  const listing = {
    id: listingId,
    title: "Donación sintética",
    seller_id: sellerId,
    status: "available",
    type: "donation",
    listing_type: "donation",
    school_id: "44444444-4444-4444-8444-444444444444",
  };
  const supabase = {
    from(table) {
      calls.push("FROM:" + table);
      return {
        select() { return this; },
        eq() { return this; },
        insert() { calls.push("INSERT:" + table); return this; },
        async maybeSingle() {
          if (table === "listings") return { data: listing, error: null };
          if (table === "donation_requests") return { data: existing, error: null };
          throw Error("Unexpected read " + table);
        },
        async single() {
          if (table === "donation_requests") return { data: null, error: insertError };
          throw Error("Unexpected inserted table " + table);
        },
      };
    },
  };
  const mocks = {
    "@/lib/marketplace/rules": { canRequestDonation: () => ({ ok: true }) },
    "@/lib/notifications": { createNotification: () => { calls.push("NOTIFY"); throw Error("UNEXPECTED_EFFECT"); } },
    "@/lib/donations/chat-message": { buildDonationChatBody: () => "synthetic" },
    "@/lib/services/conversations.service": {
      getOrCreateConversation: () => { calls.push("CONVERSATION"); throw Error("UNEXPECTED_EFFECT"); },
    },
  };
  const output = ts.transpileModule(serviceSource, {
    fileName: servicePath,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  assert.equal((output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  vm.runInNewContext(output.outputText, {
    exports,
    require: key => {
      if (!Object.hasOwn(mocks, key)) throw Error("Unexpected module " + key);
      return mocks[key];
    },
    Promise, Date, Error, Object, Number,
  }, { filename: servicePath, timeout: 1500 });
  return {
    calls,
    request: () => exports.requestDonationFlow({
      supabase, listingId, actorUserId: requesterId, note: null,
    }),
  };
}

test("R3 A-015 unique pending index is review-only outside migrations and has guards", () => {
  assert.match(candidate, /CANDIDATE SQL ONLY.*REVIEW ONLY.*NOT INSTALLED/);
  assert.match(candidate, /NO_GO_R3_A015_DUPLICATE_PENDING_GROUPS/);
  assert.match(candidate, /NO_GO_R3_A015_RLS_NOT_ENABLED/);
  assert.match(candidate, /NO_GO_R3_A015_EXISTING_WINNER_GUARD_DRIFTED/);
  assert.match(candidate, /CREATE UNIQUE INDEX donation_requests_one_pending_per_requester_listing_idx/);
  assert.match(candidate, /ON public\.donation_requests \(listing_id, requester_id\)/);
  assert.match(candidate, /WHERE status='pending'/);
  assert.match(candidate, /HAVING COUNT\(\*\) > 1/);
  assert.match(candidate, /BEGIN;/);
  assert.match(candidate, /COMMIT;/);
  assert.doesNotMatch(candidate, /^\s*(ALTER POLICY|CREATE POLICY|DROP POLICY|GRANT|REVOKE|ALTER TABLE|UPDATE|INSERT|DELETE)\b/im);
  assert.doesNotMatch(candidate, /donation_requests_one_approved_per_listing_idx\s*(?:;|\n\s*DROP)/);
  assert.doesNotMatch(JSON.stringify(JSON.parse(readFileSync("package.json", "utf8")).scripts), /r3_donation_pending_unique_candidate/);
});

test("R3 A-015 PG17 test enforces actual parallel inserts and isolated host", () => {
  assert.match(pgHarness, /PGHOST=127\.0\.0\.1/);
  assert.match(pgHarness, /wetudy_r3_donation_pending_synthetic/);
  assert.match(pgHarness, /run_tx/);
  assert.match(pgHarness, /NO_GO_R3_A015_DUPLICATE_PENDING_GROUPS/);
  assert.match(pgHarness, /one successful pending insert/i);
  assert.doesNotMatch(pgHarness, /supabase\.co|wetudy\.com|DATABASE_URL/);
});

test("R3 A-015 concurrent duplicate without verified committed winner fails closed", async () => {
  const f = serviceFixture({
    insertError: { code: "23505", message: 'duplicate key value violates unique constraint "' + indexName + '"' },
  });
  await assert.rejects(f.request(), error =>
    error.name === "DonationRequestReconciliationError");
  assert.equal(f.calls.filter(c => c === "INSERT:donation_requests").length, 1);
  assert.ok(!f.calls.includes("CONVERSATION") && !f.calls.includes("NOTIFY"));
});

test("R3 A-015 a different unique violation is not disguised as duplicate pending", async () => {
  const f = serviceFixture({ insertError: { code: "23505", message: "donation_requests_pkey" } });
  await assert.rejects(f.request(), error =>
    error.name !== "DonationRequestConflictError" && /No se pudo crear/.test(error.message));
  assert.ok(!f.calls.includes("CONVERSATION") && !f.calls.includes("NOTIFY"));
});

test("R3 A-015 a backend failure does not become 409 conflict", async () => {
  const f = serviceFixture({ insertError: { code: "42501", message: "PRIVATE_SQL" } });
  await assert.rejects(f.request(), error =>
    error.name !== "DonationRequestConflictError" && /No se pudo crear/.test(error.message));
  assert.ok(!f.calls.includes("CONVERSATION") && !f.calls.includes("NOTIFY"));
});

test("R3 A-015 an existing pending row still short-circuits before INSERT", async () => {
  const f = serviceFixture({ existing: { id: "55555555-5555-4555-8555-555555555555" } });
  await assert.rejects(f.request(), error => error.name === "DonationRequestReconciliationError");
  assert.ok(!f.calls.includes("INSERT:donation_requests"));
});
