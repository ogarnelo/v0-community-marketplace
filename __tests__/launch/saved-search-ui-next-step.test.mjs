import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nextStep = readFileSync("docs/SEARCH_ALERTS_UI_NEXT_STEP.md", "utf8");

test("search alerts UI next step remains demand-first", () => {
  assert.match(nextStep, /Avísame si aparece/);
  assert.match(nextStep, /zero results/);
  assert.match(nextStep, /Email delivery/);
  assert.match(nextStep, /Push notifications/);
  assert.doesNotMatch(nextStep, /Apple Pay|Correos label|checkout público/i);
});
