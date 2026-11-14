import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const route=readFileSync("app/api/listings/delete/route.ts","utf8");
const sql=readFileSync("scripts/pilot-listing-delete-fk-regression.sql","utf8");
const workflow=readFileSync(".github/workflows/pilot-marketplace-alert-outbox.yml","utf8");
const check=route.indexOf("if (lookups.some((result) => result.error))");
const operation=route.indexOf('    const { data: deletedRows, error: deleteError } = await admin');
const history=route.indexOf("const hasModerationOrConversationHistory");

test("all destructive history checks fail closed on query errors",()=>{
  assert.ok(check>0 && history>check && operation>history);
  assert.match(route,/lookups\.some\(\(result\) => result\.error\)/);
  assert.match(route,/status: 503/);
});
test("payment history is preserved regardless of paid, refunded or cancelled status",()=>{
  assert.match(route,/admin\.from\("payment_intents"\)\.select\("id"\)\.eq\("listing_id", listingId\)\.limit\(1\)/);
  assert.doesNotMatch(route,/BLOCKING_PAYMENT_STATUSES/);
  assert.match(route,/anyRows\(paymentsResult\)/);
});
test("all contractual/messaging history prevents CASCADE hard deletion",()=>{
  for(const table of ["conversations","reports","listing_offers","donation_requests",
    "agreements","shipments","reviews","transaction_issues","listing_boosts"]){
    assert.ok(route.includes('admin.from("'+table+'").select("id").eq("listing_id", listingId)'),table+" lookup absent");
  }
  assert.match(route,/if \(hasModerationOrConversationHistory\)/);
});
test("real PG17 fixture covers atomic CASCADE and RESTRICT",()=>{
  assert.match(sql,/ON DELETE CASCADE/);
  assert.match(sql,/ON DELETE RESTRICT/);
  assert.match(sql,/foreign_key_violation/);
  assert.match(sql,/ROLLBACK;/);
  assert.match(workflow,/pilot-listing-delete-fk-regression\.sql/);
});
