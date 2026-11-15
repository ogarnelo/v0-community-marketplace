import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFirstMessageEmail } from "@/lib/emails/mvp-event-emails";
import { createNotificationOnce } from "@/lib/notifications";
import { sendTransactionalEmailOnce } from "@/lib/emails/delivery-idempotency";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    // An Auth outage is not proof of a session, even if stale user data is
    // returned alongside an error. No privileged message read may follow it.
    if (authError) return privateJson({ error: "No se pudo comprobar tu sesión." }, 503);
    const user = authData?.user ?? null;
    if (!user) return privateJson({ error: "Debes iniciar sesión." }, 401);

    const body = await request.json().catch(() => ({}));
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
    const messageId = typeof body?.messageId === "string" ? body.messageId.trim() : "";
    if (!UUID_RE.test(conversationId) || !UUID_RE.test(messageId)) return privateJson({ error: "Falta la conversación o el mensaje." }, 400);

    // Gate access through the caller's RLS context before privileged reads.
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, listing_id, buyer_id, seller_id")
      .eq("id", conversationId).maybeSingle();
    if (conversationError) return privateJson({ error: "No se pudo consultar la conversación." }, 503);
    if (!conversation) return privateJson({ error: "No se encontró la conversación." }, 404);
    if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) {
      return privateJson({ error: "No se encontró la conversación." }, 404);
    }
    const admin = createAdminClient();
    const { data: message, error: messageError } = await admin
      .from("messages").select("id, conversation_id, sender_id, body, attachment_name, created_at")
      .eq("id", messageId).maybeSingle();
    if (messageError) return privateJson({ error: "No se pudo procesar el aviso." }, 503);

    if (!message || message.conversation_id !== conversation.id || message.sender_id !== user.id) return privateJson({ error: "No puedes procesar este mensaje." }, 403);

    const recipientId = user.id === conversation.buyer_id ? conversation.seller_id : conversation.buyer_id;
    const [
      { data: listing, error: listingError },
      { data: recipientProfile, error: recipientProfileError },
      { data: senderProfile, error: senderProfileError },
      recipientAuth,
    ] = await Promise.all([
      admin.from("listings").select("title").eq("id", conversation.listing_id).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", recipientId).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      admin.auth.admin.getUserById(recipientId),
    ]);
    // Never create a notification using partial recipient identity or stale
    // listing metadata when a privileged read has failed. A retry is safe
    // because the notification and email both carry deterministic event keys.
    if (listingError || recipientProfileError || senderProfileError || recipientAuth.error) {
      console.error("message_notification_recipient_lookup_failed");
      return privateJson({ error: "No se pudo procesar el aviso." }, 503);
    }

    const senderName =
      senderProfile?.full_name?.trim() ||
      user.user_metadata?.full_name?.trim() ||
      user.email ||
      "Un usuario";
    const messagePreview =
      message.body?.trim() ||
      (message.attachment_name ? `Archivo adjunto: ${message.attachment_name}` : "Te ha enviado un mensaje.");

    const { data: firstMessage, error: firstMessageError } = await admin
      .from("messages")
      .select("id")
      .eq("conversation_id", conversation.id)
      .eq("sender_id", user.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstMessageError) {
      console.error("message_first_message_lookup_failed");
      return privateJson({ error: "No se pudo procesar el aviso." }, 503);
    }

    const { error: notificationError } = await createNotificationOnce(admin, {
      event_key: `message-received/${message.id}`,
      user_id: recipientId,
      kind: "message_received",
      title: `Nuevo mensaje de ${senderName}`,
      body: messagePreview.slice(0, 240),
      href: `/messages/${conversation.id}`,
      metadata: {
        conversation_id: conversation.id,
        message_id: message.id,
        listing_id: conversation.listing_id,
      },
    });
    if (notificationError) throw notificationError;

    if (firstMessage?.id === message.id) {
      const recipientEmail = recipientAuth.data?.user?.email;

      if (recipientEmail) {
        try {
          const eventKey = `first-message/${message.id}`;
          await sendTransactionalEmailOnce(admin, {
            eventKey,
            userId: recipientId,
            recipientEmail,
            kind: "first_message",
            send: () =>
              sendFirstMessageEmail({
                to: recipientEmail,
                recipientName: recipientProfile?.full_name,
                listingTitle: listing?.title || "el anuncio",
                conversationId: conversation.id,
                idempotencyKey: eventKey,
              }),
          });
        } catch {
          console.error("first_message_email_delivery_failed");
        }
      }
    }

    return privateJson({ ok: true });
  } catch {
    console.error("message_notification_processing_failed");
    return privateJson({ error: "No se pudo procesar el aviso." }, 500);
  }
}
