import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFirstMessageEmail } from "@/lib/emails/mvp-event-emails";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
    if (!conversationId) return NextResponse.json({ error: "Falta la conversación." }, { status: 400 });
    const admin = createAdminClient();
    const { data: conversation } = await admin.from("conversations").select("id, listing_id, buyer_id, seller_id").eq("id", conversationId).maybeSingle();
    if (!conversation) return NextResponse.json({ error: "No se encontró la conversación." }, { status: 404 });
    if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) return NextResponse.json({ error: "No puedes gestionar esta conversación." }, { status: 403 });
    const recipientId = user.id === conversation.buyer_id ? conversation.seller_id : conversation.buyer_id;
    const [{ count: senderMessageCount }, { data: listing }, { data: recipientProfile }, recipientAuth] = await Promise.all([
      admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversation.id).eq("sender_id", user.id),
      admin.from("listings").select("title").eq("id", conversation.listing_id).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", recipientId).maybeSingle(),
      admin.auth.admin.getUserById(recipientId),
    ]);
    const recipientEmail = recipientAuth.data.user?.email;
    if ((senderMessageCount || 0) !== 1 || !recipientEmail) return NextResponse.json({ ok: true, skipped: true });
    try {
      await sendFirstMessageEmail({ to: recipientEmail, recipientName: recipientProfile?.full_name, listingTitle: listing?.title || "el anuncio", conversationId: conversation.id });
    } catch (emailError) {
      console.error("No se pudo enviar el email del primer mensaje", emailError);
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo procesar el aviso." }, { status: 500 });
  }
}
