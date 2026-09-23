import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFirstMessageEmail } from "@/lib/emails/mvp-event-emails";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
    const messageId = typeof body?.messageId === "string" ? body.messageId.trim() : "";
    if (!conversationId || !messageId) return NextResponse.json({ error: "Falta la conversación o el mensaje." }, { status: 400 });

    const admin = createAdminClient();
    const [{ data: conversation }, { data: message }] = await Promise.all([
      admin.from("conversations").select("id, listing_id, buyer_id, seller_id").eq("id", conversationId).maybeSingle(),
      admin.from("messages").select("id, conversation_id, sender_id, body, attachment_name, created_at").eq("id", messageId).maybeSingle(),
    ]);

    if (!conversation) return NextResponse.json({ error: "No se encontró la conversación." }, { status: 404 });
    if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) return NextResponse.json({ error: "No puedes gestionar esta conversación." }, { status: 403 });
    if (!message || message.conversation_id !== conversation.id || message.sender_id !== user.id) return NextResponse.json({ error: "No puedes procesar este mensaje." }, { status: 403 });

    const recipientId = user.id === conversation.buyer_id ? conversation.seller_id : conversation.buyer_id;
    const [{ data: listing }, { data: recipientProfile }, { data: senderProfile }, recipientAuth] = await Promise.all([
      admin.from("listings").select("title").eq("id", conversation.listing_id).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", recipientId).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      admin.auth.admin.getUserById(recipientId),
    ]);

    const senderName =
      senderProfile?.full_name?.trim() ||
      user.user_metadata?.full_name?.trim() ||
      user.email ||
      "Un usuario";
    const messagePreview =
      message.body?.trim() ||
      (message.attachment_name ? `Archivo adjunto: ${message.attachment_name}` : "Te ha enviado un mensaje.");

    const { data: existingMessageNotification, error: existingMessageNotificationError } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", recipientId)
      .eq("kind", "message_received")
      .contains("metadata", { message_id: message.id })
      .limit(1)
      .maybeSingle();

    if (existingMessageNotificationError) throw existingMessageNotificationError;

    if (!existingMessageNotification) {
      const { error: notificationError } = await createNotification(admin, {
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
    }

    const { data: firstMessage, error: firstMessageError } = await admin
      .from("messages")
      .select("id")
      .eq("conversation_id", conversation.id)
      .eq("sender_id", user.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstMessageError) throw firstMessageError;

    if (firstMessage?.id === message.id) {
      const recipientEmail = recipientAuth.data.user?.email;

      if (recipientEmail) {
        try {
          await sendFirstMessageEmail({
            to: recipientEmail,
            recipientName: recipientProfile?.full_name,
            listingTitle: listing?.title || "el anuncio",
            conversationId: conversation.id,
            idempotencyKey: `first-message/${message.id}`,
          });
        } catch (emailError) {
          console.error("No se pudo enviar el email del primer mensaje", emailError);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo procesar el aviso." }, { status: 500 });
  }
}
