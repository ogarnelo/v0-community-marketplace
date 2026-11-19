import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ts = createRequire(import.meta.url)("typescript");
const BUYER = "11111111-1111-4111-8111-111111111111";
const SELLER = "22222222-2222-4222-8222-222222222222";
const LISTING = "33333333-3333-4333-8333-333333333333";
const CLAIM = "44444444-4444-4444-8444-444444444444";
const OFFER = "55555555-5555-4555-8555-555555555555";
const EVENT = "66666666-6666-4666-8666-666666666666";
const PAYMENT = "77777777-7777-4777-8777-777777777777";

function load(path) {
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  assert.equal((compiled.diagnostics || []).filter(
    diagnostic => diagnostic.category === ts.DiagnosticCategory.Error
  ).length, 0);
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: module => { throw new Error("Unexpected module " + module); },
    Number, Math, Error, Promise,
  }, { timeout: 1800 });
  return exports;
}

const atomic = load("lib/commerce/p0-atomic-buy-now-rpc.ts");
const reports = load("lib/reports/p0-school-impact-claim-rpc.ts");

const quote = {
  itemAmount: 15,
  buyerFeeAmount: 1.50,
  shippingAmount: 2.99,
  totalBuyerAmount: 19.49,
  deliveryMethod: "shipping",
  shipmentTier: "small",
};
const prepared = {
  listing_id: LISTING,
  conversation_id: CLAIM,
  offer_id: OFFER,
  event_id: EVENT,
  payment_intent_id: PAYMENT,
};
const params = { listingId: LISTING, buyerId: BUYER, sellerId: SELLER, quote };
function recorder(answer) {
  const calls = [];
  return {
    calls,
    admin: {
      rpc: async (name, args) => {
        calls.push({ name, args });
        if (answer instanceof Error) throw answer;
        return answer;
      },
    },
  };
}

test("atomic RPC receives item price and total separately, only once", async () => {
  const h = recorder({ data: [prepared], error: null });
  const result = await atomic.prepareAtomicBuyNowDatabaseOnly({ admin: h.admin, ...params });
  assert.equal(result.payment_intent_id, PAYMENT);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].name, "p0_buy_now_prepare_atomic_candidate");
  assert.equal(h.calls[0].args.p_expected_price, 15);
  assert.equal(h.calls[0].args.p_total_amount, 19.49);
  assert.equal(h.calls[0].args.p_shipping_amount, 2.99);
});

for (const [name, overrides] of [
  ["no free shipping", { quote: { ...quote, shippingAmount: 0, totalBuyerAmount: 16.5 } }],
  ["consistent total required", { quote: { ...quote, totalBuyerAmount: 15 } }],
  ["no cross-actor purchase", { sellerId: BUYER }],
  ["no invalid listing ID", { listingId: "unknown" }],
  ["pickup has no shipping tier", { quote: { ...quote, deliveryMethod: "in_person", shippingAmount: 0, shipmentTier: "small", totalBuyerAmount: 16.5 } }],
]) {
  test(name + " fails without calling privileged RPC", async () => {
    const h = recorder({ data: [prepared], error: null });
    await assert.rejects(atomic.prepareAtomicBuyNowDatabaseOnly({
      admin: h.admin, ...params, ...overrides,
    }), /inválidos/);
    assert.equal(h.calls.length, 0);
  });
}

test("ambiguous RPC return cannot be retried blindly", async () => {
  const h = recorder({ data: [{ ...prepared, payment_intent_id: "wrong" }], error: null });
  await assert.rejects(
    atomic.prepareAtomicBuyNowDatabaseOnly({ admin: h.admin, ...params }),
    /conciliación/
  );
  assert.equal(h.calls.length, 1);
});
test("RPC transport outage redacts private details and requires reconciliation", async () => {
  const h = recorder(new Error("PRIVATE_SUPABASE_PROVIDER"));
  await assert.rejects(
    atomic.prepareAtomicBuyNowDatabaseOnly({ admin: h.admin, ...params }),
    error => /conciliación/.test(error.message) &&
      !/PRIVATE_SUPABASE_PROVIDER/.test(error.message)
  );
});

const claimParams = {
  subscriptionId: OFFER, userId: BUYER, schoolId: LISTING,
  periodKey: "2026-10", day: 19, email: "school-admin@example.invalid",
  expectedLastSent: null,
};
test("eligible month gets one SQL claim and never contacts email provider", async () => {
  const h = recorder({ data: CLAIM, error: null });
  const id = await reports.acquireDurableSchoolReportClaim({ admin: h.admin, ...claimParams });
  assert.equal(id, CLAIM);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].name, "p0_school_impact_claim_candidate");
  assert.equal(h.calls[0].args.p_expected_last_sent, null);
});
test("already claimed month returns null without any send or retry", async () => {
  const h = recorder({ data: null, error: null });
  const id = await reports.acquireDurableSchoolReportClaim({ admin: h.admin, ...claimParams });
  assert.equal(id, null);
  assert.equal(h.calls.length, 1);
});
for (const change of [{ periodKey: "2026-13" }, { day: 31 }, { email: "" }]) {
  test("invalid claim input blocks privileged RPC", async () => {
    const h = recorder({ data: CLAIM, error: null });
    await assert.rejects(
      reports.acquireDurableSchoolReportClaim({ admin: h.admin, ...claimParams, ...change }),
      /inválida/
    );
    assert.equal(h.calls.length, 0);
  });
}
test("claim provider outage requires investigation, not retry", async () => {
  const h = recorder(new Error("SECRET_SQL_QUERY"));
  await assert.rejects(
    reports.acquireDurableSchoolReportClaim({ admin: h.admin, ...claimParams }),
    /conciliación/
  );
  assert.equal(h.calls.length, 1);
});
test("accepted email may be acknowledged once by provider ID", async () => {
  const h = recorder({ data: true, error: null });
  await reports.acknowledgeDurableSchoolReportClaim({
    admin: h.admin, claimId: CLAIM, providerMessageId: "em_synthetic",
  });
  assert.equal(h.calls[0].name, "p0_school_impact_ack_candidate");
  assert.equal(h.calls[0].args.p_claim_id, CLAIM);
});
test("missing SQL acknowledgement never reports success", async () => {
  const h = recorder({ data: false, error: null });
  await assert.rejects(reports.acknowledgeDurableSchoolReportClaim({
    admin: h.admin, claimId: CLAIM, providerMessageId: "em_synthetic",
  }), /conciliación/);
});
test("malformed acknowledgement blocks privileged RPC", async () => {
  const h = recorder({ data: true, error: null });
  await assert.rejects(reports.acknowledgeDurableSchoolReportClaim({
    admin: h.admin, claimId: "not-a-uuid", providerMessageId: "em_synthetic",
  }), /inválido/);
  assert.equal(h.calls.length, 0);
});
