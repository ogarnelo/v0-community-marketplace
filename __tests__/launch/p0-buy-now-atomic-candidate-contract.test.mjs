import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const path="scripts/p0_buy_now_atomic_candidate_review_only.sql";
const sql=readFileSync(path,"utf8");
test("candidate stays review-only and separate from production migrations",()=>{
 assert.match(sql,/REVIEW ONLY, NEVER AUTODEPLOY/);
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;/);
 assert.doesNotMatch(sql,/CREATE EXTENSION|TRUNCATE |DROP TABLE|ALTER DEFAULT PRIVILEGES/i);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/);
});
test("a single PostgreSQL function owns all atomic checkout database writes",()=>{
 const body=sql.slice(sql.indexOf("AS $wetudy$"),sql.indexOf("$wetudy$;",sql.indexOf("AS $wetudy$")));
 for(const table of ["listings","conversations","listing_offers",
   "listing_offer_events","messages","hidden_conversations","payment_intents"]){
  assert.match(body,new RegExp("public\\."+table));
 }
 assert.match(body,/FOR UPDATE/);
 assert.match(body,/v_listing.status IS DISTINCT FROM 'available'/);
 assert.match(body,/v_listing.listing_type IS DISTINCT FROM 'sale'/);
 assert.match(body,/v_listing.seller_id IS DISTINCT FROM p_seller_id/);
 assert.match(body,/v_listing.price IS DISTINCT FROM p_expected_price/);
 assert.match(body,/p_total_amount <> p_expected_price \+ p_buyer_fee \+ p_shipping_amount/);
});
test("accepted offers follow live CHECK actor rule and preserve parsable chat format",()=>{
 assert.match(sql,/accepted_amount,current_actor,rounds_count,status,responded_at[\s\S]*p_expected_price,NULL,1,'accepted'/);
 assert.match(sql,/OFFER_EVENT\|%s\|%s\|accepted\|buyer\|%s\|1\|accepted\|closed/);
 assert.doesNotMatch(sql,/current_actor\s*=\s*'closed'/i);
});
test("candidate cannot bypass authorization by being wired into production routes",()=>{
 const route=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 assert.doesNotMatch(route,/p0_buy_now_prepare_atomic_candidate/);
 const workflow=readFileSync(".github/workflows/contracts.yml","utf8");
 assert.match(workflow,/p0-buy-now-atomic-candidate-contract/);
});
