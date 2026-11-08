/* Guest-only browser E2E. Never authenticates, submits forms, or writes data. */
"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const origin = process.env.WETUDY_E2E_URL || "https://www.wetudy.com";
if (new URL(origin).hostname !== "www.wetudy.com") {
  throw new Error("This guest smoke suite runs only against the expected public Wetudy host.");
}
const routes = [
  ["/account", "/auth"],
  ["/messages", "/auth"],
  ["/marketplace/new", "/auth"],
  ["/onboarding/students", "/auth"],
];
const viewports = [
  { name: "desktop", width: 1280, height: 800, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
];

async function visit(context, path) {
  const page = await context.newPage();
  let response;
  try {
    response = await page.goto(origin + path, { waitUntil: "domcontentloaded", timeout: 30000 });
    assert.ok(response, `No response for ${path}`);
    assert.ok(response.status() < 500, `${path}: unexpected HTTP ${response.status()}`);
    return page;
  } catch (error) {
    await page.close();
    throw error;
  }
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
  });
  try {
    const home = await visit(context, "/");
    assert.match(await home.locator("body").innerText(), /Wetudy/i, "Homepage branding missing");
    console.log(`[OK] ${viewport.name} homepage`);
    await home.close();

    const marketplace = await visit(context, "/marketplace");
    assert.match(await marketplace.locator("body").innerText(), /material escolar|libros|anuncios/i);
    console.log(`[OK] ${viewport.name} marketplace renders`);
    await marketplace.close();

    const signup = await visit(context, "/auth?mode=signup");
    await signup.getByRole("heading", { name: /Crear cuenta/i }).waitFor({ timeout: 15000 });
    assert.ok(await signup.locator('input[type="email"]').count() > 0, "Signup email missing");
    assert.ok(await signup.locator('input[type="password"]').count() > 0, "Signup password missing");
    console.log(`[OK] ${viewport.name} signup form renders without submitting`);
    await signup.close();

    for (const [privateRoute, expectedRoute] of routes) {
      const page = await visit(context, privateRoute);
      const actual = new URL(page.url()).pathname;
      assert.equal(actual, expectedRoute, `${privateRoute}: anonymous user reached ${actual}`);
      console.log(`[OK] ${viewport.name} anonymous ${privateRoute} redirected to ${expectedRoute}`);
      await page.close();
    }
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) await runViewport(browser, viewport);
    console.log("[PASS] Guest-only desktop/mobile browser checks passed; no production writes.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error("[FAIL] Guest browser E2E:", error.message);
  process.exitCode = 1;
});
