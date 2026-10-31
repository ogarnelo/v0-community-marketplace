import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync("components/marketplace/new-listing-form.tsx", "utf8");
const route = readFileSync("app/api/marketplace/ai-assist/route.ts", "utf8");

test("AI assistance is opt-in and never publishes a listing", () => {
  assert.match(form, /Completar con IA/);
  assert.match(form, /onClick={handleAiAssist}/);
  assert.match(form, /process\.env\.NEXT_PUBLIC_AI_PUBLISH_PILOT === "true"/);
  assert.match(form, /Revisa el resultado antes de publicar/);
  assert.match(route, /No publiques nada/);
  assert.doesNotMatch(route, /\.from\(["']listings["']\)\.insert/);
});

test("paid model endpoint is gated, server-side and authenticated", () => {
  assert.match(route, /process\.env\.AI_PUBLISH_ENABLED !== "true"/);
  assert.match(route, /process\.env\.AI_PUBLISH_ALLOWED_USER_IDS/);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.match(route, /store: false/);
  assert.doesNotMatch(form, /OPENAI_API_KEY/);
});

test("AI suggests limited educational data without touching price and condition", () => {
  assert.match(route, /const MAX_PHOTOS = 2/);
  assert.match(route, /const MAX_FILE_SIZE = 3 \* 1024 \* 1024/);
  assert.match(route, /response_format:/);
  assert.match(route, /json_schema:/);
  assert.match(route, /categories\.includes\(category\)/);
  assert.match(form, /Complete empty fields only|Complete empty fields only/i);
  assert.doesNotMatch(form.slice(form.indexOf("const handleAiAssist"),form.indexOf("const persistDraftPhotos")), /setPrice\(|setSelectedCondition\(|setIsDonation\(/);
});
