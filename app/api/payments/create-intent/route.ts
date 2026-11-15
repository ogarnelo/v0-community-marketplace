import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMarketplacePricing, type DeliveryMethod, type ShipmentTier } from "@/lib/payments/pricing";
import { getAcceptedOfferAmount } from "@/lib/payments/offer-amount";
import { canUserUseCommerce, isPublicCommerceEnabled, assertStripeTestMode, isPrivateShippingLabelCreationEnabled } from "@/lib/commerce/private-access";

function isShipmentTier(value: unknown): value is ShipmentTier {
  return value === "none" || value === "small" || value === "medium" || value === "large";
}

function isDeliveryMethod(value: unknown): value is DeliveryMethod {
  return value === "in_person" || value === "shipping";
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

    if (!(await canUserUseCommerce(user))) {
      return NextResponse.json({ error: "No disponible." }, { status: 404 });
    }
    if (!isPublicCommerceEnabled()) assertStripeTestMode();

    const body = await request.json();
    const offerId = typeof body?.offerId === "string" ? body.offerId.trim() : "";
    const deliveryMethod = isDeliveryMethod(body?.deliveryMethod) ? body.deliveryMethod : "shipping";
    const shipmentTier = isShipmentTier(body?.shipmentTier)
      ? body.shipmentTier
      : deliveryMethod === "shipping"
        ? "small"
        : "none";

    if (!offerId) {
      return NextResponse.json({ error: "Falta la oferta." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: offer, error: offerLookupError } = await adminSupabase
      .from("listing_offers")
      .select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, accepted_amount, counter_price, status")
      .eq("id", offerId)
      .maybeSingle();

    if (offerLookupError) {
      return NextResponse.json({ error: "No se pudo verificar la oferta." }, { status: 503 });
    }
    if (!offer) {
      return NextResponse.json({ error: "Oferta no encontrada." }, { status: 404 });
    }

    if (offer.buyer_id !== user.id) {
      return NextResponse.json({ error: "No puedes preparar el pago de esta oferta." }, { status: 403 });
    }

    if (offer.status !== "accepted") {
      return NextResponse.json({ error: "La oferta aún no está aceptada." }, { status: 400 });
    }

    const acceptedAmount = getAcceptedOfferAmount(offer);

    if (!Number.isFinite(acceptedAmount) || acceptedAmount <= 0) {
      return NextResponse.json({ error: "El importe aceptado no es válido." }, { status: 400 });
    }

    const pricing = buildMarketplacePricing({
      itemAmount: acceptedAmount,
      deliveryMethod,
      shipmentTier,
    });

    const { data: listing, error: listingLookupError } = await adminSupabase
      .from("listings")
      .select("id, status")
      .eq("id", offer.listing_id)
      .maybeSingle();

    if (listingLookupError) {
      return NextResponse.json({ error: "No se pudo verificar el anuncio." }, { status: 503 });
    }
    if (!listing) {
      return NextResponse.json({ error: "El anuncio ya no está disponible." }, { status: 404 });
    }

    // Sold listings cannot start another checkout. A reserved listing may
    // continue only for its already-accepted offer; uniqueness protects retries.
    if (!["available", "reserved"].includes(String(listing.status))) {
      return NextResponse.json({ error: "El anuncio no permite preparar el pago." }, { status: 400 });
    }

    const { data: conversation, error: conversationLookupError } = await adminSupabase
      .from("conversations")
      .select("id")
      .eq("listing_id", offer.listing_id)
      .eq("buyer_id", offer.buyer_id)
      .eq("seller_id", offer.seller_id)
      .maybeSingle();
    if (conversationLookupError) {
      return NextResponse.json({ error: "No se pudo verificar la conversación." }, { status: 503 });
    }

    const now = new Date().toISOString();

    // A partial unique index enforces one payment intent per non-null offer.
    // Never UPSERT here: retries must not overwrite an existing payment
    // (especially processing or succeeded) with requires_payment_method.
    const { data: paymentIntent, error } = await adminSupabase
      .from("payment_intents")
      .insert(
        {
          listing_id: offer.listing_id,
          conversation_id: conversation?.id || null,
          offer_id: offer.id,
          buyer_id: offer.buyer_id,
          seller_id: offer.seller_id,
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
            source: "offer_acceptance",
            delivery_method: pricing.deliveryMethod,
            total_buyer_amount: pricing.totalBuyerAmount,
          },
          updated_at: now,
        }
      )
      .select("id, status, amount, currency, buyer_fee_amount, shipping_amount, seller_net_amount, shipment_tier, metadata")
      .single();

    if (error?.code === "23505") {
      const { data: existingPayment, error: existingError } = await adminSupabase
        .from("payment_intents")
        .select("id, status")
        .eq("offer_id", offer.id)
        .maybeSingle();
      if (existingError || !existingPayment) {
        return NextResponse.json({ error: "No se pudo recuperar el pago existente." }, { status: 503 });
      }
      return NextResponse.json({
        error: "Ya existe una operación de pago para esta oferta. Consulta su estado antes de reintentar.",
        alreadyExists: true,
        paymentIntentId: existingPayment.id,
        paymentStatus: existingPayment.status,
      }, { status: 409 });
    }
    if (error || !paymentIntent) {
      return NextResponse.json({ error: "No se pudo preparar el pago." }, { status: 400 });
    }

    if (listing.status === "available") {
      const { error: reserveError } = await adminSupabase
        .from("listings")
        .update({ status: "reserved" })
        .eq("id", listing.id)
        .eq("status", "available");
      if (reserveError) {
        return NextResponse.json({ error: "El pago se registró, pero no se pudo reservar el anuncio." }, { status: 503 });
      }
    }

    return NextResponse.json({
      ok: true,
      paymentIntent,
      checkout: {
        itemAmount: pricing.itemAmount,
        buyerFeeAmount: pricing.buyerFeeAmount,
        shippingAmount: pricing.shippingAmount,
        totalBuyerAmount: pricing.totalBuyerAmount,
        deliveryMethod: pricing.deliveryMethod,
        shipmentTier: pricing.shipmentTier,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    // Payment details, provider and SQL exceptions are always private.
    console.error("payment_intent_prepare_failed");
    return NextResponse.json(
      { error: "No se pudo preparar el pago." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
