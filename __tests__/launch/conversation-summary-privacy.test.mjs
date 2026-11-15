import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const route=readFileSync("app/api/messages/conversation-summary/route.ts","utf8");
const auth=route.indexOf("if (!user)");
const conversationQuery=route.indexOf('.from("conversations")');
const participantCheck=route.indexOf("conversation.buyer_id !== user.id && conversation.seller_id !== user.id");
const admin=route.indexOf("const admin = createAdminClient()");
const listing=route.indexOf('.from("listings")');
const profile=route.indexOf('.from("profiles")');

test("no privileged listing/profile access before authenticated participant check",()=>{
  assert.ok(auth>=0 && conversationQuery>auth);
  assert.ok(participantCheck>conversationQuery);
  assert.ok(admin>participantCheck && listing>admin && profile>admin);
  assert.ok(route.includes('return privateJson({ error: "Conversación no encontrada." }, 404)'));
});
test("authorized buyer retains reserved/sold listing title through server-only lookup",()=>{
  const afterCheck=route.slice(admin);
  assert.match(afterCheck,/admin\s*\.from\("listings"\)\s*\.select\("title"\)\s*\.eq\("id", conversation\.listing_id\)/);
  assert.doesNotMatch(afterCheck,/supabase\s*\.from\("listings"\)/);
  assert.match(route,/listingTitle: listing\?\.title \|\| "Anuncio"/);
});
test("message body still uses participant-scoped RLS, not service role",()=>{
  assert.match(route,/supabase\s*\.from\("messages"\)\s*\.select\("body, created_at, attachment_name"\)/);
  assert.doesNotMatch(route,/admin\s*\.from\("messages"\)/);
});

test("private chat response, malformed UUID and backend errors fail closed",()=>{
  assert.match(route,/Cache-Control": "private, no-store"/);
  assert.match(route,/UUID_RE\.test\(conversationId\)/);
  assert.match(route,/listingError \|\| profileError \|\| messageError/);
  assert.match(route,/return privateJson\(\{ error: "No se pudo cargar la conversación\." \}, 503\)/);
  assert.doesNotMatch(route,/console\.error\([^)]*conversationError/);
});
