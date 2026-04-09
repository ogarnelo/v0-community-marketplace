import type { SupabaseClient } from "@supabase/supabase-js";

export async function getOrCreateConversation(params: {
  supabase: SupabaseClient;
  listingId: string;
  buyerId: string;
  sellerId: string;
}) {
  const { supabase, listingId, buyerId, sellerId } = params;

  const { data: existingConversation, error: existingConversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (existingConversationError) {
    throw new Error(existingConversationError.message || "No se pudo consultar la conversación.");
  }

  let conversationId = existingConversation?.id || null;

  if (!conversationId) {
    const { data: newConversation, error: newConversationError } = await supabase
      .from("conversations")
      .insert({
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: sellerId,
      })
      .select("id")
      .single();

    if (newConversationError || !newConversation) {
      throw new Error(newConversationError?.message || "No se pudo abrir el chat.");
    }

    conversationId = newConversation.id;
  }

  await supabase
    .from("hidden_conversations")
    .delete()
    .eq("conversation_id", conversationId)
    .in("user_id", [buyerId, sellerId]);

  return conversationId;
}

export async function touchConversation(
  supabase: SupabaseClient,
  conversationId: string | null,
  timestamp = new Date().toISOString()
) {
  if (!conversationId) return;

  await supabase.from("conversations").update({ updated_at: timestamp }).eq("id", conversationId);
}
