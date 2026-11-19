import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
const buyPath="docs/pilot/sql/p0_buy_now_atomic_rpc_dormant_applied_20261119.sql";
const claimPath="docs/pilot/sql/p0_school_impact_durable_claim_dormant_applied_20261119.sql";
const buy=readFileSync(buyPath,"utf8"),claims=readFileSync(claimPath,"utf8");
test("applied SQL archives are non-autodeployed and their history is explicit",()=>{
 assert.ok(existsSync("docs/pilot/P0_MIGRATION_LEDGER_PRODUCTION_2026-11-19.md"));
 assert.equal(existsSync("supabase/migrations/20261119081526_p0_buy_now_atomic_rpc_dormant_20261119.sql"),false);
 assert.equal(existsSync("supabase/migrations/20261119081627_p0_school_impact_durable_claim_dormant_20261119.sql"),false);
 assert.match(readFileSync("docs/pilot/P0_MIGRATION_LEDGER_PRODUCTION_2026-11-19.md","utf8"),/20261119081526[\s\S]*20261119081627/);
});
test("deployed atomic payment records item price, total and buyer fee consistently",()=>{
 assert.match(buy,/seller_net_amount,platform_fee_amount,shipment_tier,metadata/);
 assert.match(buy,/v_listing\.school_id,p_expected_price,'EUR'/);
 assert.match(buy,/p_buyer_fee,p_shipping_amount,p_expected_price,p_buyer_fee,p_shipment_tier/);
 assert.match(buy,/'total_buyer_amount',p_total_amount/);
 assert.match(buy,/p_shipping_amount <= 0/);
 assert.match(buy,/p_shipping_amount <> 0/);
 assert.doesNotMatch(buy,/v_listing\.school_id,p_total_amount,'EUR'/);
});
test("deployed functions are invoker-only and have an in-transaction security guard",()=>{
 for(const sql of [buy,claims]){
  assert.match(sql,/LANGUAGE plpgsql SECURITY INVOKER/);
  assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/DO \$guard\$/);
  assert.doesNotMatch(sql,/^BEGIN;$/m);
  assert.doesNotMatch(sql,/^COMMIT;$/m);
  assert.doesNotMatch(sql,/TRUNCATE |DROP TABLE|ALTER DEFAULT PRIVILEGES/i);
 }
 assert.match(claims,/ENABLE ROW LEVEL SECURITY/);
 assert.match(claims,/UNIQUE\(subscription_id,period_key\)/);
 assert.match(claims,/ON CONFLICT\(subscription_id,period_key\) DO NOTHING/);
 assert.match(claims,/REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC,anon,authenticated/);
});
test("no checkout or email routes call the dormant SQL RPCs",()=>{
 for(const path of ["app/api/offers/buy-now/route.ts","app/api/cron/school-impact-reports/route.ts"]){
  const source=readFileSync(path,"utf8");
  assert.doesNotMatch(source,/p0_buy_now_prepare_atomic_candidate|p0_school_impact_claim_candidate/);
 }
});
