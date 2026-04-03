
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const body = await req.json();

  const { listing_id, buyer_id, seller_id, offered_price } = body;

  if (!listing_id || !buyer_id || !seller_id || !offered_price) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const { data: offer, error: offerError } = await supabase
    .from("listing_offers")
    .insert({
      listing_id,
      buyer_id,
      seller_id,
      offered_price,
      status: "pending"
    })
    .select()
    .single();

  if (offerError) {
    return NextResponse.json({ error: offerError.message }, { status: 500 });
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("listing_id", listing_id)
    .eq("buyer_id", buyer_id)
    .eq("seller_id", seller_id)
    .maybeSingle();

  let conversationId = conversation?.id;

  if (!conversationId) {
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({
        listing_id,
        buyer_id,
        seller_id
      })
      .select()
      .single();

    conversationId = newConv.id;
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: buyer_id,
    body: `💰 Oferta enviada: ${offered_price}€`
  });

  return NextResponse.json({ success: true, offer });
}
