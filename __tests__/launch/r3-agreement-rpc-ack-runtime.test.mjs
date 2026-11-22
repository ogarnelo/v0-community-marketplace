import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const AGREEMENT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";
const validRow = {
  id: AGREEMENT_ID,
  status: "cancelled",
  buyer_id: USER_ID,
  seller_id: OTHER_ID,
  listing_id: "44444444-4444-4444-8444-444444444444",
  conversation_id: "55555555-5555-4555-8555-555555555555",
  buyer_confirmed_at: null,
  seller_confirmed_at: null,
};

function fixture(kind, { rpcRow = null, rpcError = null, guest = false, authError = null } = {}) {
  const path = "app/api/agreements/" + kind + "/route.ts";
  const calls = [];
  const admin = {
    rpc: async (name, params) => {
      calls.push("RPC:" + name);
      assert.equal(params.p_actor_id, USER_ID);
      assert.equal(params.p_agreement_id.toLowerCase(), AGREEMENT_ID);
      return { data: rpcRow, error: rpcError };
    },
    from: (table) => {
      calls.push("READ:" + table);
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          if (table === "agreements") return { data: { listing_id: validRow.listing_id, buyer_id: USER_ID, seller_id: OTHER_ID }, error: null };
          if (table === "listings") return { data: { id: validRow.listing_id, title: "Test listing" }, error: null };
          throw new Error("Unexpected table");
        },
      };
    },
  };
  const mocks = {
    "next/server": {
      NextResponse: { json: (body, options = {}) => new Response(JSON.stringify(body), {
        status: options.status ?? 200, headers: options.headers ?? {},
      }) },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({
          data: { user: guest ? null : { id: USER_ID, user_metadata: {} } },
          error: authError,
        }) },
      }),
    },
    "@/lib/supabase/admin": { createAdminClient: () => { calls.push("ADMIN"); return admin; } },
    "@/lib/notifications": { createNotificationOnce: async () => { calls.push("NOTIFY"); } },
    "@/lib/seo/demo-listing": { isDemoListing: () => false },
  };

  const transpiled = ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  assert.equal((transpiled.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  vm.runInNewContext(transpiled.outputText, {
    exports, require: name => {
      if (!(name in mocks)) throw new Error("Unexpected import: " + name);
      return mocks[name];
    },
    console: { error: () => calls.push("LOG") },
    Request, Response, URL, Promise, Date,
  }, { filename: path, timeout: 1500 });

  return {
    calls,
    run: async (overrideId = AGREEMENT_ID) => {
      const body = kind === "cancel"
        ? { agreementId: overrideId, note: "Not needed" }
        : { agreementId: overrideId, reason: "other", details: "Detalle sintético de incidencia válido" };
      const response = await exports.POST(new Request("https://example.invalid/api/agreements/" + kind, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }));
      return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
    },
  };
}

for (const [kind, status] of [["cancel", "cancelled"], ["dispute", "disputed"]]) {
  const good = { ...validRow, status };

  for (const [label, rpcRow] of [
    ["null RPC response", null],
    ["empty RPC result array", []],
    ["unexpected empty object", {}],
    ["different agreement ID", { ...good, id: OTHER_ID }],
    ["unexpected agreement state", { ...good, status: "confirmed" }],
  ]) {
    test(kind + " · " + label + " cannot respond with false success", async () => {
      const f = fixture(kind, { rpcRow });
      const response = await f.run();
      assert.equal(response.status, 503);
      assert.equal(response.cache, "private, no-store");
      assert.notEqual(response.body.ok, true);
      assert.ok(response.body.error.includes("verificar"));
      assert.deepEqual(f.calls.filter(x => x === "NOTIFY"), []);
      assert.equal(f.calls.filter(x => x.startsWith("RPC:")).length, 1);
    });
  }

  test(kind + " · valid verified row can still complete", async () => {
    const f = fixture(kind, { rpcRow: [good] });
    const response = await f.run();
    assert.equal(response.status, 200);
    assert.equal(response.cache, "private, no-store");
    assert.equal(response.body.ok, true);
    assert.equal(response.body.agreement.id, AGREEMENT_ID);
    assert.equal(f.calls.filter(x => x === "NOTIFY").length, kind === "cancel" ? 1 : 0);
  });

  test(kind + " · uppercase UUID input is accepted when returned identity matches", async () => {
    const f = fixture(kind, { rpcRow: good });
    const response = await f.run(AGREEMENT_ID.toUpperCase());
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
  });

  test(kind + " · RPC error never acknowledges success", async () => {
    const f = fixture(kind, { rpcError: { message: "PRIVATE_SQL" }, rpcRow: null });
    const response = await f.run();
    assert.equal(response.status, 500);
    assert.notEqual(response.body.ok, true);
    assert.doesNotMatch(JSON.stringify(response.body), /PRIVATE_SQL/);
    assert.equal(f.calls.filter(x => x === "NOTIFY").length, 0);
  });

  test(kind + " · Auth missing denies before privileged access", async () => {
    const f = fixture(kind, { guest: true });
    const response = await f.run();
    assert.equal(response.status, 401);
    assert.ok(!f.calls.includes("ADMIN"));
    assert.equal(response.cache, "private, no-store");
  });
}
