import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversationId = request.nextUrl.searchParams.get("conversationId")?.trim();
  const before = request.nextUrl.searchParams.get("before")?.trim();

  if (!conversationId || !before) {
    return NextResponse.json({ error: "Missing conversation or cursor" }, { status: 400 });
  }

  const beforeDate = new Date(before);
  if (Number.isNaN(beforeDate.getTime())) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (
    conversationError ||
    !conversation ||
    (conversation.buyer_id !== user.id && conversation.seller_id !== user.id)
  ) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, body, attachment_url, attachment_path, attachment_name, attachment_type, attachment_size, read_at, created_at"
    )
    .eq("conversation_id", conversationId)
    .lt("created_at", beforeDate.toISOString())
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (error) {
    console.error("messages_history_error", error);
    return NextResponse.json({ error: "No se pudieron cargar mensajes anteriores." }, { status: 500 });
  }

  const rows = data || [];
  const hasMore = rows.length > PAGE_SIZE;
  const messages = rows.slice(0, PAGE_SIZE).reverse();

  return NextResponse.json({
    ok: true,
    messages,
    hasMore,
  });
}
