import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync("components/messages/conversation-listing-state.tsx","utf8");
test("listing realtime event has minimal explicit projection",()=>{
  const block=src.match(/table:\s*"listings",[\s\S]{0,250}select:\s*\[([^\]]+)\]/);
  assert.ok(block);
  assert.deepEqual([...block[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]),["id","status"]);
  assert.match(src,/filter:\s*/);
});
test("event handler changes only validated status",()=>{
  assert.match(src,/const nextStatus = payload\.new\?\.status/);
  assert.match(src,/isValidListingStatus\(nextStatus\)/);
  assert.doesNotMatch(src,/payload\.new\?\.(postal_code|lat|lng)/);
});
