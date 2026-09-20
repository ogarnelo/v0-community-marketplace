import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const conversationId = new URL(request.url).searchParams.get("conversation_id")?.trim();
  if (!conversationId) {
    return NextResponse.json({ error: "Conversación no válida." }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, listing_id, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "Conversación no encontrada." }, { status: 404 });
  }

  const otherUserId =
    conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;

  if (!otherUserId) {
    return NextResponse.json({ error: "Conversación no válida." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: listing }, { data: profile }, { data: latestMessage }] = await Promise.all([
    supabase
      .from("listings")
      .select("title")
      .eq("id", conversation.listing_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("full_name")
      .eq("id", otherUserId)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("body, created_at, attachment_name")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const latestMessageBody =
    latestMessage?.body?.trim() ||
    (latestMessage?.attachment_name ? `📎 ${latestMessage.attachment_name}` : "Sin mensajes todavía");

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      otherName: profile?.full_name?.trim() || "Usuario",
      listingTitle: listing?.title || "Anuncio",
      latestMessageBody,
      latestMessageCreatedAt: latestMessage?.created_at || null,
      unreadCount: 0,
    },
  });
}
