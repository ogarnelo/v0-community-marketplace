import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("scripts/p0_commerce_consistency_audit_read_only.sql","utf8");

test("commerce reconciliation cannot mutate production",()=>{
  const clean=sql.replace(/--[^\n]*/g,"");
  assert.match(clean,/BEGIN READ ONLY;/i);
  assert.match(clean,/COMMIT;/i);
  assert.doesNotMatch(clean,/\b(?:ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|TRUNCATE|REVOKE|GRANT|CALL|DO|EXECUTE)\b/i);
});
test("reserved status includes agreements and accepted offers to prevent false alarms",()=>{
  assert.match(sql,/l\.status = 'reserved'/);
  assert.match(sql,/NOT EXISTS\s*\(\s*SELECT 1 FROM public\.listing_offers/);
  assert.match(sql,/NOT EXISTS\s*\(\s*SELECT 1 FROM public\.agreements/);
  assert.match(sql,/a\.listing_id = l\.id/);
  assert.match(sql,/o\.status = 'accepted'/);
});
test("aggregate-only output; no row-identifying fields",()=>{
  const clean=sql.replace(/--[^\n]*/g,"");
  assert.doesNotMatch(clean,/SELECT\s+(?:\*|[a-z]+\.(?:id|email|buyer_id|seller_id|user_id))/i);
  assert.match(clean,/HAVING count\(\*\) > 1/);
  assert.match(clean,/payment_offer_listing_mismatch/);
  assert.match(clean,/payment_intents_with_missing_offer/);
});
