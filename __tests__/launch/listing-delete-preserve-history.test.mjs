import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("app/api/listings/delete/route.ts", "utf8");
const deletion = source.indexOf('    const { data: deletedRows, error: deleteError } = await admin');
const archive = source.indexOf('    const { error: archiveError } = await admin');

test("seller authorization happens before privileged destructive operation", () => {
  assert.match(source, /if \(listing\.seller_id !== user\.id\)/);
  assert.ok(deletion > source.indexOf("if (listing.seller_id !== user.id)"));
  assert.match(source, /\.delete\(\)\s*\.eq\("id", listingId\)\s*\.eq\("seller_id", user\.id\)/);
});

test("only confirmed parent DELETE succeeds; no premature child deletion", () => {
  assert.ok(deletion >= 0);
  assert.match(source, /!deleteError && deletedRows\?\.length === 1/);
  assert.doesNotMatch(source, /admin\.from\("(?:favorites|listing_photos|listing_views)"\)\.delete\(\)/);
  assert.doesNotMatch(source, /Promise\.allSettled\(/);
  assert.ok(archive > deletion);
  assert.match(source, /\.update\(\{ status: "archived" \}\)/);
});

test("payment, accepted offer, and donation prevent hard deletion", () => {
  const gate = source.indexOf("if ((payments || []).length > 0 || acceptedOffer || approvedDonation)");
  assert.ok(gate >= 0 && gate < deletion);
  assert.match(source, /"requires_capture"/);
  assert.match(source, /"succeeded"/);
});

test("moderation/conversation history must archive instead of deleting", () => {
  const gate = source.indexOf("if (hasModerationOrConversationHistory)");
  assert.ok(gate >= 0 && gate < deletion);
  assert.match(source, /mode: "archived",\s*hadHistory: true/);
});
