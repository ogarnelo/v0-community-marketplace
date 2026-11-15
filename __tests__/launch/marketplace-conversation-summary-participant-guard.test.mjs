import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("app/api/messages/conversation-summary/route.ts", "utf8");

test("summary requires authenticated user and verifies participant before service-role access", () => {
  assert.match(src, /if \(!user\)/);
  assert.ok(src.includes('return privateJson({ error: "No autenticado." }, 401)'));
  const read = src.indexOf('.from("conversations")');
  const participant = src.indexOf('conversation.buyer_id !== user.id && conversation.seller_id !== user.id');
  const admin = src.indexOf('const admin = createAdminClient()');
  assert.ok(read >= 0 && participant > read && admin > participant,
    "Membership check must precede any service-role read");
});

test("nonmember conversation returns private 404 before fetching names or messages", () => {
  const start = src.indexOf('if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id)');
  assert.ok(start >= 0);
  const gate = src.slice(start, src.indexOf("  const otherUserId =", start));
  assert.ok(gate.includes('return privateJson({ error: "Conversación no encontrada." }, 404)'));
  assert.doesNotMatch(gate, /full_name|latestMessage|otherName/);
  assert.match(src, /Cache-Control": "private, no-store"/);
});

test("authorized conversation payload excludes email, exact postcode and coordinates", () => {
  const start = src.indexOf('  return privateJson({\n    conversation:');
  assert.ok(start >= 0, "private chat payload must exist");
  const body = src.slice(start, src.indexOf("  } catch {", start));
  assert.doesNotMatch(body, /\b(postal_code|lat|lng|email|password)\b/);
  assert.match(body, /otherName: profile\?\.full_name/);
});
