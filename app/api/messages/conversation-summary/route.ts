import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return privateJson({ error: "No autenticado." }, 401);
  }

  const conversationId = new URL(request.url).searchParams.get("conversation_id")?.trim();
  if (!conversationId || !UUID_RE.test(conversationId)) {
    return privateJson({ error: "Conversación no válida." }, 400);
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, listing_id, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError || !conversation) {
    return privateJson({ error: "Conversación no encontrada." }, 404);
  }

  // Defense in depth: never resolve privileged profiles for a nonparticipant,
  // even if a future RLS migration accidentally broadens conversation SELECT.
  if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) {
    return privateJson({ error: "Conversación no encontrada." }, 404);
  }

  const otherUserId =
    conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;

  if (!otherUserId) {
    return privateJson({ error: "Conversación no válida." }, 400);
  }

  const admin = createAdminClient();
  const [{ data: listing, error: listingError }, { data: profile, error: profileError }, { data: latestMessage, error: messageError }] = await Promise.all([
    // The participant check above is mandatory before a service-role lookup.
    // Buyers must still see the title when a negotiated listing is reserved
    // or sold: the public available-only RLS predicate no longer matches it.
    admin
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

  if (listingError || profileError || messageError) {
    // Never present a fabricated conversation summary after a failed private read.
    return privateJson({ error: "No se pudo cargar la conversación." }, 503);
  }

  const latestMessageBody =
    latestMessage?.body?.trim() ||
    (latestMessage?.attachment_name ? `📎 ${latestMessage.attachment_name}` : "Sin mensajes todavía");

  return privateJson({
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
