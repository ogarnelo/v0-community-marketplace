import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getOrCreateConversationId(params: {
  listingId: string;
  buyerId: string;
  sellerId: string;
}) {
  const adminSupabase = createAdminClient();
  const { listingId, buyerId, sellerId } = params;

  const { data: existingConversation } = await adminSupabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (existingConversation?.id) {
    return existingConversation.id;
  }

  const { data: newConversation, error: conversationError } = await adminSupabase
    .from("conversations")
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: sellerId,
    })
    .select("id")
    .single();

  if (conversationError || !newConversation?.id) {
    throw new Error(conversationError?.message || "No se pudo recuperar la conversación de la oferta.");
  }

  return newConversation.id;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const offerId = typeof body?.offerId === "string" ? body.offerId.trim() : "";
    const action = ["accept", "reject", "counter"].includes(body?.action)
      ? body.action
      : null;
    const counterPrice = body?.counterPrice == null ? null : Number(body.counterPrice);

    if (!offerId || !action) {
      return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
    }

    if (action === "counter" && (counterPrice == null || Number.isNaN(counterPrice) || counterPrice <= 0)) {
      return NextResponse.json({ error: "La contraoferta no es válida." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: offer } = await adminSupabase
      .from("listing_offers")
      .select("id, listing_id, buyer_id, seller_id, offered_price, status, counter_price")
      .eq("id", offerId)
      .maybeSingle();

    if (!offer) {
      return NextResponse.json({ error: "Oferta no encontrada." }, { status: 404 });
    }

    if (offer.seller_id !== user.id) {
      return NextResponse.json({ error: "No puedes responder a esta oferta." }, { status: 403 });
    }

    const conversationId = await getOrCreateConversationId({
      listingId: offer.listing_id,
      buyerId: offer.buyer_id,
      sellerId: offer.seller_id,
    });

    const now = new Date().toISOString();

    if (action === "accept") {
      await adminSupabase
        .from("listing_offers")
        .update({ status: "accepted", responded_at: now, counter_price: null })
        .eq("id", offerId);

      await adminSupabase
        .from("listing_offers")
        .update({ status: "rejected", responded_at: now })
        .eq("listing_id", offer.listing_id)
        .neq("id", offerId)
        .in("status", ["pending", "countered"]);

      await adminSupabase
        .from("listings")
        .update({ status: "reserved" })
        .eq("id", offer.listing_id);

      await adminSupabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: offer.seller_id,
        body: `💰 OFERTA|accepted|${offer.id}|${offer.offered_price}`,
      });

      await adminSupabase
        .from("conversations")
        .update({ updated_at: now })
        .eq("id", conversationId);

      return NextResponse.json({ ok: true, conversationId });
    }

    if (action === "reject") {
      await adminSupabase
        .from("listing_offers")
        .update({ status: "rejected", responded_at: now })
        .eq("id", offerId);

      await adminSupabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: offer.seller_id,
        body: `💰 OFERTA|rejected|${offer.id}|${offer.offered_price}`,
      });

      await adminSupabase
        .from("conversations")
        .update({ updated_at: now })
        .eq("id", conversationId);

      return NextResponse.json({ ok: true, conversationId });
    }

    await adminSupabase
      .from("listing_offers")
      .update({
        status: "countered",
        counter_price: counterPrice,
        responded_at: now,
      })
      .eq("id", offerId);

    await adminSupabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: offer.seller_id,
      body: `💰 OFERTA|countered|${offer.id}|${counterPrice}`,
    });

    await adminSupabase
      .from("conversations")
      .update({ updated_at: now })
      .eq("id", conversationId);

    return NextResponse.json({ ok: true, conversationId });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || error?.details || "No se pudo responder a la oferta.",
      },
      { status: 500 }
    );
  }
}
