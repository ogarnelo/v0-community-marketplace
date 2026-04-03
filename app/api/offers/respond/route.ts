
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const body = await req.json();

  const { offer_id, action, counter_price } = body;

  const { data: offer } = await supabase
    .from("listing_offers")
    .select("*")
    .eq("id", offer_id)
    .single();

  if (!offer) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  let newStatus = "pending";
  let message = "";

  if (action === "accept") {
    newStatus = "accepted";
    message = "Oferta aceptada";
  }

  if (action === "reject") {
    newStatus = "rejected";
    message = "Oferta rechazada";
  }

  if (action === "counter") {
    newStatus = "countered";
    message = `Contraoferta: ${counter_price}€`;
  }

  await supabase
    .from("listing_offers")
    .update({
      status: newStatus,
      counter_price
    })
    .eq("id", offer_id);

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("listing_id", offer.listing_id)
    .eq("buyer_id", offer.buyer_id)
    .eq("seller_id", offer.seller_id)
    .single();

  if (conversation) {
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: offer.seller_id,
      body: message
    });
  }

  if (action === "accept") {
    await supabase
      .from("listings")
      .update({ status: "reserved" })
      .eq("id", offer.listing_id);
  }

  return NextResponse.json({ success: true });
}
