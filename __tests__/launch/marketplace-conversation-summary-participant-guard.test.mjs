import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync("app/api/messages/conversation-summary/route.ts","utf8");
test("summary requires an authenticated user and a verified participant",()=>{
 assert.match(src,/if \(!user\)[\s\S]{0,100}status: 401/);
 const read=src.indexOf('.from("conversations")');
 const fail=src.indexOf('conversation.buyer_id !== user.id && conversation.seller_id !== user.id');
 const admin=src.indexOf('const admin = createAdminClient()');
 assert.ok(read>=0 && fail>read && admin>fail,"Membership check must precede any service-role read");
});
test("nonmember conversation ID fails with indistinguishable 404 before fetching names or messages",()=>{
 const gate=src.match(/if \(conversation\.buyer_id !== user\.id && conversation\.seller_id !== user\.id\) \{([\s\S]*?)\n  \}/);
 assert.ok(gate);
 assert.match(gate[1],/privateJson\\(\\{ error: "Conversación no encontrada\\." \\}, 404\\)/);
 assert.match(gate[1],/Conversación no encontrada/);
 assert.doesNotMatch(gate[1],/full_name|latestMessage|otherName/);
});
test("conversation summary never returns email, CP or coordinates",()=>{
 const responseStart=src.indexOf('  return privateJson({\\n    conversation:');
 assert.ok(responseStart>=0,"private chat response must be present");
 const response=src.slice(responseStart).split('  } catch {',1)[0];
 assert.doesNotMatch(response,/\b(postal_code|lat|lng|email|password)\b/);
 assert.match(response,/otherName: profile\?\.full_name/);
});
