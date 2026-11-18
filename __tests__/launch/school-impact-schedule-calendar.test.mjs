import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cron = readFileSync(new URL("../../app/api/cron/school-impact-reports/route.ts", import.meta.url), "utf8");
const subscription = readFileSync(new URL("../../app/api/school/report-subscription/route.ts", import.meta.url), "utf8");

test("school impact cron uses Madrid calendar day, not UTC day", () => {
  assert.match(cron, /timeZone: "Europe\/Madrid"/);
  assert.doesNotMatch(cron, /now\.getUTCDate\(\)/);
  const madridDay = (iso) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", day: "numeric" }).format(new Date(iso)));
  assert.equal(madridDay("2026-11-30T23:30:00Z"), 1);
  assert.equal(madridDay("2026-07-31T22:30:00Z"), 1);
  assert.equal(madridDay("2026-11-01T00:30:00Z"), 1);
});

test("school subscription rejects coerced day strings and fractions", () => {
  assert.match(subscription, /body\.dayOfMonth === undefined \? 1 : body\.dayOfMonth/);
  assert.match(subscription, /typeof body\.enabled !== "boolean"/);
  assert.match(subscription, /Number\.isInteger\(dayOfMonth\)/);
  assert.doesNotMatch(subscription, /Number\(body\?\.dayOfMonth/);
});
