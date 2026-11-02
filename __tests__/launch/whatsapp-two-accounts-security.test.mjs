import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const DRAFT_B = "33333333-3333-4333-8333-333333333333";
const db = {
  whatsapp_account_links: [{ user_id: A }, { user_id: B }],
  whatsapp_listing_sessions: [{
    user_id: B,
    step: "review_photo",
    payload: { listingId: DRAFT_B },
    draft_photo_path: `${B}/photo.jpg`,
    updated_at: new Date().toISOString(),
    in_flight_until: null,
  }],
};
let activeUser = A;
let rpcCount = 0;
let storageReads = 0;

function builder(table) {
  const equals = [];
  const query = {
    select() { return query; },
    eq(key, value) { equals.push([key, value]); return query; },
    async maybeSingle() {
      const row = (db[table] || []).find((data) =>
        equals.every(([key, value]) => data[key] === value));
      return { data: row || null, error: null };
    },
  };
  return query;
}

const admin = {
  from: builder,
  storage: {
    from() {
      return {
        async download() {
          storageReads++;
          return { data: new Blob(["pretend-photo-bytes"]), error: null };
        },
      };
    },
  },
  async rpc() { rpcCount++; return { data: "claimed", error: null }; },
};
const modules = {
  "next/server": { NextResponse: class NextResponse extends Response {
    static json(value, options) { return Response.json(value, options); }
  } },
  "@/lib/supabase/server": {
    createClient: async () => ({
      auth: { getUser: async () => ({
        data: { user: { id: activeUser, email_confirmed_at: "2026-10-01" } },
        error: null,
      }) },
    }),
  },
  "@/lib/supabase/admin": { createAdminClient: () => admin },
  "@/lib/whatsapp/pilot": {
    isWhatsappPilotConfigured: () => true,
    isWhatsappPilotUserAllowed: () => true,
    isSameOriginPost: (request) => request.headers.get("origin") === new URL(request.url).origin,
  },
  "@/lib/whatsapp/form": { normalizeWhatsappForm: () => { throw Error("Must not reach form processing"); } },
  "@/lib/whatsapp/publish": { publishWhatsappConfirmedListing: () => { throw Error("Must not publish cross-account"); } },
};
const env = {
  VERCEL_ENV: "preview",
  WHATSAPP_PUBLISH_ENABLED: "true",
  WHATSAPP_AI_ENABLED: "true",
};
function loadRoute(path) {
  const transpiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: path,
  }).outputText;
  const mod = { exports: {} };
  const sandbox = { Buffer, Blob, Response, Request, URL, process: { env }, console };
  const fn = vm.runInNewContext(`(function(require, module, exports){ ${transpiled}\n})`, sandbox);
  fn((name) => {
    if (name === "node:crypto") return requireCrypto();
    if (!(name in modules)) throw Error("Unexpected imported module: " + name);
    return modules[name];
  }, mod, mod.exports);
  return mod.exports;
}
function requireCrypto() { return { randomUUID: () => "44444444-4444-4444-8444-444444444444" }; }

const formRoute = loadRoute("app/api/whatsapp/draft/route.ts");
const photoRoute = loadRoute("app/api/whatsapp/photo/route.ts");

test("cross-account user A cannot open, inspect or save B's draft even knowing UUID", async () => {
  activeUser = A;
  const get = await formRoute.GET(new Request(`https://preview.example/api/whatsapp/draft?draft=${DRAFT_B}`));
  assert.equal(get.status, 404);
  assert.equal(storageReads, 0);

  const post = await formRoute.POST(new Request("https://preview.example/api/whatsapp/draft", {
    method: "POST",
    headers: { origin: "https://preview.example", "Content-Type": "application/json" },
    body: JSON.stringify({
      draftId: DRAFT_B, action: "publish",
      draft: { title: "Ataque", category: "Otros" },
    }),
  }));
  assert.equal(post.status, 404);
  assert.equal(rpcCount, 0);
});

test("cross-account user A cannot obtain B's private photo", async () => {
  activeUser = A;
  const result = await photoRoute.GET(new Request(`https://preview.example/api/whatsapp/photo?draft=${DRAFT_B}`));
  assert.equal(result.status, 404);
  assert.equal(storageReads, 0);
});

test("account B can reach its own photo and draft, without cross-account data", async () => {
  activeUser = B;
  const draft = await formRoute.GET(new Request(`https://preview.example/api/whatsapp/draft?draft=${DRAFT_B}`));
  assert.equal(draft.status, 200);
  const doc = await draft.json();
  assert.equal(doc.step, "review_photo");
  assert.equal(doc.draft.listingId, DRAFT_B);
  assert.equal(doc.photoUrl, `/api/whatsapp/photo?draft=${DRAFT_B}`);
  const image = await photoRoute.GET(new Request(`https://preview.example/api/whatsapp/photo?draft=${DRAFT_B}`));
  assert.equal(image.status, 200);
  assert.equal(storageReads, 1);
});

test("cross-origin POST is blocked before any database action", async () => {
  activeUser = B;
  const before = rpcCount;
  const res = await formRoute.POST(new Request("https://preview.example/api/whatsapp/draft", {
    method: "POST",
    headers: { origin: "https://attacker.example", "Content-Type": "application/json" },
    body: JSON.stringify({ draftId: DRAFT_B, action: "publish", draft: {} }),
  }));
  assert.equal(res.status, 403);
  assert.equal(rpcCount, before);
});
