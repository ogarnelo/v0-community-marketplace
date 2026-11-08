#!/usr/bin/env node
"use strict";

// Browser-only pilot smoke test. NO auth, uploads, POSTs, mutations, test users
// or screenshots containing personal data. Runs against the published site.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "/tmp/wetudy-pilot-browser/node_modules/playwright"
);

const ORIGIN = "https://www.wetudy.com";
const fixture = readFileSync(
  "supabase/migrations/20261007070000_school_test_visibility.sql",
  "utf8"
);
const match = fixture.match(/where id = '([a-f0-9-]{36})'/i);
assert.ok(match, "The existing published QA centre fixture is missing");
const QA_SCHOOL_ID = match[1];

async function expectPublicApi(context) {
  const endpoint = new URL("/api/schools/public", ORIGIN);
  const response = await context.request.get(endpoint.toString(), { timeout: 25000 });
  assert.equal(response.status(), 200, "Public school search must return 200");
  const payload = await response.json();
  assert.ok(Array.isArray(payload.schools), "Public school search requires an array");
  assert.ok(
    !payload.schools.some((school) => school.id === QA_SCHOOL_ID),
    "The demo QA centre must remain hidden from generic public search"
  );
  for (const school of payload.schools) {
    assert.deepEqual(
      Object.keys(school).sort(),
      ["city", "id", "name"],
      "Public schools must not expose admin, access-code, or family fields"
    );
  }

  const qaUrl = new URL("/api/schools/public", ORIGIN);
  qaUrl.searchParams.set("id", QA_SCHOOL_ID);
  const qaResponse = await context.request.get(qaUrl.toString(), { timeout: 25000 });
  assert.equal(qaResponse.status(), 200, "Direct QA centre link must be available");
  const qaPayload = await qaResponse.json();
  assert.equal(qaPayload.school?.id, QA_SCHOOL_ID);
  assert.match(qaPayload.school?.name || "", /Monteverde/i);
  assert.deepEqual(Object.keys(qaPayload.school).sort(), ["city", "id", "name"]);
  console.log("PASS: QA centre accessible by direct ID but absent from discovery.");
}

async function expectAdminQrProtected(context) {
  const response = await context.request.get(
    new URL("/api/school/share-qr?format=svg", ORIGIN).toString(),
    { timeout: 25000 }
  );
  assert.equal(response.status(), 401, "Unauthenticated QR administration must return 401");
  assert.doesNotMatch(await response.text(), /<svg/i);
  console.log("PASS: admin QR cannot be fetched without a session.");
}

async function expectAdminPagesRequireLogin(context) {
  // These pages may render privileged content for logged-in moderators.
  // Test only the first unauthenticated GET without following any redirect,
  // without creating user sessions, and without loading sensitive HTML.
  const protectedRoutes = [
    "/admin/school",
    "/admin/super",
    "/admin/super/reports/00000000-0000-4000-8000-000000000000",
  ];

  for (const path of protectedRoutes) {
    const response = await context.request.get(new URL(path, ORIGIN).toString(), {
      timeout: 25000,
      maxRedirects: 0,
    });
    assert.ok(
      [307, 308].includes(response.status()),
      `Guest must be redirected away from ${path} (got ${response.status()})`
    );
    const location = response.headers().location || "";
    const destination = new URL(location, ORIGIN);
    assert.equal(destination.origin, ORIGIN, "Admin login must stay on Wetudy");
    assert.equal(destination.pathname, "/auth", "Guest must go to login");
    assert.equal(
      destination.searchParams.get("next"),
      path,
      "Login return path must preserve the intended admin page"
    );
  }

  console.log("PASS: guest cannot access AMPA, superadmin or report detail pages.");
}

async function checkQrOnboarding(browser, viewport, withLogin) {
  const context = await browser.newContext({ viewport, locale: "es-ES" });
  // Do not run analytics acquisition calls even if UI logic changes later.
  await context.route("**/api/analytics/**", (route) => route.abort());
  const page = await context.newPage();
  try {
    const url = new URL("/onboarding/join-school", ORIGIN);
    url.searchParams.set("school", QA_SCHOOL_ID);
    url.searchParams.set("utm_source", "pilot_qa");
    const response = await page.goto(url.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 35000,
    });
    assert.equal(response?.status(), 200, "QA join page must load");
    await page.getByText("Centro encontrado", { exact: true }).waitFor({
      state: "visible",
      timeout: 35000,
    });
    assert.equal(
      await page.getByRole("link", { name: "Ya tengo cuenta" }).count(),
      1,
      "Guest QR flow must offer login before linking"
    );
    assert.equal(
      await page.getByRole("link", { name: "Crear cuenta" }).count(),
      1,
      "Guest QR flow must offer signup before linking"
    );
    assert.ok(
      (await page.locator("body").innerText()).includes("Esto no verifica que pertenezcas"),
      "QR must not imply verified membership"
    );
    assert.equal(
      await page.getByRole("button", { name: /Unirme a Monteverde/i }).count(),
      0,
      "Guest must not be able to join without signing in"
    );

    if (viewport.width <= 390) {
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      assert.ok(overflow <= 1, "Mobile QR screen should not overflow horizontally");
    }

    if (withLogin) {
      await page.getByRole("link", { name: "Ya tengo cuenta" }).click();
      await page.waitForURL((u) => u.pathname === "/auth", { timeout: 25000 });
      const target = new URL(page.url());
      assert.equal(target.searchParams.get("mode"), "login");
      const next = target.searchParams.get("next") || "";
      assert.match(next, /^\/onboarding\/join-school\?/);
      const nextUrl = new URL(next, ORIGIN);
      assert.equal(nextUrl.searchParams.get("school"), QA_SCHOOL_ID);
      assert.equal(nextUrl.searchParams.get("join"), "1");
      console.log("PASS: guest QR -> login preserves selected school and join=1.");
    } else {
      console.log("PASS: mobile guest QR shows centre, options and non-verification.");
    }
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    try {
      await expectPublicApi(context);
      await expectAdminQrProtected(context);
      await expectAdminPagesRequireLogin(context);
    } finally {
      await context.close();
    }
    await checkQrOnboarding(browser, { width: 1280, height: 900 }, true);
    await checkQrOnboarding(browser, { width: 390, height: 844 }, false);
    console.log("PASS: all anonymous pilot QR browser checks completed (read-only).");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error("Pilot guest QR smoke failed:", error.message);
  process.exitCode = 1;
});
