import type { SupabaseClient } from "@supabase/supabase-js";
import { deferProductEvent } from "@/lib/analytics/product-events.server";

export async function getOrCreateConversation(params: {
  supabase: SupabaseClient;
  listingId: string;
  buyerId: string;
  sellerId: string;
}) {
  const { supabase, listingId, buyerId, sellerId } = params;

  const existingQuery = () => supabase.from("conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  const { data: existingConversation, error: existingConversationError } = await existingQuery();
  if (existingConversationError) {
    throw new Error("No se pudo consultar la conversación.");
  }

  let conversationId: string | null = existingConversation?.id || null;
  if (!conversationId) {
    const { data: newConversation, error: newConversationError } = await supabase
      .from("conversations")
      .insert({ listing_id: listingId, buyer_id: buyerId, seller_id: sellerId })
      .select("id")
      .single();

    if (newConversationError?.code === "23505") {
      // Another request won the UNIQUE index
      // (listing_id,buyer_id,seller_id). Reuse only this exact conversation.
      const { data: winner, error: winnerError } = await existingQuery();
      if (winnerError || !winner?.id) {
        throw new Error("No se pudo reconciliar la conversación concurrente.");
      }
      conversationId = winner.id;
    } else {
      if (newConversationError || !newConversation?.id) {
        throw new Error("No se pudo abrir el chat.");
      }
      conversationId = newConversation.id;
      deferProductEvent("conversation_started", { source: "marketplace" });
    }
  }

  // If a participant previously hid this thread, an incoming event must
  // restore its visibility. Do not silently claim a visible chat on SQL error.
  const { error: unhideError } = await supabase
    .from("hidden_conversations")
    .delete()
    .eq("conversation_id", conversationId)
    .in("user_id", [buyerId, sellerId]);
  if (unhideError) {
    throw new Error("No se pudo mostrar la conversación a los participantes.");
  }
  return conversationId;
}

export async function touchConversation(
  supabase: SupabaseClient,
  conversationId: string | null,
  timestamp = new Date().toISOString()
) {
  if (!conversationId) return;
  const { data: touched, error: touchError } = await supabase
    .from("conversations")
    .update({ updated_at: timestamp })
    .eq("id", conversationId)
    .select("id")
    .maybeSingle();
  if (touchError || !touched) {
    throw new Error("No se pudo sincronizar la conversación.");
  }
}
