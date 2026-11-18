import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const script=readFileSync("scripts/p0_pg17_concurrent_buy_now_smoke.sh","utf8");
const fixture=readFileSync("scripts/p0_pg17_atomic_candidates_fixture.sql","utf8");
const workflow=readFileSync(".github/workflows/p0-atomic-review-only-pg17.yml","utf8");
test("two-buyer PG17 race uses local-only DB and two separate worker sessions",()=>{
 assert.match(script,/PGHOST:-.*127\.0\.0\.1/);
 assert.match(script,/PGDATABASE:-.*wetudy_p0_synthetic/);
 assert.match(script,/PGAPPNAME=wetudy_pg17_buyer_first/);
 assert.match(script,/pg_stat_activity/);
 assert.match(script,/P0_BUY_NOW_LISTING_CHANGED/);
 assert.match(script,/wait "\$first_pid"/);
 assert.match(script,/two-buyer concurrent checkout/);
});
test("PG17 synthetic fixture reproduces critical production UNIQUE indexes",()=>{
 for(const name of ["conversations_listing_buyer_seller_idx",
   "payment_intents_offer_unique_idx","listing_offers_active_negotiation_idx"]){
  assert.match(fixture,new RegExp(name));
 }
 assert.match(workflow,/bash scripts\/p0_pg17_concurrent_buy_now_smoke\.sh/);
 assert.match(workflow,/paths:[\s\S]*p0_pg17_concurrent_buy_now_smoke\.sh/);
});
