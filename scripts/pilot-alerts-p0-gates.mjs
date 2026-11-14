#!/usr/bin/env node
"use strict";
// WETUDY pilot QA gate — entirely offline; no credentials, network or writes.
// Run: node scripts/pilot-alerts-p0-gates.mjs [repo-root]
// Exit 2 means NO-GO for alert rollout. This is NOT an E2E or DR certificate.
const fs = require("node:fs");
const path = require("node:path");

function inspect(root) {
  const read = (p) => {
    try { return fs.readFileSync(path.join(root, p), "utf8"); }
    catch { return ""; }
  };
  const m = read("app/api/marketplace/listings/match-saved-searches/route.ts");
  const w = read("app/api/cron/marketplace-alert-outbox/route.ts");
  const h = read("lib/marketplace/saved-search-alert-rollout.mjs");
  const f = read("app/api/marketplace/feed/route.ts");
  const form = read("components/marketplace/new-listing-form.tsx");
  const config = read("vercel.json");
  const checks = [];
  const check = (name, pass) => checks.push({ name, pass: !!pass });
  const early = m.indexOf("if (isOutboxWorker && !savedSearchAlertsEnabled())");
  const late = m.indexOf('if (process.env.WETUDY_SAVED_SEARCH_ALERTS_ENABLED !== "true")');
  const matching = m.indexOf('from("saved_search_matches")');
  const demand = m.indexOf("await recordNeedResult(");
  const notification = m.indexOf("createNotificationOnce(");
  const email = m.indexOf("sendTransactionalEmailOnce(");
  check("all necessary source files are present", !!m && !!w && !!h && !!f && !!form && !!config);
  check("signed worker is detected before the pause", early > m.indexOf("const isOutboxWorker") && early > 0);
  check("paused worker returns 202 and does not acknowledge completion",
    /if\s*\(isOutboxWorker && !savedSearchAlertsEnabled\(\)\)[\s\S]{0,260}ok:\s*true,\s*complete:\s*false[\s\S]{0,100}status:\s*202/.test(m));
  check("pause precedes database claim and discovery", early > 0 && early < m.indexOf("const admin = createAdminClient()"));
  check("seller retains matching and demand attribution before disabling delivery",
    matching > 0 && demand > matching && late > demand);
  check("seller OFF sends neither notifications nor emails", late > 0 && late < notification && late < email &&
    /alertsDisabled:\s*true,[\s\S]{0,180}notified:\s*0,\s*emailed:\s*0/.test(m));
  check("publisher verifies listing ownership", m.includes("listing.seller_id !== user.id") && m.includes("listing.user_id !== user.id"));
  check("worker requires all three flags",
    w.includes("alertOutboxWorkerEnabled()") &&
    h.includes("WETUDY_SAVED_SEARCH_ALERTS_ENABLED === 'true'") &&
    h.includes("WETUDY_ALERT_OUTBOX_ENABLED === 'true'") &&
    h.includes("WETUDY_ALERT_INTENT_DELIVERY_ENABLED === 'true'"));
  check("worker treats 202 partial delivery as requeue, not a failure",
    w.includes("if (response.ok)") &&
    w.includes("partialProgress = body?.ok === true && body?.complete === false") &&
    w.includes("if (partialProgress)") &&
    w.includes("marketplace_alert_requeue_progress_v1"));
  check("feed does not return full postcode", /postalCode:\s*null/.test(f));
  check("original publish dispatch remains in place", form.includes("dispatchPublishedListingAlerts"));
  let crons = null;
  try { crons = JSON.parse(config).crons; } catch {}
  check("outbox has no scheduled cron", Array.isArray(crons) && !crons.some((x) =>
    String(x.path || "").includes("marketplace-alert-outbox")));
  return checks;
}

const checks = inspect(path.resolve(process.argv[2] || "."));
for (const x of checks) console.log((x.pass ? "PASS " : "BLOCK ") + x.name);
const failures = checks.filter((x) => !x.pass);
console.log(checks.length - failures.length + "/" + checks.length + " gates met; " +
  (failures.length ? "NO-GO (exit 2)" : "STATIC GATES OK; integration tests still required"));
if (failures.length) process.exitCode = 2;
