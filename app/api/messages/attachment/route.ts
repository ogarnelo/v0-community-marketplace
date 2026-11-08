import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dispositionForAttachment,
  safeAttachmentType,
  validChatAttachmentPath,
} from "@/lib/messages/private-attachment-guards.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SECURE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function failure(status: number) {
  return NextResponse.json(
    { error: status === 401 ? "Debes iniciar sesión." : "Adjunto no disponible." },
    { status, headers: SECURE_HEADERS }
  );
}

// No service-role or signed tokens: every GET must be authorized afresh.
export async function GET(request: Request) {
  const messageId = new URL(request.url).searchParams.get("messageId") || "";
  if (!UUID_RE.test(messageId)) return failure(400);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return failure(401);

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("id, conversation_id, attachment_path, attachment_type, attachment_name")
    .eq("id", messageId)
    .maybeSingle();

  if (messageError || !message || !message.attachment_path) return failure(404);

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id")
    .eq("id", message.conversation_id)
    .maybeSingle();

  if (
    conversationError || !conversation ||
    (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) ||
    !validChatAttachmentPath(message.attachment_path, conversation.id)
  ) {
    return failure(404);
  }

  // RLS on storage.objects enforces the *current* conversation membership.
  const { data: file, error: fileError } = await supabase.storage
    .from("chat-attachments")
    .download(message.attachment_path);

  if (fileError || !file) return failure(404);

  return new Response(file, {
    status: 200,
    headers: {
      ...SECURE_HEADERS,
      "Content-Type": safeAttachmentType(message.attachment_type),
      "Content-Disposition": dispositionForAttachment(message.attachment_type, message.attachment_name),
    },
  });
}
