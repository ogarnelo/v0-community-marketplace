import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/api/shipments/mark-delivered/route.ts", "utf8");

test("delivery confirmation follows the canonical shipping state machine", () => {
  assert.match(source, /shipment\.status !== "in_transit"/);
  assert.match(source, /\.eq\("status", "in_transit"\)/);
  assert.match(source, /payment\.status !== "succeeded"/);
  assert.match(source, /status: "delivered"/);
  assert.match(source, /if \(!updatedShipment\)/);
});

test("delivery metadata preserves the existing payment audit fields", () => {
  assert.match(source, /select\("id, status, metadata"\)/);
  assert.match(source, /\.\.\.\(payment\.metadata \|\| \{\}\)/);
  assert.match(source, /delivered_at: now/);
  assert.match(source, /\.eq\("status", "succeeded"\)/);
});
