import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { getListingTypeFromRow } from "@/lib/marketplace/listing-type";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const body = await request.json();
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const offeredPrice = Number(body?.offeredPrice);

    if (!listingId || Number.isNaN(offeredPrice) || offeredPrice <= 0) {
      return NextResponse.json({ error: "La oferta no es válida." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: listing, error: listingError } = await adminSupabase
      .from("listings")
      .select("id, title, seller_id, status, price, type, listing_type")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError || !listing) {
      return NextResponse.json({ error: "El anuncio no existe." }, { status: 404 });
    }

    if (getListingTypeFromRow(listing as any) !== "sale") {
      return NextResponse.json({ error: "Solo se permiten ofertas en anuncios de venta." }, { status: 400 });
    }

    if (listing.status !== "available") {
      return NextResponse.json({ error: "Este anuncio ya no acepta nuevas ofertas." }, { status: 400 });
    }

    if (!listing.seller_id || listing.seller_id === user.id) {
      return NextResponse.json({ error: "No puedes ofertar sobre tu propio anuncio." }, { status: 400 });
    }

    const { data: existingOffer } = await adminSupabase
      .from("listing_offers")
      .select("id, status")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .in("status", ["pending", "countered"])
      .maybeSingle();

    if (existingOffer) {
      return NextResponse.json({ error: "Ya tienes una oferta activa para este anuncio." }, { status: 400 });
    }

    const { data: existingConversation } = await adminSupabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .eq("seller_id", listing.seller_id)
      .maybeSingle();

    let conversationId = existingConversation?.id || null;

    if (!conversationId) {
      const { data: newConversation, error: conversationError } = await adminSupabase
        .from("conversations")
        .insert({
          listing_id: listingId,
          buyer_id: user.id,
          seller_id: listing.seller_id,
        })
        .select("id")
        .single();

      if (conversationError) {
        return NextResponse.json({ error: conversationError.message }, { status: 400 });
      }

      conversationId = newConversation?.id || null;
    }

    const { data: offer, error: offerError } = await adminSupabase
      .from("listing_offers")
      .insert({
        listing_id: listingId,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        offered_price: offeredPrice,
        status: "pending",
      })
      .select("id")
      .single();

    if (offerError) {
      return NextResponse.json({ error: offerError.message }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (conversationId) {
      await adminSupabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: `💰 Oferta enviada: ${offeredPrice} €`,
      });

      await adminSupabase
        .from("conversations")
        .update({ updated_at: now })
        .eq("id", conversationId);
    }

    await createNotification(adminSupabase, {
      user_id: listing.seller_id,
      kind: "offer_received",
      title: "Nueva oferta recibida",
      body: `${user.user_metadata?.full_name || user.email || "Un usuario"} ha ofrecido ${offeredPrice} € por ${listing.title || "tu anuncio"}.`,
      href: conversationId ? `/messages/${conversationId}` : "/account/listings",
      metadata: {
        listing_id: listingId,
        offer_id: offer?.id || null,
        conversation_id: conversationId,
      },
    });

    return NextResponse.json({ ok: true, offerId: offer?.id || null, conversationId });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo crear la oferta." },
      { status: 500 }
    );
  }
}
