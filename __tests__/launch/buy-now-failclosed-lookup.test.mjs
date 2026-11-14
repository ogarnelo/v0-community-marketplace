import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const route=readFileSync("app/api/offers/buy-now/route.ts","utf8");
test("buy-now checks conversation query error before any new conversation",()=>{
 const lookup=route.indexOf("data: existingConversation, error: existingConversationError");
 const guard=route.indexOf("if (existingConversationError)");
 const insert=route.indexOf('.from("conversations")\n        .insert(');
 assert.ok(lookup>=0 && guard>lookup && insert>guard);
 assert.match(route.slice(guard,insert),/status: 503/);
});
test("buy-now limits historical offers to one and aborts before new offer creation",()=>{
 const lookup=route.indexOf("data: activeOffer, error: activeOfferError");
 const guard=route.indexOf("if (activeOfferError)");
 const insert=route.indexOf('.from("listing_offers")\n        .insert(');
 assert.ok(lookup>=0 && guard>lookup && insert>guard);
 assert.match(route.slice(lookup,guard),/\.limit\(1\)\s*\.maybeSingle\(\)/);
 assert.match(route.slice(guard,insert),/status: 503/);
});
