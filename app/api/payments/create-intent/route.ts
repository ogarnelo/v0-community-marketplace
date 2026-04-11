import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMarketplacePricing, type DeliveryMethod, type ShipmentTier } from "@/lib/payments/pricing";
import { getAcceptedOfferAmount } from "@/lib/payments/offer-amount";

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

    const { data: offer } = await adminSupabase
      .from("listing_offers")
      .select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, accepted_amount, counter_price, status")
      .eq("id", offerId)
      .maybeSingle();

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

    const { data: listing } = await adminSupabase
      .from("listings")
      .select("id, status")
      .eq("id", offer.listing_id)
      .maybeSingle();

    if (!listing) {
      return NextResponse.json({ error: "El anuncio ya no está disponible." }, { status: 404 });
    }

    if (!["available", "reserved", "sold"].includes(String(listing.status))) {
      return NextResponse.json({ error: "El anuncio no permite preparar el pago." }, { status: 400 });
    }

    const { data: conversation } = await adminSupabase
      .from("conversations")
      .select("id")
      .eq("listing_id", offer.listing_id)
      .eq("buyer_id", offer.buyer_id)
      .eq("seller_id", offer.seller_id)
      .maybeSingle();

    const now = new Date().toISOString();

    const { data: paymentIntent, error } = await adminSupabase
      .from("payment_intents")
      .upsert(
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
          shipment_tier: pricing.shipmentTier,
          metadata: {
            source: "offer_acceptance",
            delivery_method: pricing.deliveryMethod,
          },
          updated_at: now,
        },
        { onConflict: "offer_id" }
      )
      .select("id, status, amount, currency, buyer_fee_amount, shipping_amount, seller_net_amount, shipment_tier, metadata")
      .single();

    if (error || !paymentIntent) {
      return NextResponse.json({ error: error?.message || "No se pudo preparar el pago." }, { status: 400 });
    }

    if (listing.status === "available") {
      await adminSupabase
        .from("listings")
        .update({ status: "reserved" })
        .eq("id", listing.id)
        .eq("status", "available");
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
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo preparar el pago." },
      { status: 500 }
    );
  }
}
