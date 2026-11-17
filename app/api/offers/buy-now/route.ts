import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string,string> } = {}) {
  return NextResponse.json(body, {...options, headers: {...PRIVATE_HEADERS, ...(options.headers||{})}});
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMarketplacePricing, type DeliveryMethod, type ShipmentTier } from "@/lib/payments/pricing";
import { buildOfferChatBody } from "@/lib/offers/chat-message";
import { createNotifications } from "@/lib/notifications";
import { getListingTypeFromRow } from "@/lib/marketplace/listing-type";
import { canUserUseCommerce, isPublicCommerceEnabled, assertStripeTestMode, isPrivateShippingLabelCreationEnabled } from "@/lib/commerce/private-access";
import { deferProductEvent } from "@/lib/analytics/product-events.server";
import { prepareBuyNowPaymentIntent, BuyNowPaymentError } from "@/lib/payments/safe-buy-now-intent";
import { reserveAvailableListing, BuyNowReservationError } from "@/lib/commerce/buy-now-reservation";

function isDeliveryMethod(value: unknown): value is DeliveryMethod {
  return value === "in_person" || value === "shipping";
}

function isShipmentTier(value: unknown): value is ShipmentTier {
  return value === "none" || value === "small" || value === "medium" || value === "large";
}

export async function POST(request: Request) {
  let listingReserved = false;
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const guest = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson(
        { error: guest ? "Debes iniciar sesión." : "No se pudo comprobar tu sesión." },
        { status: guest ? 401 : 503 }
      );
    }
    const user = authData?.user ?? null;
    if (!user) return privateJson({ error: "Debes iniciar sesión." }, { status: 401 });

    if (!(await canUserUseCommerce(user))) {
      return privateJson({ error: "No disponible." }, { status: 404 });
    }
    if (!isPublicCommerceEnabled()) assertStripeTestMode();

    const body = await request.json();
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const deliveryMethod = isDeliveryMethod(body?.deliveryMethod) ? body.deliveryMethod : "in_person";
    const shipmentTier = isShipmentTier(body?.shipmentTier)
      ? body.shipmentTier
      : deliveryMethod === "shipping"
        ? "small"
        : "none";

    if (!listingId) {
      return privateJson({ error: "Falta el anuncio." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id, title, seller_id, school_id, status, price, type, listing_type")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError) return privateJson({ error: "No se pudo comprobar el anuncio." }, { status: 503 });
    if (!listing) return privateJson({ error: "El anuncio no existe." }, { status: 404 });

    if (getListingTypeFromRow(listing as any) === "donation") {
      return privateJson({ error: "La compra directa solo está disponible en anuncios de venta." }, { status: 400 });
    }

    if (listing.status !== "available") {
      return privateJson({ error: "Este anuncio ya no está disponible para comprar." }, { status: 400 });
    }

    if (!listing.seller_id || listing.seller_id === user.id) {
      return privateJson({ error: "No puedes comprar tu propio anuncio." }, { status: 400 });
    }

    const itemAmount = Number(listing.price ?? 0);
    if (!Number.isFinite(itemAmount) || itemAmount <= 0) {
      return privateJson({ error: "El anuncio no tiene un precio válido." }, { status: 400 });
    }

    const { data: otherAccepted, error: otherAcceptedError } = await admin.from("listing_offers")
      .select("id").eq("listing_id", listingId).eq("status", "accepted").limit(1).maybeSingle();
    if (otherAcceptedError) return privateJson({ error: "No se pudo verificar la compra." }, { status: 503 });
    if (otherAccepted?.id) {
      return privateJson({ error: "Este anuncio ya tiene una oferta aceptada." }, { status: 409 });
    }

    const { data: activeOffer, error: activeOfferError } = await admin.from("listing_offers")
      .select("id,status").eq("listing_id", listingId).eq("buyer_id", user.id)
      .eq("seller_id", listing.seller_id)
      .in("status", ["pending", "countered", "accepted"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (activeOfferError) return privateJson({ error: "No se pudo verificar la negociación." }, { status: 503 });
    if (activeOffer?.id) {
      return privateJson({ error: "Este anuncio ya tiene una negociación. Actualízala desde el chat." }, { status: 409 });
    }

    // The only write allowed before a financial offer is an exclusive
    // availability compare-and-set. A losing request must leave no chat,
    // accepted offer, event or payment behind.
    try {
      await reserveAvailableListing({ admin, listingId });
      listingReserved = true;
    } catch (error) {
      if (error instanceof BuyNowReservationError) {
        return privateJson({ error: error.publicMessage }, { status: error.status });
      }
      throw error;
    }

    const { data: existingConversation, error: existingConversationError } = await admin
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .eq("seller_id", listing.seller_id)
      .maybeSingle();

    if (existingConversationError) {
      return privateJson({ error: "No se pudo verificar el chat." }, { status: 503 });
    }
    let conversationId = existingConversation?.id || null;

    if (!conversationId) {
      const { data: newConversation, error: conversationError } = await admin
        .from("conversations")
        .insert({
          listing_id: listingId,
          buyer_id: user.id,
          seller_id: listing.seller_id,
        })
        .select("id")
        .single();

      if (conversationError?.code === "23505") {
        const { data: winner, error: winnerError } = await admin.from("conversations")
          .select("id").eq("listing_id", listingId).eq("buyer_id", user.id)
          .eq("seller_id", listing.seller_id).maybeSingle();
        if (winnerError || !winner?.id) {
          return privateJson({ error: "No se pudo conciliar el chat." }, { status: 503 });
        }
        conversationId = winner.id;
      } else {
        if (conversationError || !newConversation?.id) {
          return privateJson({ error: "No se pudo abrir el chat." }, { status: 503 });
        }
        conversationId = newConversation.id;
        deferProductEvent("conversation_started", { source: "buy_now" });
      }
    }

    if (conversationId) {
      const { error: unhideError } = await admin
        .from("hidden_conversations")
        .delete()
        .eq("conversation_id", conversationId)
        .in("user_id", [user.id, listing.seller_id]);
      if (unhideError) return privateJson({ error: "No se pudo recuperar el chat." }, { status: 503 });
    }

    let offerId: string | null = null;
    const now = new Date().toISOString();

    {
      const { data: offer, error: offerError } = await admin
        .from("listing_offers")
        .insert({
          listing_id: listingId,
          buyer_id: user.id,
          seller_id: listing.seller_id,
          offered_price: itemAmount,
          current_amount: itemAmount,
          accepted_amount: itemAmount,
          current_actor: "closed",
          rounds_count: 1,
          status: "accepted",
          responded_at: now,
        })
        .select("id")
        .single();

      if (offerError?.code === "23505") return privateJson({ error: "El anuncio quedó reservado y requiere conciliar otra oferta." }, { status: 503 });
      if (offerError || !offer) return privateJson({ error: "No se pudo crear la compra." }, { status: 503 });

      offerId = offer.id;

      const { data: createdEvent, error: eventError } = await admin
        .from("listing_offer_events")
        .insert({
          offer_id: offerId,
          conversation_id: conversationId,
          actor_id: user.id,
          actor_role: "buyer",
          event_type: "accepted",
          amount: itemAmount,
          round_number: 1,
          status_snapshot: "accepted",
        })
        .select("id")
        .single();

      if (eventError || !createdEvent?.id) {
        return privateJson({ error: "La compra se inició pero requiere conciliar el evento." }, { status: 503 });
      }

      if (conversationId) {
        const { error: messageError } = await admin.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body: buildOfferChatBody({
            eventId: createdEvent?.id,
            offerId,
            eventType: "accepted",
            actorRole: "buyer",
            amount: itemAmount,
            round: 1,
            status: "accepted",
            currentActor: "closed",
          }),
        });
        if (messageError) return privateJson({ error: "La compra se inició pero requiere conciliar el mensaje." }, { status: 503 });
      }
    }

    const pricing = buildMarketplacePricing({
      itemAmount,
      deliveryMethod,
      shipmentTier: deliveryMethod === "shipping" ? shipmentTier : "none",
    });

    let paymentIntent;
    try {
      paymentIntent = await prepareBuyNowPaymentIntent({
        admin, listing, userId: user.id, offerId, conversationId,
        pricing, deliveryMethod, now,
      });
    } catch (error) {
      if (error instanceof BuyNowPaymentError) {
        return privateJson({ error: error.publicMessage }, { status: error.status });
      }
      throw error;
    }

    if (conversationId) {
      const { data: touched, error: touchError } = await admin.from("conversations")
        .update({ updated_at: now }).eq("id", conversationId).select("id").maybeSingle();
      if (touchError || !touched) {
        return privateJson({ error: "La compra se inició pero requiere conciliar el chat." }, { status: 503 });
      }
    }

    const { error: notifyError } = await createNotifications(admin, [
      {
        user_id: listing.seller_id,
        kind: "offer_accepted",
        title: "Han iniciado una compra directa",
        body: `${user.user_metadata?.full_name || user.email || "Un usuario"} quiere comprar ${listing.title || "tu anuncio"}.`,
        href: conversationId ? `/messages/${conversationId}` : "/messages",
        metadata: { listing_id: listingId, offer_id: offerId, conversation_id: conversationId },
      },
    ]);
    if (notifyError) return privateJson({ error: "La compra se inició pero requiere conciliar el aviso." }, { status: 503 });

    return privateJson({
      ok: true,
      conversationId,
      offerId,
      paymentIntent,
      quote: pricing,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("buy_now_checkout_failed");
    if (listingReserved) {
      return privateJson(
        { error: "El anuncio quedó reservado, pero la compra necesita conciliación." },
        { status: 503 }
      );
    }
    return privateJson({ error: "No se pudo iniciar la compra." }, {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
