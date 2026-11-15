import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMarketplacePricing, type DeliveryMethod, type ShipmentTier } from "@/lib/payments/pricing";
import { getAcceptedOfferAmount } from "@/lib/payments/offer-amount";
import { buildOfferChatBody } from "@/lib/offers/chat-message";
import { createNotifications } from "@/lib/notifications";
import { getListingTypeFromRow } from "@/lib/marketplace/listing-type";
import { canUserUseCommerce, isPublicCommerceEnabled, assertStripeTestMode, isPrivateShippingLabelCreationEnabled } from "@/lib/commerce/private-access";
import { deferProductEvent } from "@/lib/analytics/product-events.server";

function isDeliveryMethod(value: unknown): value is DeliveryMethod {
  return value === "in_person" || value === "shipping";
}

function isShipmentTier(value: unknown): value is ShipmentTier {
  return value === "none" || value === "small" || value === "medium" || value === "large";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    if (!(await canUserUseCommerce(user))) {
      return NextResponse.json({ error: "No disponible." }, { status: 404 });
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
      return NextResponse.json({ error: "Falta el anuncio." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id, title, seller_id, school_id, status, price, type, listing_type")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError || !listing) {
      return NextResponse.json({ error: "El anuncio no existe." }, { status: 404 });
    }

    if (getListingTypeFromRow(listing as any) === "donation") {
      return NextResponse.json({ error: "La compra directa solo está disponible en anuncios de venta." }, { status: 400 });
    }

    if (listing.status !== "available") {
      return NextResponse.json({ error: "Este anuncio ya no está disponible para comprar." }, { status: 400 });
    }

    if (!listing.seller_id || listing.seller_id === user.id) {
      return NextResponse.json({ error: "No puedes comprar tu propio anuncio." }, { status: 400 });
    }

    let itemAmount = Number(listing.price ?? 0);
    if (!Number.isFinite(itemAmount) || itemAmount <= 0) {
      return NextResponse.json({ error: "El anuncio no tiene un precio válido." }, { status: 400 });
    }

    const { data: existingConversation, error: existingConversationError } = await admin
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .eq("seller_id", listing.seller_id)
      .maybeSingle();
    if (existingConversationError) {
      return NextResponse.json({ error: "No se pudo verificar el chat existente." }, { status: 503 });
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

      if (conversationError || !newConversation) {
        return NextResponse.json({ error: "No se pudo abrir el chat." }, { status: 400 });
      }

      conversationId = newConversation.id;
      deferProductEvent("conversation_started", { source: "buy_now" });
    }

    if (conversationId) {
      await admin
        .from("hidden_conversations")
        .delete()
        .eq("conversation_id", conversationId)
        .in("user_id", [user.id, listing.seller_id]);
    }

    const { data: activeOffer, error: activeOfferError } = await admin
      .from("listing_offers")
      .select("id, status, accepted_amount, current_amount, counter_price, offered_price")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .eq("seller_id", listing.seller_id)
      .in("status", ["pending", "countered", "accepted"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeOfferError) {
      return NextResponse.json({ error: "No se pudo verificar la negociación existente." }, { status: 503 });
    }

    // A buyer may already have an accepted negotiated offer below list price.
    // Reusing its offer_id MUST also reuse the agreed price; never silently
    // charge the public listing price on a checkout retry.
    if (activeOffer?.status === "accepted") {
      itemAmount = getAcceptedOfferAmount(activeOffer);
      if (!Number.isFinite(itemAmount) || itemAmount <= 0) {
        return NextResponse.json({ error: "La oferta aceptada tiene un importe inválido." }, { status: 409 });
      }
    }

    let offerId = activeOffer?.id || null;
    const now = new Date().toISOString();

    if (activeOffer?.status === "pending" || activeOffer?.status === "countered") {
      return NextResponse.json(
        {
          error: "Ya tienes una negociación abierta para este anuncio. Te llevamos al chat para continuarla.",
          conversationId,
          redirectTo: conversationId ? `/messages/${conversationId}` : `/marketplace/listing/${listingId}`,
          offerId: activeOffer.id,
        },
        { status: 409 }
      );
    }

    if (!offerId) {
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

      if (offerError || !offer) {
        return NextResponse.json({ error: "No se pudo crear la compra." }, { status: 400 });
      }

      offerId = offer.id;

      const { data: createdEvent } = await admin
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

      if (conversationId) {
        await admin.from("messages").insert({
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
      }
    }

    const pricing = buildMarketplacePricing({
      itemAmount,
      deliveryMethod,
      shipmentTier: deliveryMethod === "shipping" ? shipmentTier : "none",
    });

    // payment_intents.offer_id has a PARTIAL unique index in production.
    // ON CONFLICT (offer_id) cannot target that index without its predicate;
    // more importantly UPDATE on conflict could reset a completed payment.
    // INSERT is the safe, concurrency-aware operation: 23505 means reuse
    // the existing checkout without modifying its status, amount or ledger.
    const { data: paymentIntent, error: paymentError } = await admin
      .from("payment_intents")
      .insert(
        {
          listing_id: listingId,
          conversation_id: conversationId,
          offer_id: offerId,
          buyer_id: user.id,
          seller_id: listing.seller_id,
          school_id: listing.school_id || null,
          // payment_intents.amount is the ITEM price. Other checkout,
          // refund and shipping readers add buyer_fee_amount +
          // shipping_amount separately; storing the buyer total here
          // doubles fees on refunds and misstates shipping item value.
          amount: pricing.itemAmount,
          currency: "EUR",
          provider: "stripe",
          status: "requires_payment_method",
          buyer_fee_amount: pricing.buyerFeeAmount,
          shipping_amount: pricing.shippingAmount,
          seller_net_amount: pricing.sellerNetAmount,
          platform_fee_amount: pricing.buyerFeeAmount,
          shipment_tier: pricing.shipmentTier,
          metadata: {
            source: "buy_now",
            delivery_method: deliveryMethod,
            item_amount: pricing.itemAmount,
            total_buyer_amount: pricing.totalBuyerAmount,
          },
          updated_at: now,
        }
      )
      .select("id, amount, currency, status")
      .single();

    if (paymentError?.code === "23505") {
      // Unique offer ID already has a checkout. Never reset an existing
      // processing, succeeded, refunded or canceled payment on retry.
      const { data: existingPayment, error: lookupError } = await admin
        .from("payment_intents")
        .select("id, status")
        .eq("offer_id", offerId)
        .maybeSingle();
      if (lookupError || !existingPayment) {
        return NextResponse.json({ error: "No se pudo recuperar el pago existente." }, { status: 503 });
      }
      return NextResponse.json({
        error: "Ya existe un pago asociado a esta oferta. Continúa desde el chat.",
        alreadyExists: true,
        conversationId,
        redirectTo: conversationId ? `/messages/${conversationId}` : `/marketplace/listing/${listingId}`,
      }, { status: 409 });
    }
    if (paymentError || !paymentIntent) {
      return NextResponse.json({ error: "No se pudo preparar el checkout." }, { status: 400 });
    }

    if (conversationId) {
      await admin.from("conversations").update({ updated_at: now }).eq("id", conversationId);
    }

    await createNotifications(admin, [
      {
        user_id: listing.seller_id,
        kind: "offer_accepted",
        title: "Han iniciado una compra directa",
        body: `${user.user_metadata?.full_name || user.email || "Un usuario"} quiere comprar ${listing.title || "tu anuncio"}.`,
        href: conversationId ? `/messages/${conversationId}` : "/messages",
        metadata: { listing_id: listingId, offer_id: offerId, conversation_id: conversationId },
      },
    ]);

    return NextResponse.json({
      ok: true,
      conversationId,
      offerId,
      paymentIntent,
      quote: pricing,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    // Never return privileged SQL/provider diagnostics to the buyer.
    console.error("buy_now_checkout_failed");
    return NextResponse.json(
      { error: "No se pudo iniciar la compra." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
