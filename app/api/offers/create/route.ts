import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getListingTypeFromRow } from "@/lib/marketplace/listing-type";
import { buildOfferChatBody } from "@/lib/offers/chat-message";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

    const body = await request.json();
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const offeredPrice = Number(body?.offeredPrice);
    if (!listingId || Number.isNaN(offeredPrice) || offeredPrice <= 0) {
      return NextResponse.json({ error: "La oferta no es válida." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: listing, error: listingError } = await admin.from("listings").select("id, title, seller_id, status, type, listing_type").eq("id", listingId).maybeSingle();
    if (listingError || !listing) return NextResponse.json({ error: "El anuncio no existe." }, { status: 404 });
    if (getListingTypeFromRow(listing as any) !== "sale") return NextResponse.json({ error: "Solo se permiten ofertas en anuncios de venta." }, { status: 400 });
    if (listing.status !== "available") return NextResponse.json({ error: "Este anuncio ya no acepta nuevas ofertas." }, { status: 400 });
    if (!listing.seller_id || listing.seller_id === user.id) return NextResponse.json({ error: "No puedes ofertar sobre tu propio anuncio." }, { status: 400 });

    const { data: existingOffer } = await admin.from("listing_offers").select("id").eq("listing_id", listingId).eq("buyer_id", user.id).eq("seller_id", listing.seller_id).in("status", ["pending", "countered"]).maybeSingle();
    if (existingOffer) return NextResponse.json({ error: "Ya tienes una negociación activa para este anuncio." }, { status: 400 });

    const now = new Date().toISOString();
    const { data: offer, error: offerError } = await admin.from("listing_offers").insert({
      listing_id: listingId,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      offered_price: offeredPrice,
      current_amount: offeredPrice,
      current_actor: "seller",
      rounds_count: 1,
      status: "pending",
      counter_price: null,
      accepted_amount: null,
      responded_at: null,
    }).select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, current_actor, rounds_count, accepted_amount, status, counter_price, created_at, responded_at").single();
    if (offerError || !offer) return NextResponse.json({ error: offerError?.message || "No se pudo crear la oferta." }, { status: 400 });

    const { data: existingConversation } = await admin.from("conversations").select("id").eq("listing_id", listingId).eq("buyer_id", user.id).eq("seller_id", listing.seller_id).maybeSingle();
    let conversationId = existingConversation?.id || null;
    if (!conversationId) {
      const { data: newConversation, error } = await admin.from("conversations").insert({ listing_id: listingId, buyer_id: user.id, seller_id: listing.seller_id }).select("id").single();
      if (error || !newConversation) return NextResponse.json({ error: error?.message || "No se pudo abrir el chat." }, { status: 400 });
      conversationId = newConversation.id;
    } else {
      await admin.from("hidden_conversations").delete().eq("conversation_id", conversationId).in("user_id", [user.id, listing.seller_id]);
    }

    const { data: event, error: eventError } = await admin.from("listing_offer_events").insert({
      offer_id: offer.id,
      conversation_id: conversationId,
      actor_id: user.id,
      actor_role: "buyer",
      event_type: "offer_created",
      amount: offeredPrice,
      round_number: 1,
      status_snapshot: "pending",
    }).select("id").single();
    if (eventError || !event) return NextResponse.json({ error: eventError?.message || "No se pudo registrar el historial de la oferta." }, { status: 400 });

    await admin.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: buildOfferChatBody({
        eventId: event.id,
        offerId: offer.id,
        eventType: "offer_created",
        actorRole: "buyer",
        amount: offeredPrice,
        round: 1,
        status: "pending",
        currentActor: "seller",
      }),
    });

    await admin.from("conversations").update({ updated_at: now }).eq("id", conversationId);

    await createNotification(admin, {
      user_id: listing.seller_id,
      kind: "offer_received",
      title: "Has recibido una oferta",
      body: `${listing.title || "Un anuncio"} · ${offeredPrice.toFixed(2)} €`,
      href: `/messages/${conversationId}`,
      metadata: { listing_id: listingId, offer_id: offer.id, conversation_id: conversationId },
    });

    return NextResponse.json({ ok: true, offerId: offer.id, conversationId });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || error?.details || "No se pudo crear la oferta." }, { status: 500 });
  }
}
