import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const helper = readFileSync("lib/admin/course-need-observability.ts", "utf8");
const page = readFileSync("app/admin/super/demand/page.tsx", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("course-need funnel uses the existing lifecycle timestamps without writes", () => {
  assert.match(helper, /created_at/);
  assert.match(helper, /first_result_at/);
  assert.match(helper, /first_contact_at/);
  assert.match(helper, /first_agreement_at/);
  assert.match(helper, /resolved_at/);
  assert.match(helper, /conversation_id/);
  assert.doesNotMatch(helper, /insert\(|update\(|delete\(/);
});

test("course-need funnel exposes conversion rates for each lifecycle step", () => {
  assert.match(helper, /activationToResultPct/);
  assert.match(helper, /resultToContactPct/);
  assert.match(helper, /contactToAgreementPct/);
  assert.match(helper, /agreementToResolvedPct/);
  assert.match(helper, /activationToResolvedPct/);
  assert.match(helper, /contacted/);
  assert.match(helper, /withAgreement/);
});

test("course-need funnel uses medians and ignores invalid negative durations", () => {
  assert.match(helper, /function median/);
  assert.match(helper, /endMs < startMs/);
  assert.match(helper, /activationToResultDurations/);
  assert.match(helper, /resultToContactDurations/);
  assert.match(helper, /contactToAgreementDurations/);
  assert.match(helper, /agreementToResolvedDurations/);
  assert.match(helper, /activationToResolvedDurations/);
  assert.match(helper, /timingSamples/);
});

test("super-admin demand page shows conversion, medians and sample sizes", () => {
  assert.match(page, /Conversión y velocidad/);
  assert.match(page, /Activación → resultado/);
  assert.match(page, /Resultado → conversación/);
  assert.match(page, /Conversación → acuerdo/);
  assert.match(page, /Acuerdo → resolución/);
  assert.match(page, /Activación → resolución/);
  assert.match(page, /Mediana/);
  assert.match(page, /timingSamples/);
  assert.match(page, /ciclos/);
});

test("course-need funnel is part of critical prebuild contracts", () => {
  assert.equal(
    pkg.scripts["test:course-need-funnel"],
    "node --test __tests__/launch/course-need-funnel.test.mjs"
  );
  assert.match(pkg.scripts["test:critical-contracts"], /test:course-need-funnel/);
});
