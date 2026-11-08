import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validChatAttachmentPath, safeAttachmentType, dispositionForAttachment,
} from "../../lib/messages/private-attachment-guards.mjs";

const source = (path) => readFileSync(path, "utf8");
const route = source("app/api/messages/attachment/route.ts");
const sender = source("components/messages/send-message-form.tsx");
const viewer = source("components/messages/realtime-chat-messages.tsx");
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const c = "33333333-3333-4333-8333-333333333333";

test("private path guard requires conversation prefix and uploader UUID", () => {
  assert.equal(validChatAttachmentPath(`${a}/${b}/photo.png`,a),true);
  assert.equal(validChatAttachmentPath(`${a}/${b}/file.pdf`,c),false);
  assert.equal(validChatAttachmentPath(`${a}/${b}/../photo.png`,a),false);
  assert.equal(validChatAttachmentPath(`${a}/${b}/file\\evil.pdf`,a),false);
  assert.equal(validChatAttachmentPath(`${a}/not-a-uuid/file.pdf`,a),false);
  assert.equal(validChatAttachmentPath(null,a),false);
});

test("attachments never execute HTML or SVG under browser inline mode", () => {
  assert.equal(safeAttachmentType("image/png"),"image/png");
  assert.equal(safeAttachmentType("image/svg+xml"),"application/octet-stream");
  assert.equal(safeAttachmentType("text/html"),"application/octet-stream");
  assert.match(dispositionForAttachment("text/html"),/^attachment;/);
  assert.match(dispositionForAttachment("image/webp"),/^inline;/);
});

test("private download verifies current user, message and membership without service role", () => {
  assert.match(route,/supabase\.auth\.getUser\(\)/);
  assert.match(route,/\.from\("messages"\)/);
  assert.match(route,/\.eq\("id", messageId\)/);
  assert.match(route,/\.from\("conversations"\)/);
  assert.match(route,/conversation\.buyer_id !== user\.id && conversation\.seller_id !== user\.id/);
  assert.match(route,/validChatAttachmentPath\(message\.attachment_path, conversation\.id\)/);
  assert.match(route,/\.from\("chat-attachments"\)[\s\S]*?\.download\(message\.attachment_path\)/);
  assert.doesNotMatch(route,/createAdminClient|service_role|createSignedUrl/);
});

test("download is non-cacheable and rejects malicious content inline",()=>{
  assert.match(route,/private, no-store, max-age=0/);
  assert.match(route,/X-Content-Type-Options/);
  assert.match(route,/nosniff/);
  assert.match(route,/Content-Disposition/);
  assert.match(route,/failure\(401\)/);
  assert.match(route,/failure\(404\)/);
});

test("sending and rendering messages do not persist or expose 7-day bearer links",()=>{
  assert.doesNotMatch(sender,/createSignedUrl\s*\(/);
  assert.match(sender,/attachment_url: attachmentUrl/);
  assert.match(sender,/let attachmentUrl: string \| null = null/);
  assert.match(sender,/attachment_path: attachmentPath/);
  assert.match(viewer,/const hasAttachment = !!message\.attachment_path/);
  assert.match(viewer,/\x60\/api\/messages\/attachment\?messageId=\$\{encodeURIComponent\(message\.id\)\}\x60/);
  assert.doesNotMatch(viewer,/href=\{message\.attachment_url\}|src=\{message\.attachment_url\}/);
});
